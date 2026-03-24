from __future__ import annotations
"""
ai_service_py/main.py — Dominofy AI gateway (v2.0 two-stage)
─────────────────────────────────────────────────────────────
* FastAPI micro-service calling Gemini 2.5 Flash
* Two-stage generation: Stage-1 plans needed domino types, Stage-2 generates
* Structured JSON output when supported, with fallback for older Gemini SDK/API paths
* Generalised two-pass RAG: targeted retrieval for any missing planned types
* Context pruning: strips field values from large workflows to save tokens
* revision_diffs: pass structured JSON diffs to give model edit history
"""
import atexit
import asyncio
import json
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from functools import partial
from typing import Any, AsyncIterator, Dict, List, Set

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import google.generativeai as genai
try:
    from google import genai as google_genai
    from google.genai import types as google_genai_types
except ImportError:  # pragma: no cover - optional dependency in local/dev envs
    google_genai = None
    google_genai_types = None

from prompt_template import build_prompt, build_intent_prompt, build_info_prompt
from retrieval import get_all_domino_docs, get_all_domino_ids
from schema import PromptIn, AIResponseOut, safe_json_loads
from json import JSONDecodeError

# ───────────────────────── 1. Auth / SDK ─────────────────────────
load_dotenv()
API_KEY = os.getenv("GOOGLE_API_KEY")
genai.configure(api_key=API_KEY)

GEN_MODEL        = os.getenv("GEN_MODEL", "models/gemini-2.5-flash")
GEN_TEMPERATURE  = float(os.getenv("GEN_TEMPERATURE", "0.3"))

# Prefer structured JSON output, but not every deployed Gemini client/API path
# accepts response_mime_type. We detect that error and retry without it.
GEN_CONFIG = {
    "temperature": GEN_TEMPERATURE,
    "response_mime_type": "application/json",
}

# Planning stage: lighter temperature, same structured output

MODEL = genai.GenerativeModel(GEN_MODEL)
GENAI_CLIENT = google_genai.Client(api_key=API_KEY) if google_genai and API_KEY else None

# ───────────────────────── Thread pool / tuning ─────────────────
def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default

MAX_THREAD_WORKERS = max(4, _env_int("AI_THREAD_WORKERS", 8))
_RAG_EXECUTOR = ThreadPoolExecutor(max_workers=MAX_THREAD_WORKERS)
atexit.register(lambda: _RAG_EXECUTOR.shutdown(wait=False))

# ───────────────────────── 2. FastAPI app ───────────────────────
app = FastAPI(title="Dominofy AI Service", version="2.0.0")

cors_origins = os.getenv("AI_CORS_ORIGINS", "*")
origins = [o.strip() for o in cors_origins.split(",")] if cors_origins else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)


@app.get("/ping", tags=["health"])
def ping() -> Dict[str, str]:
    return {
        "status": "ok",
        "model":  GEN_MODEL,
        "auth":   "api_key" if API_KEY else "ADC",
        "version": "2.0.0",
    }

# ───────────────────────── 3. Hit helpers ───────────────────────


def parse_model_payload(raw: str) -> Dict[str, Any]:
    """
    With response_mime_type=application/json the model returns valid JSON directly.
    safe_json_loads strips markdown fences and falls back to brace extraction.
    """
    cleaned = (raw or "").strip()
    if not cleaned:
        raise ValueError("Gemini returned an empty response.")
    try:
        return json.loads(cleaned)
    except JSONDecodeError:
        pass
    try:
        return safe_json_loads(cleaned)
    except JSONDecodeError:
        pass
    # Final fallback: extract between first { and last }
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(cleaned[start : end + 1])
        except JSONDecodeError:
            pass
    snippet = cleaned[:240].replace("\n", " ")
    raise ValueError(f"Gemini returned unparseable output. Snippet: {snippet}")


def _without_response_mime_type(config: Dict[str, Any]) -> Dict[str, Any]:
    return {k: v for k, v in config.items() if k != "response_mime_type"}


def _is_response_mime_type_error(exc: Exception) -> bool:
    message = str(exc)
    return (
        "response_mime_type" in message
        and "GenerationConfig" in message
        and "Unknown field" in message
    )


def generate_content_with_fallback(prompt_text: str, config: Dict[str, Any]):
    """
    Retry without response_mime_type for environments pinned to an older
    google-generativeai / backend API combination.
    """
    try:
        return MODEL.generate_content(prompt_text, generation_config=config)
    except Exception as exc:
        if not _is_response_mime_type_error(exc):
            raise
        fallback_config = _without_response_mime_type(config)
        return MODEL.generate_content(prompt_text, generation_config=fallback_config)


def extract_thought_summaries(response: Any) -> List[str]:
    summaries: List[str] = []
    candidates = getattr(response, "candidates", None) or []
    if not candidates:
        return summaries

    content = getattr(candidates[0], "content", None)
    parts = getattr(content, "parts", None) or []
    for part in parts:
        if getattr(part, "thought", False) and getattr(part, "text", None):
            text = part.text.strip()
            if text:
                summaries.append(text)
    return summaries


def generate_content_with_thought_summaries(prompt_text: str) -> tuple[str, List[str]]:
    """
    Prefer the newer google-genai SDK for Gemini thought summaries when available.
    Fall back to the legacy SDK and no model-native thought summaries otherwise.
    """
    if GENAI_CLIENT and google_genai_types:
        config = google_genai_types.GenerateContentConfig(
            temperature=GEN_TEMPERATURE,
            response_mime_type="application/json",
            thinking_config=google_genai_types.ThinkingConfig(include_thoughts=True),
        )
        response = GENAI_CLIENT.models.generate_content(
            model=GEN_MODEL.replace("models/", ""),
            contents=prompt_text,
            config=config,
        )
        return response.text, extract_thought_summaries(response)

    legacy_response = generate_content_with_fallback(prompt_text, GEN_CONFIG)
    return legacy_response.text, []


def encode_stream_event(event_type: str, data: Dict[str, Any]) -> bytes:
    return (json.dumps({"type": event_type, **data}, separators=(",", ":")) + "\n").encode("utf-8")


# ───────────────────────── 4. Intent detection ──────────────────
INTENT_CONFIG = {
    "temperature": 0.0,
    "response_mime_type": "application/json",
}


def detect_intent(prompt: PromptIn) -> str:
    """
    Classify whether the user wants to build/modify a workflow ('workflow')
    or is asking an informational question ('informational').
    Defaults to 'workflow' on any failure.
    """
    intent_prompt = build_intent_prompt(prompt)
    try:
        result = generate_content_with_fallback(intent_prompt, INTENT_CONFIG)
        parsed = json.loads(result.text)
        intent = parsed.get("intent", "workflow")
        if intent in ("workflow", "informational"):
            return intent
    except Exception:
        pass
    return "workflow"


def generate_info_response(prompt: PromptIn, all_docs: str) -> Dict[str, Any]:
    """
    Generate a plain-language answer for informational queries.
    Returns an AIResponseOut-compatible dict with empty nodes/edges.
    """
    info_prompt = build_info_prompt(all_docs, prompt)
    explanation = "I'm here to help with your Dominofy workflow. What would you like to know?"

    def _extract_explanation(text: str) -> str:
        """Pull the explanation string out of a JSON response or return raw text."""
        text = text.strip()
        try:
            parsed = json.loads(text)
            if isinstance(parsed, dict) and "explanation" in parsed:
                return parsed["explanation"]
        except Exception:
            pass
        # Strip markdown fences if present
        try:
            from schema import safe_json_loads
            parsed = safe_json_loads(text)
            if isinstance(parsed, dict) and "explanation" in parsed:
                return parsed["explanation"]
        except Exception:
            pass
        return text

    try:
        result = generate_content_with_fallback(info_prompt, GEN_CONFIG)
        explanation = _extract_explanation(result.text or explanation)
    except Exception:
        try:
            result = generate_content_with_fallback(
                info_prompt, _without_response_mime_type(GEN_CONFIG)
            )
            explanation = _extract_explanation(result.text or explanation)
        except Exception:
            pass
    return {
        "nodes": [],
        "edges": [],
        "explanation": explanation,
        "status": "not_generated",
        "thought_summaries": [],
        "chain_of_thought": [],
    }


def finalize_generation_payload(payload: Dict[str, Any], known_ids: Set[str]) -> Dict[str, Any]:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")

    good_nodes = []
    for n in payload.get("nodes", []):
        if n.get("type") in known_ids:
            if "-" not in n.get("id", ""):
                n["id"] = f"{n['type']}-{ts}"
            good_nodes.append(n)

    payload["nodes"] = good_nodes
    payload["edges"] = [
        e for e in payload.get("edges", [])
        if e.get("source") in {n["id"] for n in good_nodes}
        and e.get("target") in {n["id"] for n in good_nodes}
    ]

    if "status" not in payload:
        payload["status"] = (
            "completely_generated" if good_nodes else "not_generated"
        )

    return payload

# ───────────────────────── 5. Core generation (sync) ────────────
def generate_with_all_docs(prompt: PromptIn) -> Dict[str, Any]:
    """
    Full-context generation: all domino docs are always included.
    No semantic search or planning stage needed.
    """
    all_docs = get_all_domino_docs()
    known_ids = set(get_all_domino_ids())

    # ── Intent detection ────────────────────────────────────────
    intent = detect_intent(prompt)
    if intent == "informational":
        return generate_info_response(prompt, all_docs)

    # ── Generate ────────────────────────────────────────────────
    full_prompt = build_prompt(all_docs, prompt)
    response_text, model_thought_summaries = generate_content_with_thought_summaries(full_prompt)
    payload = parse_model_payload(response_text)
    payload = finalize_generation_payload(payload, known_ids)

    summary = f"Built {len(payload.get('nodes', []))} node(s) and {len(payload.get('edges', []))} edge(s)"
    thought_summaries = model_thought_summaries or [summary]
    payload["thought_summaries"] = thought_summaries
    payload["chain_of_thought"] = thought_summaries

    return payload

# ───────────────────────── 6. Async wrappers ───────────────────
async def _run_blocking(func, *args):
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_RAG_EXECUTOR, partial(func, *args))



async def stream_generate_with_rag(prompt: PromptIn) -> AsyncIterator[bytes]:
    yield encode_stream_event(
        "status",
        {"status": "planning", "message": "Analysing your request."},
    )

    all_docs = await _run_blocking(get_all_domino_docs)
    known_ids = set(get_all_domino_ids())

    # ── Intent detection ────────────────────────────────────────
    intent = await _run_blocking(detect_intent, prompt)
    if intent == "informational":
        yield encode_stream_event(
            "status",
            {"status": "answering", "message": "Preparing your answer..."},
        )
        info_result = await _run_blocking(generate_info_response, prompt, all_docs)
        yield encode_stream_event("thought_summaries", {"thought_summaries": [], "source": "fallback"})
        yield encode_stream_event("result", info_result)
        return

    # ── Generate ────────────────────────────────────────────────
    yield encode_stream_event(
        "status",
        {"status": "generating", "message": "Generating workflow..."},
    )

    full_prompt = build_prompt(all_docs, prompt)
    response_text, model_thought_summaries = await _run_blocking(
        generate_content_with_thought_summaries,
        full_prompt,
    )
    payload = parse_model_payload(response_text)
    payload = finalize_generation_payload(payload, known_ids)

    completed_summary = f"Built {len(payload.get('nodes', []))} node(s) and {len(payload.get('edges', []))} edge(s)"
    thought_summaries = model_thought_summaries or [completed_summary]

    yield encode_stream_event(
        "thought_summaries",
        {"thought_summaries": thought_summaries, "source": "gemini" if model_thought_summaries else "fallback"},
    )

    payload["thought_summaries"] = thought_summaries
    payload["chain_of_thought"] = thought_summaries
    yield encode_stream_event("result", payload)

# ───────────────────────── 7. FastAPI route ────────────────────
@app.post("/generate", tags=["ai"])
async def generate(prompt: PromptIn):
    try:
        ai_json   = await _run_blocking(generate_with_all_docs, prompt)
        validated = AIResponseOut.parse_obj(ai_json)
        return validated.dict()
    except Exception as exc:
        raise HTTPException(500, detail=str(exc)) from exc


@app.post("/generate-stream", tags=["ai"])
async def generate_stream(prompt: PromptIn):
    async def event_stream():
        try:
            async for chunk in stream_generate_with_rag(prompt):
                yield chunk
        except Exception as exc:
            yield encode_stream_event("error", {"detail": str(exc)})

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")

# ───────────────────────── 8. Dev runner ───────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

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

from prompt_template import build_prompt, build_plan_prompt, build_intent_prompt, build_info_prompt
from retrieval import get_domino_snippets
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
PLAN_CONFIG = {
    "temperature": 0.1,
    "response_mime_type": "application/json",
}

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
def _as_hit_dict(obj: Any) -> Dict[str, Any]:
    """Return Chroma-shaped dict no matter what was passed in."""
    if isinstance(obj, dict):
        return obj
    manifests: List[Dict[str, Any]] = obj
    ids        = [d["id"] for d in manifests]
    distances  = [1.0] * len(manifests)
    metadatas  = [{"category": d["category"], "label": d["label"]} for d in manifests]
    docs_json  = [json.dumps(d, separators=(",", ":")) for d in manifests]
    return {
        "ids":        [ids],
        "distances":  [distances],
        "metadatas":  [metadatas],
        "documents":  [docs_json],
        "embeddings": None,
        "uris":       None,
        "data":       None,
    }


def merge_rag_hits(hit1_json: str, hit2_json: str) -> str:
    """Merge two hits into one, preserving first-seen order."""
    h1 = _as_hit_dict(json.loads(hit1_json))
    h2 = _as_hit_dict(json.loads(hit2_json))

    out: Dict[str, Any] = {k: [[]] for k in ("ids", "distances", "metadatas", "documents")}
    out["embeddings"] = h1.get("embeddings") or h2.get("embeddings")
    out["uris"]       = h1.get("uris")       or h2.get("uris")
    out["data"]       = h1.get("data")       or h2.get("data")

    seen: Set[str] = set()

    def _append(src: Dict[str, Any]) -> None:
        for i, did in enumerate(src["ids"][0]):
            if did in seen:
                continue
            out["ids"][0].append(did)
            out["distances"][0].append(src["distances"][0][i])
            out["metadatas"][0].append(src["metadatas"][0][i])
            out["documents"][0].append(src["documents"][0][i])
            seen.add(did)

    _append(h1)
    _append(h2)
    return json.dumps(out, separators=(",", ":"))


def _docs_list_from_hit(hit_json: str) -> List[Dict[str, Any]]:
    obj = json.loads(hit_json)
    if isinstance(obj, list):
        return obj
    return [json.loads(s) for s in obj.get("documents", [[]])[0]]


def parse_model_payload(raw: str) -> Dict[str, Any]:
    """
    With response_mime_type=application/json the model returns valid JSON directly.
    safe_json_loads is kept as a belt-and-braces fallback.
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
    except JSONDecodeError as exc:
        snippet = cleaned[:240].replace("\n", " ")
        raise ValueError(f"Gemini JSON parse failed ({exc.msg}). Snippet: {snippet}") from exc


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


def build_retrieval_query(prompt: PromptIn) -> str:
    """
    Expand the retrieval query with existing node types and recent revision context.
    """
    parts: List[str] = [prompt.text.strip()]

    current = prompt.current_json or {}
    node_types = {
        node.get("type", "")
        for node in current.get("nodes", []) or []
        if isinstance(node, dict) and node.get("type")
    }
    if node_types:
        parts.append("existing nodes: " + ", ".join(sorted(node_types)))

    if prompt.revision_log:
        recent = [msg for msg in prompt.revision_log[-3:] if msg]
        parts.extend(recent)

    query = " ".join(p for p in parts if p).strip()
    return query or "dominofy domino"

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


def generate_info_response(prompt: PromptIn, hit_json: str) -> Dict[str, Any]:
    """
    Generate a plain-language answer for informational queries.
    Returns an AIResponseOut-compatible dict with empty nodes/edges.
    """
    docs_list = _docs_list_from_hit(hit_json)
    manifests_json = json.dumps(docs_list)
    info_prompt = build_info_prompt(manifests_json, prompt)
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


# ───────────────────────── 4b. Stage-1: Planner ─────────────────
def plan_domino_types(prompt: PromptIn, known_ids: Set[str]) -> List[str]:
    """
    Lightweight Stage-1: ask the model which domino types it will need.
    Returns only IDs present in known_ids so the result is always safe.
    """
    plan_prompt = build_plan_prompt(sorted(known_ids), prompt)
    try:
        result = generate_content_with_fallback(plan_prompt, PLAN_CONFIG)
        planned = json.loads(result.text)
        if isinstance(planned, list):
            return [t for t in planned if isinstance(t, str) and t in known_ids]
    except Exception:
        pass
    return []


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

# ───────────────────────── 5. Core RAG (sync) ───────────────────
def generate_with_rag(prompt: PromptIn, hit_json: str) -> Dict[str, Any]:
    """
    Intent-aware two-stage blocking implementation:

    Intent check — if the user is asking an informational question, answer it
                   directly without generating workflow nodes/edges.

    Stage 1 — Plan: identify which domino types are needed.
               Any planned type not yet in the retrieved docs triggers a
               targeted second retrieval (generalises the old iterator/
               deconstructor special-case to ALL missing types).

    Stage 2 — Generate: full workflow generation with enriched docs.
    """
    # ── Intent detection ────────────────────────────────────────
    intent = detect_intent(prompt)
    if intent == "informational":
        return generate_info_response(prompt, hit_json)

    docs_list = _docs_list_from_hit(hit_json)
    known_ids = {d["id"] for d in docs_list}

    stage_summaries: List[str] = []

    # ── Stage 1: plan ──────────────────────────────────────────
    planned_types = plan_domino_types(prompt, known_ids)
    if planned_types:
        stage_summaries.append(
            f"Identified {len(planned_types)} required component type(s): {', '.join(planned_types)}"
        )
    else:
        stage_summaries.append("Planning stage: deriving component types from context")

    missing = set(planned_types) - known_ids

    if missing:
        stage_summaries.append(
            f"Fetching documentation for {len(missing)} missing type(s): {', '.join(sorted(missing))}"
        )
        extra_query = " ".join(sorted(missing))
        extra_hit   = get_domino_snippets(top_k=len(missing) + 4, query=extra_query)
        hit_json    = merge_rag_hits(hit_json, extra_hit)
        docs_list   = _docs_list_from_hit(hit_json)
        known_ids   = {d["id"] for d in docs_list}
        stage_summaries.append(
            f"Retrieved documentation for {len(docs_list)} component type(s) total"
        )

    # ── Stage 2: generate ──────────────────────────────────────
    stage_summaries.append("Generating workflow with enriched component context")
    manifests_json = json.dumps(docs_list)
    full_prompt    = build_prompt(manifests_json, prompt)
    response_text, model_thought_summaries = generate_content_with_thought_summaries(full_prompt)
    payload        = parse_model_payload(response_text)

    payload = finalize_generation_payload(payload, known_ids)

    stage_summaries.append(
        f"Built {len(payload.get('nodes', []))} node(s) and {len(payload.get('edges', []))} edge(s)"
    )
    thought_summaries = model_thought_summaries or stage_summaries
    payload["thought_summaries"] = thought_summaries
    payload["chain_of_thought"] = thought_summaries

    return payload

# ───────────────────────── 6. Async wrappers ───────────────────
async def _run_blocking(func, *args):
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_RAG_EXECUTOR, partial(func, *args))


async def get_domino_snippets_async(top_k: int, query: str) -> str:
    return await _run_blocking(get_domino_snippets, top_k, query)


async def generate_with_rag_async(prompt: PromptIn, hit_json: str) -> Dict[str, Any]:
    return await _run_blocking(generate_with_rag, prompt, hit_json)


async def stream_generate_with_rag(prompt: PromptIn) -> AsyncIterator[bytes]:
    search_query = build_retrieval_query(prompt)
    yield encode_stream_event(
        "status",
        {
            "status": "retrieving_context",
            "message": "Retrieving workflow component context",
        },
    )

    first_hit = await get_domino_snippets_async(12, search_query)
    docs_list = _docs_list_from_hit(first_hit)
    known_ids = {d["id"] for d in docs_list}

    yield encode_stream_event(
        "status",
        {
            "status": "planning",
            "message": f"Analysing your request.",
        },
    )

    # ── Intent detection ────────────────────────────────────────
    intent = await _run_blocking(detect_intent, prompt)
    if intent == "informational":
        yield encode_stream_event(
            "status",
            {"status": "answering", "message": "Preparing your answer..."},
        )
        info_result = await _run_blocking(generate_info_response, prompt, first_hit)
        yield encode_stream_event(
            "thought_summaries",
            {"thought_summaries": [], "source": "fallback"},
        )
        yield encode_stream_event("result", info_result)
        return

    planned_types = await _run_blocking(plan_domino_types, prompt, known_ids)
    stage_summaries: List[str] = []
    if planned_types:
        planning_summary = (
            f"Identified {len(planned_types)} required component type(s): {', '.join(planned_types)}"
        )
    else:
        planning_summary = "Planning stage: deriving component types from context"
    stage_summaries.append(planning_summary)
    yield encode_stream_event(
        "thought_summaries",
        {
            "thought_summaries": stage_summaries,
            "source": "fallback",
        },
    )

    missing = set(planned_types) - known_ids
    if missing:
        fetching_summary = (
            f"Fetching documentation for {len(missing)} missing type(s): {', '.join(sorted(missing))}"
        )
        stage_summaries.append(fetching_summary)
        yield encode_stream_event(
            "status",
            {
                "status": "retrieving_missing_context",
                "message": fetching_summary,
            },
        )
        yield encode_stream_event(
            "thought_summaries",
            {
                "thought_summaries": stage_summaries,
                "source": "fallback",
            },
        )
        extra_query = " ".join(sorted(missing))
        extra_hit = await get_domino_snippets_async(len(missing) + 4, extra_query)
        merged_hit = merge_rag_hits(first_hit, extra_hit)
        docs_list = _docs_list_from_hit(merged_hit)
        known_ids = {d["id"] for d in docs_list}
        first_hit = merged_hit
        retrieved_summary = f"Retrieved documentation for {len(docs_list)} component type(s) total"
        stage_summaries.append(retrieved_summary)
        yield encode_stream_event(
            "thought_summaries",
            {
                "thought_summaries": stage_summaries,
                "source": "fallback",
            },
        )

    generation_summary = "Generating workflow with enriched component context"
    stage_summaries.append(generation_summary)
    yield encode_stream_event(
        "status",
        {
            "status": "generating",
            "message": generation_summary,
        },
    )
    yield encode_stream_event(
        "thought_summaries",
        {
            "thought_summaries": stage_summaries,
            "source": "fallback",
        },
    )

    manifests_json = json.dumps(docs_list)
    full_prompt = build_prompt(manifests_json, prompt)
    response_text, model_thought_summaries = await _run_blocking(
        generate_content_with_thought_summaries,
        full_prompt,
    )
    payload = parse_model_payload(response_text)
    payload = finalize_generation_payload(payload, known_ids)

    completed_summary = (
        f"Built {len(payload.get('nodes', []))} node(s) and {len(payload.get('edges', []))} edge(s)"
    )
    stage_summaries.append(completed_summary)
    thought_summaries = model_thought_summaries or stage_summaries

    yield encode_stream_event(
        "thought_summaries",
        {
            "thought_summaries": thought_summaries,
            "source": "gemini" if model_thought_summaries else "fallback",
        },
    )

    payload["thought_summaries"] = thought_summaries
    payload["chain_of_thought"] = thought_summaries
    yield encode_stream_event("result", payload)

# ───────────────────────── 7. FastAPI route ────────────────────
@app.post("/generate", tags=["ai"])
async def generate(prompt: PromptIn):
    """
    1️⃣  async retrieval (top-12 semantic + keyword hybrid)
    2️⃣  async two-stage RAG (plan → targeted retrieval → generate)
    3️⃣  pydantic validation
    """
    try:
        search_query = build_retrieval_query(prompt)
        first_hit    = await get_domino_snippets_async(12, search_query)
        ai_json      = await generate_with_rag_async(prompt, first_hit)
        validated    = AIResponseOut.parse_obj(ai_json)
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

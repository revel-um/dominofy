from __future__ import annotations
"""
ai_service_py/main.py — Dominofy AI gateway (v1.4 async)
────────────────────────────────────────────────────────
* FastAPI micro-service that calls **Gemini 2.5 Flash**
* Two-layer RAG with Chroma similarity search
* Blocking work is executed inside a dedicated thread-pool to keep requests independent.
"""
import atexit
import asyncio
import json
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from functools import partial
from typing import Any, Dict, List, Set

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
import google.generativeai as genai

from prompt_template import build_prompt
from retrieval import get_domino_snippets  # synchronous helper
from schema import PromptIn, AIResponseOut, safe_json_loads
from json import JSONDecodeError

# ───────────────────────── 1. Auth / SDK ─────────────────────────
load_dotenv()
API_KEY = os.getenv("GOOGLE_API_KEY")
genai.configure(api_key=API_KEY)            # ADC if key is None

GEN_MODEL = os.getenv("GEN_MODEL", "models/gemini-2.5-flash")
GEN_TEMPERATURE = float(os.getenv("GEN_TEMPERATURE", "0.15"))
GEN_CONFIG = {"temperature": GEN_TEMPERATURE}
MODEL = genai.GenerativeModel(GEN_MODEL)

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
app = FastAPI(title="Dominofy AI Service", version="1.4.0")


@app.get("/ping", tags=["health"])
def ping() -> Dict[str, str]:
    return {
        "status": "ok",
        "model":  GEN_MODEL,
        "auth":   "api_key" if API_KEY else "ADC"
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
    h1, h2 = _as_hit_dict(json.loads(hit1_json)), _as_hit_dict(json.loads(hit2_json))

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
    Guardrail for Gemini responses so we can surface useful errors instead of
    opaque JSON decode failures inside the FastAPI route.
    """
    cleaned = (raw or "").strip()
    if not cleaned:
        raise ValueError("Gemini returned an empty response.")
    try:
        return safe_json_loads(cleaned)
    except JSONDecodeError as exc:
        snippet = cleaned[:240].replace("\n", " ")
        raise ValueError(f"Gemini JSON parse failed ({exc.msg}). Snippet: {snippet}") from exc


def build_retrieval_query(prompt: PromptIn) -> str:
    """
    Expand the retrieval query with the richest available context, so Chroma
    can surface dominos that align with the current workflow + revision history.
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

# ───────────────────────── 4. Core RAG (sync) ───────────────────
def generate_with_rag(prompt: PromptIn,
                      hit_json: str,
                      attempt: int = 1) -> Dict[str, Any]:
    """
    Blocking implementation used inside to_thread.run_sync.
    """
    manifests_json = json.dumps(_docs_list_from_hit(hit_json))
    full_prompt    = build_prompt(manifests_json, prompt)

    result  = MODEL.generate_content(full_prompt, generation_config=GEN_CONFIG)
    payload = parse_model_payload(result.text)

    known_ids = {d["id"] for d in _docs_list_from_hit(hit_json)}
    ts        = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")

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

    have = {n["type"] for n in good_nodes}
    need = {"iterator", "deconstructor"}

    if need <= have or attempt == 2:
        payload["status"] = payload.get("status",
                                        "completely_generated" if need <= have else "partially_generated")
        return payload

    # second pass
    second_hit = get_domino_snippets(top_k=8, query=" ".join(sorted(need - have)))
    merged_hit = merge_rag_hits(hit_json, second_hit)
    return generate_with_rag(prompt, merged_hit, attempt=2)

# ───────────────────────── 5. Async wrappers ───────────────────
async def _run_blocking(func, *args):
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_RAG_EXECUTOR, partial(func, *args))


async def get_domino_snippets_async(top_k: int, query: str) -> str:
    return await _run_blocking(get_domino_snippets, top_k, query)


async def generate_with_rag_async(prompt: PromptIn, hit_json: str) -> Dict[str, Any]:
    return await _run_blocking(generate_with_rag, prompt, hit_json)

# ───────────────────────── 6. FastAPI route ────────────────────
@app.post("/generate", tags=["ai"])
async def generate(prompt: PromptIn):
    """
    1️⃣ async retrieval,
    2️⃣ async two-layer RAG,
    3️⃣ pydantic validation.
    """
    try:
        search_query = build_retrieval_query(prompt)
        first_hit = await get_domino_snippets_async(12, search_query)
        ai_json   = await generate_with_rag_async(prompt, first_hit)
        validated = AIResponseOut.parse_obj(ai_json)
        return validated.dict()
    except Exception as exc:
        raise HTTPException(500, detail=str(exc)) from exc

# ───────────────────────── 7. Dev runner ───────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

from __future__ import annotations
"""
ai_service_py/main.py — Dominofy AI gateway (v1.3 async)
────────────────────────────────────────────────────────
* FastAPI micro-service that calls **Gemini 2.5 Flash**
* Two-layer RAG with Chroma similarity search
* All blocking work (Chroma + Gemini SDK) is now off-loaded to a thread-pool
  via anyio.to_thread, so the FastAPI event-loop stays non-blocking.
"""
import json, os, re
from datetime import datetime, timezone
from typing import Any, Dict, List, Set

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
import google.generativeai as genai
from anyio import to_thread

from prompt_template import build_prompt
from retrieval        import get_domino_snippets           # synchronous helper
from schema           import PromptIn, AIResponseOut, safe_json_loads

# ───────────────────────── 1. Auth / SDK ─────────────────────────
load_dotenv()
API_KEY = os.getenv("GOOGLE_API_KEY")
genai.configure(api_key=API_KEY)            # ADC if key is None

GEN_MODEL = os.getenv("GEN_MODEL", "models/gemini-2.5-flash")

# ───────────────────────── 2. FastAPI app ───────────────────────
app = FastAPI(title="Dominofy AI Service", version="1.3.0")


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

# ───────────────────────── 4. Core RAG (sync) ───────────────────
def generate_with_rag(prompt: PromptIn,
                      hit_json: str,
                      attempt: int = 1) -> Dict[str, Any]:
    """
    Blocking implementation used inside to_thread.run_sync.
    """
    manifests_json = json.dumps(_docs_list_from_hit(hit_json))
    full_prompt    = build_prompt(manifests_json, prompt)

    model   = genai.GenerativeModel(GEN_MODEL)
    result  = model.generate_content(full_prompt, generation_config={"temperature": 0.15})
    payload = safe_json_loads(result.text)

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
async def get_domino_snippets_async(top_k: int, query: str) -> str:
    return await to_thread.run_sync(get_domino_snippets, top_k, query)

async def generate_with_rag_async(prompt: PromptIn, hit_json: str) -> Dict[str, Any]:
    return await to_thread.run_sync(generate_with_rag, prompt, hit_json)

# ───────────────────────── 6. FastAPI route ────────────────────
@app.post("/generate", tags=["ai"])
async def generate(prompt: PromptIn):
    """
    1️⃣ async retrieval,
    2️⃣ async two-layer RAG,
    3️⃣ pydantic validation.
    """
    try:
        first_hit = await get_domino_snippets_async(12, prompt.text)
        ai_json   = await generate_with_rag_async(prompt, first_hit)
        validated = AIResponseOut.parse_obj(ai_json)
        return validated.dict()
    except Exception as exc:
        raise HTTPException(500, detail=str(exc)) from exc

# ───────────────────────── 7. Dev runner ───────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

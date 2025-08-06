from __future__ import annotations
"""
ai_service_py/main.py — Dominofy AI gateway (v1.2)
────────────────────────────────────────────────────────
* FastAPI micro-service that calls **Gemini 2.5 Flash**
* Two-layer RAG with Chroma similarity search
* Now keeps the *full* Chroma-shape hit (ids / distances / …)
  and merges hit-1 + hit-2 with order-preserving de-duplication.
"""
import json, os, re
from datetime import datetime, timezone
from typing import Any, Dict, List

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
import google.generativeai as genai

from prompt_template import build_prompt
from retrieval        import get_domino_snippets           # now returns full hit JSON
from schema           import PromptIn, AIResponseOut, safe_json_loads

# ───────────────────────── 1. Auth / SDK ─────────────────────────
load_dotenv()
API_KEY = os.getenv("GOOGLE_API_KEY")
if API_KEY:
    genai.configure(api_key=API_KEY)
else:
    genai.configure()                                      # ADC / service-account

GEN_MODEL = os.getenv("GEN_MODEL", "models/gemini-2.5-flash")

# ───────────────────────── 2. FastAPI app ───────────────────────
app = FastAPI(title="Dominofy AI Service", version="1.2.0")


@app.get("/ping", tags=["health"])
def ping() -> Dict[str, str]:
    return {"status": "ok",
            "model": GEN_MODEL,
            "auth": "api_key" if API_KEY else "ADC"}

# ─────────── main.py  – replace ONLY this helper ────────────
def _as_hit_dict(obj: Any) -> Dict[str, Any]:
    """
    Accept either:
      • Chroma hit dict  {"ids":[[...]],"distances":[[...]],...}
      • Raw list         [{"id":"readexcel", ...}, ...]
    and return a Chroma-shaped dict so downstream code can call .get().
    """
    if isinstance(obj, dict):                         # already Chroma shape
        return obj

    # Plain list → wrap
    manifests: List[Dict[str, Any]] = obj
    ids        = [d["id"] for d in manifests]
    distances  = [1.0] * len(manifests)              # dummy distance
    metadatas  = [{"category": d["category"], "label": d["label"]}
                  for d in manifests]
    docs_json  = [json.dumps(d, separators=(",", ":")) for d in manifests]
    return {
        "ids":       [ids],
        "distances": [distances],
        "metadatas": [metadatas],
        "documents": [docs_json],
        "embeddings": None,
        "uris":       None,
        "data":       None,
    }


def merge_rag_hits(hit1_json: str, hit2_json: str) -> str:
    """
    Merge two RAG hits into one Chroma-style JSON string,
    de-duplicating by domino id and preserving first-seen order.
    """
    h1 = _as_hit_dict(json.loads(hit1_json or "[]"))
    h2 = _as_hit_dict(json.loads(hit2_json or "[]"))

    out = {k: [[]] for k in ("ids", "distances", "metadatas", "documents")}
    out["embeddings"] = h1.get("embeddings") or h2.get("embeddings")
    out["uris"]       = h1.get("uris")       or h2.get("uris")
    out["data"]       = h1.get("data")       or h2.get("data")

    seen: set[str] = set()

    def _append(src: Dict[str, Any]) -> None:
        for i, domino_id in enumerate(src["ids"][0]):
            if domino_id in seen:
                continue
            out["ids"][0].append(domino_id)
            out["distances"][0].append(src["distances"][0][i])
            out["metadatas"][0].append(src["metadatas"][0][i])
            out["documents"][0].append(src["documents"][0][i])
            seen.add(domino_id)

    _append(h1)
    _append(h2)
    return json.dumps(out, separators=(",", ":"))

# main.py  – helper section
def _docs_list_from_hit(hit_json: str) -> List[Dict[str, Any]]:
    """
    Accept both shapes:
      • Chroma hit  → {"documents":[["{...}"]]}
      • Raw list    → [{"id":"readexcel", ...}, ...]
    and return a list[dict] of domino manifests.
    """
    obj = json.loads(hit_json)

    # 🔹 NEW: tolerate plain-list input
    if isinstance(obj, list):
        return obj                                 # already manifests

    # Chroma-style dict
    docs_json = obj.get("documents", [[]])[0]
    return [json.loads(s) for s in docs_json]

# ───────────────────────── 4. Core RAG loop ─────────────────────
def generate_with_rag(prompt: PromptIn,
                      hit_json: str,
                      attempt: int = 1) -> Dict[str, Any]:
    """
    Single or two-pass RAG:
    1) build prompt from current hit_json,
    2) if result missing critical dominos → second pass
    """
    try:
        # ---------- Build prompt ----------
        manifests_json = json.dumps(_docs_list_from_hit(hit_json))
        prompt_txt     = build_prompt(manifests_json, prompt)

        # ---------- Call Gemini ----------
        model   = genai.GenerativeModel(GEN_MODEL)
        result  = model.generate_content(prompt_txt,
                                         generation_config={"temperature": 0.15})
        payload = safe_json_loads(result.text)

        # ---------- Safety filter ----------
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

        # ---------- Done? ----------
        have = {n["type"] for n in good_nodes}
        need = {"iterator", "deconstructor"}               # extend if desired

        if need <= have:                                   # ✅ all present
            payload["status"] = payload.get("status",
                                            "completely_generated")
            return payload

        # ---------- Second pass ----------
        if attempt == 1:
            # Targeted second retrieval by missing ids
            second_hit = get_domino_snippets(
                top_k=8, query=" ".join(sorted(need - have)))
            merged_hit = merge_rag_hits(hit_json, second_hit)
            return generate_with_rag(prompt, merged_hit, attempt=2)

        # give up after 2 attempts
        payload["status"] = payload.get("status",
                                        "partially_generated")
        return payload

    except Exception as exc:
        raise HTTPException(500, detail=str(exc)) from exc

# ───────────────────────── 5. FastAPI route ────────────────────
@app.post("/generate", tags=["ai"])
async def generate(prompt: PromptIn):
    """
    1️⃣ Retrieve top-k dominos,
    2️⃣ Two-layer RAG generation,
    3️⃣ pydantic validation.
    """
    try:
        first_hit = await get_domino_snippets(top_k=12, query=prompt.text)
        ai_json   = await generate_with_rag(prompt, first_hit)
        validated = AIResponseOut.parse_obj(ai_json)
        return validated.dict()
    except Exception as exc:
        raise HTTPException(500, detail=str(exc)) from exc

# ───────────────────────── 6. Dev runner ───────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

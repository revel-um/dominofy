from __future__ import annotations
"""ai_service_py/main.py — Dominofy AI gateway (v1.1)
────────────────────────────────────────────────────────
* FastAPI micro-service that calls **Gemini 2.5 Flash**
* Retrieves top-K relevant domino definitions via Chroma similarity search
* Builds a strict prompt (see prompt_template.py)
* Filters out nodes whose `type` is not present in DOMINO_DOCS
* Enforces `<domino-id>-<timestamp>` id rule if missing
* Validates against pydantic `AIResponseOut` before returning
"""

import json, os, sys, re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
import google.generativeai as genai

from prompt_template import build_prompt
from retrieval import get_domino_snippets
from schema import PromptIn, AIResponseOut, safe_json_loads

# ───────────────────────── 1. Auth / SDK ─────────────────────────
load_dotenv()
API_KEY = os.getenv("GOOGLE_API_KEY")
if API_KEY:
    genai.configure(api_key=API_KEY)
else:
    genai.configure()  # ADC / service-account

GEN_MODEL = os.getenv("GEN_MODEL", "models/gemini-2.5-flash")

# ───────────────────────── 2. FastAPI app ───────────────────────
app = FastAPI(title="Dominofy AI Service", version="1.1.0")

@app.get("/ping", tags=["health"])
def ping() -> Dict[str, str]:
    return {"status": "ok", "model": GEN_MODEL, "auth": "api_key" if API_KEY else "ADC"}


@app.post("/generate", tags=["ai"])
def generate(prompt: PromptIn):
    """Generate updated workflow JSON + explanation."""
    try:
        # 1️⃣  Retrieve relevant dominos
        domino_docs = get_domino_snippets(top_k=8, query=prompt.text)
        known_ids   = {d["id"] for d in json.loads(domino_docs)}

        # 2️⃣  Build prompt
        full_prompt = build_prompt(domino_docs, prompt)

        # 3️⃣  Gemini call
        model  = genai.GenerativeModel(GEN_MODEL)
        result = model.generate_content(full_prompt, generation_config={"temperature": 0.15})

        # 4️⃣  Parse (strip fences)
        payload = safe_json_loads(result.text)

        # 5️⃣  Safety filter: keep only nodes whose type is in DOMINO_DOCS
        ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        filtered_nodes = []
        for n in payload.get("nodes", []):
            if n.get("type") in known_ids:
                if "-" not in n.get("id", ""):
                    n["id"] = f"{n['type']}-{ts}"
                filtered_nodes.append(n)
        payload["nodes"] = filtered_nodes
        payload["edges"] = [
            e for e in payload.get("edges", [])
            if e.get("source") in {n["id"] for n in filtered_nodes}
            and e.get("target") in {n["id"] for n in filtered_nodes}
        ]

        # 6️⃣  Schema validation
        validated = AIResponseOut.parse_obj(payload)
        return validated.dict()

    except Exception as exc:
        raise HTTPException(500, detail=str(exc)) from exc

# ───────────────────────── 3. Dev runner ────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
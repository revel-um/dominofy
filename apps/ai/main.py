from __future__ import annotations
"""ai_service_py/main.py
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
FastAPI micro‑service exposing `/generate` that calls **Gemini 2.5 Flash**.

Environment variables
─────────────────────
GOOGLE_APPLICATION_CREDENTIALS  absolute path to service‑account JSON (preferred)
GOOGLE_API_KEY                  optional user key for local dev
GEN_MODEL                       override generation model id (default: gemini-2.5-flash)

The `/generate` endpoint is a trivial smoke‑test that sends a prompt to Gemini
and returns the model's response so you can verify credentials + quota.
Replace the prompt logic with your RAG flow once embedding code is ready.
"""

import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import google.generativeai as genai

# ──────────────────────────────── 1. .env / credential sanity ────────────────────────────────
load_dotenv()  # loads .env if present

# cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
# if cred_path and not Path(cred_path).expanduser().exists():
#     sys.exit(f"✖ GOOGLE_APPLICATION_CREDENTIALS points to '{cred_path}' but file is missing.")

api_key = os.getenv("GOOGLE_API_KEY")  # fine for quick tests

try:
    genai.configure(api_key=api_key)  # if api_key is None, SDK uses ADC from service‑account
except Exception as e:
    sys.exit(f"Failed to initialise Google GenAI SDK → {e}")

# default to Gemini 2.5 Flash unless overridden
GEN_MODEL = os.getenv("GEN_MODEL", "gemini-2.5-flash")

# ──────────────────────────────── 2. FastAPI scaffolding ────────────────────────────────
app = FastAPI(title="Dominofy AI Service", version="0.2.0")


class Prompt(BaseModel):
    text: str


@app.get("/ping", tags=["health"])
async def ping() -> dict[str, str]:
    """Liveness probe used by Docker/ECS."""
    return {"status": "ok", "model": GEN_MODEL}


@app.post("/generate", tags=["ai"])
async def generate(prompt: Prompt):
    """Echo‑test: ask Gemini 2.5 Flash to *reverse* the input text."""
    try:
        model = genai.GenerativeModel(GEN_MODEL)
        resp = model.generate_content(
            f"Reverse this text verbatim: {prompt.text}",
            generation_config={"temperature": 0.0},
        )
        return {"reversed": resp.text}
    except Exception as exc:
        raise HTTPException(500, detail=str(exc)) from exc


# ──────────────────────────────── 3. CLI helper ────────────────────────────────
if __name__ == "__main__":
    if len(sys.argv) == 2:
        demo = sys.argv[1]
        out = genai.GenerativeModel(GEN_MODEL).generate_content(
            f"Summarise in five words: {demo}",
            generation_config={"temperature": 0.2},
        )
        print(out.text)
    else:
        print("▶ Dev server running at http://127.0.0.1:8000 … (Ctrl+C to quit)")
        import uvicorn

        uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

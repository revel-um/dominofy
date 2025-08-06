from __future__ import annotations
import os, json, chromadb, google.generativeai as genai
from typing import List

EMB_MODEL  = "models/embedding-001"
REF_PATH   = os.getenv("DOMINO_DOC_PATH", "domino_reference.json")
CHROMA_DIR = os.getenv("CHROMA_DIR", "./chroma")

client     = chromadb.PersistentClient(path=CHROMA_DIR)
col        = client.get_or_create_collection("dominofy_dominos")
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

def _embed(text: str) -> List[float]:
    return genai.embed_content(model=EMB_MODEL, content=text)["embedding"]

def get_domino_snippets(top_k: int, query: str = "") -> str:
    if col.count() == 0:                           # first run fallback
        with open(REF_PATH) as f:
            return json.dumps(json.load(f)[:top_k])

    vec   = _embed(query or "dominofy domino")
    hits  = col.query(query_embeddings=[vec], n_results=top_k)
    print(hits)
    # documents is a List[List[str]]  → parse each JSON string back to dict
    docs  = [json.loads(s) for s in hits["documents"][0]]
    return json.dumps(docs)
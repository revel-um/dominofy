from __future__ import annotations
import os, json, chromadb, google.generativeai as genai
from typing import List

EMB_MODEL  = "models/gemini-embedding-001"
REF_PATH   = os.getenv("DOMINO_DOC_PATH", "domino_reference.json")
CHROMA_DIR = os.getenv("CHROMA_DIR", "./chroma")

client     = chromadb.PersistentClient(path=CHROMA_DIR)
col        = client.get_or_create_collection("dominofy_dominos")
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

def _embed(text: str) -> List[float]:
    return genai.embed_content(model=EMB_MODEL, content=text)["embedding"]

def _keyword_ranked_docs(query: str) -> List[dict]:
    with open(REF_PATH, encoding="utf-8") as f:
        docs = json.load(f)

    if not query:
        return docs

    tokens = {t.lower() for t in query.split() if t}

    def _score(d: dict) -> int:
        score = 0
        doc_id    = (d.get("id") or "").lower()
        label     = (d.get("label") or "").lower()
        desc      = (d.get("description") or "").lower()
        keywords  = [k.lower() for k in d.get("keywords", [])]

        for tok in tokens:
            if tok == doc_id:
                score += 4                # exact id match
            if tok in keywords:
                score += 3                # keyword match
            if tok in label:
                score += 2                # label contains token
            if tok in desc:
                score += 1                # description contains token
        return score

    docs = sorted(enumerate(docs), key=lambda pair: (-_score(pair[1]), pair[0]))
    return [d for _, d in docs]


def get_domino_snippets(top_k: int, query: str = "") -> str:
    keyword_docs = _keyword_ranked_docs(query)

    # first run fallback
    if col.count() == 0:
        return json.dumps(keyword_docs[:top_k])

    vec   = _embed(query or "dominofy domino")
    hits  = col.query(query_embeddings=[vec], n_results=top_k)
    print(hits)
    # documents is a List[List[str]]  → parse each JSON string back to dict
    docs  = [json.loads(s) for s in hits.get("documents", [[]])[0]]

    seen = {d.get("id") for d in docs}
    for d in keyword_docs:
        if d.get("id") in seen:
            continue
        docs.append(d)
        seen.add(d.get("id"))
        if len(docs) >= top_k:
            break
    return json.dumps(docs[:top_k])

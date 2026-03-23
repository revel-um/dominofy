import json, os, chromadb, google.generativeai as genai
from dotenv import load_dotenv
load_dotenv()

EMB_MODEL  = "models/gemini-embedding-001"
REF_PATH   = os.getenv("DOMINO_DOC_PATH", "domino_reference.json")
CHROMA_DIR = os.getenv("CHROMA_DIR", "./chroma")

os.environ["ANONYMOUS_TELEMETRY"] = "False"
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

client      = chromadb.PersistentClient(path=CHROMA_DIR)
collection  = client.get_or_create_collection("dominofy_dominos")

def embed(text: str):
    return genai.embed_content(model=EMB_MODEL, content=text)["embedding"]

def main():
    with open(REF_PATH, encoding="utf-8") as f:
        docs = json.load(f)

    for d in docs:
        doc_json = json.dumps(d, separators=(",", ":"))       # ← full domino as string
        vec      = embed(f"{d['label']} — {d['description']}")

        collection.upsert(
            ids         =[d["id"]],
            embeddings  =[vec],
            metadatas   =[{"label": d["label"], "category": d["category"]}],  # primitives only
            documents   =[doc_json],   # ← store full object here
        )

    print(f"✅ Embedded {len(docs)} domino docs into {CHROMA_DIR}")

if __name__ == "__main__":
    main()
from __future__ import annotations

import os
from typing import List, Dict, Any

import weaviate
from weaviate.connect import ConnectionParams
from sentence_transformers import SentenceTransformer
from llama_cpp import Llama


# ---------- Config ----------
WEAVIATE_HTTP_URL = "http://localhost:8080"
WEAVIATE_GRPC_PORT = 50051
COLLECTION = "CustomerFeedback"

EMBED_MODEL = "all-MiniLM-L6-v2"

# Point this at your downloaded GGUF
MISTRAL_GGUF_PATH = "models/mistral-7b-instruct-v0.2.Q5_K_M.gguf"

# Context window: increase if you have RAM (4096+ is nice; 2048 is fine)
N_CTX = 4096

# How many matches to retrieve from Weaviate
TOP_K = 6


# ---------- RAG helpers ----------
def build_context_snippets(objs: List[Dict[str, Any]]) -> str:
    """
    Format retrieved objects as short numbered snippets for the LLM.
    Keep it compact to avoid blowing your context window.
    """
    lines = []
    for i, o in enumerate(objs, start=1):
        # Properties come from Weaviate v4 object
        text = o.get("text", "").strip().replace("\n", " ")
        stage = o.get("journey_stage", "unknown")
        sentiment = o.get("sentiment", "unknown")
        source = o.get("source", "unknown")
        lines.append(f"{i}. ({stage}, {sentiment}, {source}) {text}")
    return "\n".join(lines)


def make_mistral_inst_prompt(question: str, context: str) -> str:
    """
    Mistral Instruct expects [INST] ... [/INST] format.
    This prompt pushes it to output only plain text, no meta, no summary section.
    """
    system_rules = (
        "You are a customer insights assistant.\n"
        "Use ONLY the provided CONTEXT.\n"
        "Answer in plain text.\n"
        "Do NOT include headings like 'Summary' or 'Overview'.\n"
        "Do NOT mention that you used context or documents.\n"
        "If the context is insufficient, say: 'Not enough information in the data.'\n"
    )

    return (
        f"[INST] {system_rules}\n"
        f"CONTEXT:\n{context}\n\n"
        f"QUESTION:\n{question}\n\n"
        f"Answer plainly. [/INST]"
    )


def query_weaviate(client: weaviate.WeaviateClient, embedder: SentenceTransformer, question: str, top_k: int):
    col = client.collections.get(COLLECTION)

    qvec = embedder.encode(question).tolist()

    res = col.query.near_vector(
        near_vector=qvec,
        limit=top_k,
        return_properties=["text", "source", "sentiment", "journey_stage"],
    )

    # v4 returns objects; pull out properties dicts
    return [obj.properties for obj in res.objects]


def generate_answer(llm: Llama, prompt: str) -> str:
    """
    llama-cpp-python completion call. Use stop tokens to avoid rambly continuations.
    """
    out = llm(
        prompt,
        max_tokens=400,
        temperature=0.2,
        top_p=0.95,
        # Stops: end of turn + avoid the model starting a new instruction
        stop=["</s>", "[INST]"],
    )
    return out["choices"][0]["text"].strip()


def main():
    # 1) Connect Weaviate (v4) safely
    client = weaviate.WeaviateClient(
        connection_params=ConnectionParams.from_url(WEAVIATE_HTTP_URL, grpc_port=WEAVIATE_GRPC_PORT)
    )

    try:
        client.connect()
        if not client.is_ready():
            raise RuntimeError("Weaviate is not ready. Is Docker container running and ports exposed?")

        # 2) Load embedding model (local)
        embedder = SentenceTransformer(EMBED_MODEL)

        # 3) Load Mistral (local)
        llm = Llama(
            model_path=MISTRAL_GGUF_PATH,
            n_ctx=N_CTX,
            # If you compiled/installed with Metal support, this usually helps:
            # n_gpu_layers=-1,  # uncomment if your build supports it
            n_gpu_layers=999,
            verbose=True,
        )

        # 4) Ask a question (replace with your own)
        question = "What are the main customer pain points in the data, and what should support fix first?"

        # Retrieve
        hits = query_weaviate(client, embedder, question, TOP_K)
        context = build_context_snippets(hits)

        # Generate
        prompt = make_mistral_inst_prompt(question, context)
        answer = generate_answer(llm, prompt)

        print("\n--- ANSWER ---\n")
        print(answer)

    finally:
        client.close()
        llm.close()


if __name__ == "__main__":
    main()
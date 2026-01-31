from __future__ import annotations

import argparse
import os
import re
import sys
from typing import Any, Dict, List, Optional, Tuple

import weaviate
import weaviate.classes as wvc
from weaviate.classes.init import Auth

from llama_cpp import Llama


# ---------- Embeddings ----------
def get_embedder(model_name: str):
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError:
        print(
            "Missing dependency: sentence-transformers\n"
            "Install with:\n"
            "  pip install -U sentence-transformers\n",
            file=sys.stderr,
        )
        raise
    return SentenceTransformer(model_name)


def embed_query(embedder, text: str) -> List[float]:
    vec = embedder.encode([text], normalize_embeddings=True, show_progress_bar=False)[0]
    return vec.tolist()


# ---------- Weaviate ----------
def connect_weaviate(host: str, port: int, grpc_port: int, api_key: Optional[str]):
    if api_key:
        client = weaviate.connect_to_local(
            host=host,
            port=port,
            grpc_port=grpc_port,
            auth_credentials=Auth.api_key(api_key),
        )
    else:
        client = weaviate.connect_to_local(host=host, port=port, grpc_port=grpc_port)

    if not client.is_ready():
        raise RuntimeError("Weaviate is not ready (check container, ports, auth).")
    return client


def clamp(s: str, n: int) -> str:
    s = (s or "").strip()
    if len(s) <= n:
        return s
    return s[: n - 1].rstrip() + "…"


def build_filters(
    require_naturalised_ok: bool,
    journey_type: Optional[str],
    outcome: Optional[str],
    sentiment: Optional[str],
    channel: Optional[str],
) -> Optional[wvc.query.Filter]:
    clauses: List[wvc.query.Filter] = []

    if require_naturalised_ok:
        clauses.append(wvc.query.Filter.by_property("naturalised_status").equal("ok"))

    if journey_type:
        clauses.append(wvc.query.Filter.by_property("journey_type").equal(journey_type))
    if outcome:
        clauses.append(wvc.query.Filter.by_property("outcome").equal(outcome))
    if sentiment:
        clauses.append(wvc.query.Filter.by_property("sentiment").equal(sentiment))
    if channel:
        clauses.append(wvc.query.Filter.by_property("channel").equal(channel))

    if not clauses:
        return None
    f = clauses[0]
    for c in clauses[1:]:
        f = f & c
    return f


# ---------- Prompting ----------
def make_rag_prompt(question: str, evidences: List[Dict[str, Any]]) -> str:
    """
    Evidence-grounded prompt. We cite evidence as [E1], [E2], ...
    """
    evidence_blocks = []
    for i, ev in enumerate(evidences, start=1):
        meta = ev["meta"]
        snippet = ev["snippet"]
        evidence_blocks.append(
            f"[E{i}] event={meta.get('event_name','')} | journey={meta.get('journey_type','')} | "
            f"outcome={meta.get('outcome','')} | sentiment={meta.get('sentiment','')} | channel={meta.get('channel','')}\n"
            f"{snippet}"
        )
    evidence_text = "\n\n".join(evidence_blocks)

    rules = """
You are assisting a bank executive with insights from customer contact transcripts.
Rules:
- Answer the QUESTION using ONLY the EVIDENCE provided.
- If the evidence is insufficient, say exactly what is missing and what you would check next.
- Keep it concise, executive-friendly.
- Provide 3 sections:
  1) Key findings (bullets)
  2) What this suggests we should do (bullets)
  3) Evidence references: cite which evidence items support each point (e.g., [E1], [E2])
- Do NOT invent numbers or facts.
""".strip()

    return f"""[INST]
{rules}

QUESTION:
{question}

EVIDENCE:
{evidence_text}
[/INST]"""


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--q", required=True, help="Question")
    p.add_argument("--k", type=int, default=5, help="Top-k evidence to retrieve")
    p.add_argument("--collection", default="JourneyWorksTranscript")

    # Weaviate defaults
    p.add_argument("--host", default=os.getenv("WEAVIATE_HOST", "localhost"))
    p.add_argument("--port", type=int, default=int(os.getenv("WEAVIATE_PORT", "8080")))
    p.add_argument("--grpc-port", type=int, default=int(os.getenv("WEAVIATE_GRPC_PORT", "50051")))
    p.add_argument("--api-key", default=os.getenv("WEAVIATE_API_KEY"))

    # Embeddings
    p.add_argument("--embed-model", default=os.getenv("EMBED_MODEL", "sentence-transformers/all-MiniLM-L6-v2"))

    # Mistral GGUF (llama.cpp)
    p.add_argument("--mistral-model", default=os.getenv("MISTRAL_GGUF", "models/mistral-7b-instruct-v0.2.Q5_K_M.gguf"))
    p.add_argument("--n-ctx", type=int, default=4096)
    p.add_argument("--n-gpu-layers", type=int, default=999)
    p.add_argument("--max-tokens", type=int, default=600)
    p.add_argument("--temp", type=float, default=0.2)
    p.add_argument("--top-p", type=float, default=0.95)

    # Optional filters for demo control
    p.add_argument("--require-naturalised-ok", action="store_true", help="Only use evidence with naturalised_status=ok")
    p.add_argument("--journey-type", default=None)
    p.add_argument("--outcome", default=None)
    p.add_argument("--sentiment", default=None)
    p.add_argument("--channel", default=None)

    args = p.parse_args()
    print("rag_answer_with_mistral.py: starting", file=sys.stderr, flush=True)

    # Embed the question
    embedder = get_embedder(args.embed_model)
    qvec = embed_query(embedder, args.q)

    # Retrieve evidence
    client = connect_weaviate(args.host, args.port, args.grpc_port, args.api_key)
    try:
        if not client.collections.exists(args.collection):
            raise RuntimeError(f"Collection '{args.collection}' does not exist.")

        col = client.collections.get(args.collection)
        where = build_filters(
            args.require_naturalised_ok,
            args.journey_type,
            args.outcome,
            args.sentiment,
            args.channel,
        )

        props = ["text", "event_name", "journey_type", "sentiment", "outcome", "channel", "naturalised_status"]
        res = col.query.near_vector(
            near_vector=qvec,
            limit=args.k,
            filters=where,
            return_properties=props,
            return_metadata=wvc.query.MetadataQuery(distance=True),
        )
        objs = res.objects or []
        if not objs:
            print("No results from Weaviate.")
            return

        evidences: List[Dict[str, Any]] = []
        for obj in objs:
            pr = obj.properties or {}
            txt = pr.get("text", "") or ""
            evidences.append(
                {
                    "meta": {
                        "event_name": pr.get("event_name", ""),
                        "journey_type": pr.get("journey_type", ""),
                        "sentiment": pr.get("sentiment", ""),
                        "outcome": pr.get("outcome", ""),
                        "channel": pr.get("channel", ""),
                        "naturalised_status": pr.get("naturalised_status", ""),
                        "uuid": str(obj.uuid),
                    },
                    # keep evidence reasonably short to fit context
                    "snippet": clamp(txt, 900),
                }
            )
    finally:
        client.close()

    # Build grounded prompt
    prompt = make_rag_prompt(args.q, evidences)

    # Run Mistral
    llm = Llama(
        model_path=args.mistral_model,
        n_ctx=args.n_ctx,
        n_gpu_layers=args.n_gpu_layers,
        verbose=False,
    )
    try:
        out = llm(
            prompt,
            max_tokens=args.max_tokens,
            temperature=args.temp,
            top_p=args.top_p,
            stop=["</s>", "[INST]"],
        )
        answer = out["choices"][0]["text"].strip()
    finally:
        llm.close()

    print("\n=== ANSWER ===\n")
    print(answer)

    print("\n=== EVIDENCE LIST (for UI / debugging) ===\n")
    for i, ev in enumerate(evidences, start=1):
        m = ev["meta"]
        print(f"[E{i}] uuid={m['uuid']} naturalised={m['naturalised_status']} event={m['event_name']} journey={m['journey_type']} outcome={m['outcome']} sentiment={m['sentiment']}")

if __name__ == "__main__":
    main()


    """
    --q "What are customers disputing about mortgage rate increases, and why does it escalate?"  --k 5 --require-naturalised-ok
    """
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import uuid
from typing import Any, Dict, List, Optional, Tuple

import yaml

# ---- Weaviate v4 client imports ----
import weaviate
import weaviate.classes as wvc
from weaviate.classes.init import Auth


# ---------- YAML ----------
def load_yaml(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


# ---------- Text building ----------
def transcript_to_text(tr: Dict[str, Any]) -> str:
    """
    Single 'document' text per transcript.
    Keep it simple for MVP RAG: metadata header + dialogue.
    """
    header_bits = []
    for k in ("event_name", "journey_type", "sentiment", "outcome", "channel"):
        v = tr.get(k)
        if v:
            header_bits.append(f"{k}={v}")
    header = " | ".join(header_bits)

    lines: List[str] = []
    turns = tr.get("turns", [])
    if isinstance(turns, list):
        for t in turns:
            spk = (t.get("speaker") or "").strip()
            txt = (t.get("text") or "").strip()
            if spk and txt:
                lines.append(f"{spk}: {txt}")

    body = "\n".join(lines).strip()
    if header:
        return f"{header}\n\n{body}"
    return body


def stable_uuid_for_transcript(tr: Dict[str, Any], idx: int) -> str:
    """
    Stable UUID so re-indexing doesn't create duplicates.
    If transcript has an 'id', use it; else hash content+idx.
    """
    base = tr.get("id") or tr.get("transcript_id")
    if isinstance(base, str) and base.strip():
        name = base.strip()
    else:
        # Hash a few stable fields + first few turns
        h = hashlib.sha256()
        h.update(str(tr.get("event_name", "")).encode("utf-8"))
        h.update(str(tr.get("journey_type", "")).encode("utf-8"))
        h.update(str(tr.get("sentiment", "")).encode("utf-8"))
        h.update(str(tr.get("outcome", "")).encode("utf-8"))
        h.update(str(tr.get("channel", "")).encode("utf-8"))
        turns = tr.get("turns", [])
        if isinstance(turns, list):
            for t in turns[:6]:
                h.update(str(t.get("speaker", "")).encode("utf-8"))
                h.update(str(t.get("text", "")).encode("utf-8"))
        h.update(str(idx).encode("utf-8"))
        name = h.hexdigest()

    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"journeyworks:{name}"))


def build_properties(tr: Dict[str, Any], doc_text: str) -> Dict[str, Any]:
    """
    Properties stored as normal fields (NOT the vector).
    Keep these small, filterable, and useful.
    """
    props: Dict[str, Any] = {
        "text": doc_text,
        "event_name": tr.get("event_name") or "",
        "journey_type": tr.get("journey_type") or "",
        "sentiment": tr.get("sentiment") or "",
        "outcome": tr.get("outcome") or "",
        "channel": tr.get("channel") or "phone",
        "naturalised_status": (tr.get("naturalised") or {}).get("status", ""),
    }

    # Optional: store turns as JSON string (handy for showing evidence)
    turns = tr.get("turns")
    if isinstance(turns, list):
        props["turns_json"] = json.dumps(turns, ensure_ascii=False)

    return props


# ---------- Embeddings ----------
def get_embedder(model_name: str):
    """
    Local embedder via sentence-transformers.
    Keep it simple; you can swap model_name later.
    """
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


def embed_texts(embedder, texts: List[str]) -> List[List[float]]:
    """
    Returns Python lists (Weaviate client wants plain lists, not numpy arrays).
    """
    # normalize_embeddings=True helps similarity search stability for many models
    vecs = embedder.encode(texts, normalize_embeddings=True, show_progress_bar=False)
    # vecs may be numpy array
    return [v.tolist() for v in vecs]


# ---------- Weaviate ----------
def connect_weaviate(host: str, port: int, grpc_port: int, api_key: Optional[str]):
    """
    Connect to local Weaviate. Weaviate docs show connect_to_local() with default ports,
    and support for API key if enabled.  [oai_citation:1‡Weaviate Documentation](https://docs.weaviate.io/weaviate/connections/connect-local)
    """
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


def ensure_collection(client, name: str):
    """
    Create the collection if missing, configured for self-provided vectors (BYOV).
    Weaviate docs: vector_config=Configure.Vectors.self_provided().  [oai_citation:2‡Weaviate Documentation](https://docs.weaviate.io/weaviate/starter-guides/custom-vectors)
    """
    try:
        exists = client.collections.exists(name)
    except Exception:
        # Some older setups can be flaky; fall back to try-get
        exists = False

    if exists:
        return client.collections.get(name)

    # Create collection. We'll define a small, useful schema explicitly.
    # (Autoschema also works, but explicit is more stable for demos.)
    return client.collections.create(
        name,
        vector_config=wvc.config.Configure.Vectors.self_provided(),
        properties=[
            wvc.config.Property(name="text", data_type=wvc.config.DataType.TEXT),
            wvc.config.Property(name="event_name", data_type=wvc.config.DataType.TEXT),
            wvc.config.Property(name="journey_type", data_type=wvc.config.DataType.TEXT),
            wvc.config.Property(name="sentiment", data_type=wvc.config.DataType.TEXT),
            wvc.config.Property(name="outcome", data_type=wvc.config.DataType.TEXT),
            wvc.config.Property(name="channel", data_type=wvc.config.DataType.TEXT),
            wvc.config.Property(name="naturalised_status", data_type=wvc.config.DataType.TEXT),
            wvc.config.Property(name="turns_json", data_type=wvc.config.DataType.TEXT),
        ],
    )


def chunked(seq: List[Any], size: int):
    for i in range(0, len(seq), size):
        yield seq[i : i + size]


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--in", dest="inp", default="data/transcripts_naturalised.yaml")
    p.add_argument("--collection", default="JourneyWorksTranscript")
    p.add_argument("--host", default=os.getenv("WEAVIATE_HOST", "localhost"))
    p.add_argument("--port", type=int, default=int(os.getenv("WEAVIATE_PORT", "8080")))
    p.add_argument("--grpc-port", type=int, default=int(os.getenv("WEAVIATE_GRPC_PORT", "50051")))
    p.add_argument("--api-key", default=os.getenv("WEAVIATE_API_KEY"))
    p.add_argument("--embed-model", default=os.getenv("EMBED_MODEL", "sentence-transformers/all-MiniLM-L6-v2"))
    p.add_argument("--batch-size", type=int, default=64)
    p.add_argument("--limit", type=int, default=None)
    p.add_argument("--start", type=int, default=0)
    args = p.parse_args()

    data = load_yaml(args.inp)
    transcripts = data.get("transcripts", [])
    if not isinstance(transcripts, list):
        raise ValueError("Input YAML missing 'transcripts' list")

    subset = transcripts[args.start : (None if args.limit is None else args.start + args.limit)]
    if not subset:
        print("No transcripts to index (empty slice).")
        return

    print(f"Loading embedder: {args.embed_model}")
    embedder = get_embedder(args.embed_model)

    print(f"Connecting to Weaviate at http://{args.host}:{args.port} (gRPC {args.grpc_port})")
    client = connect_weaviate(args.host, args.port, args.grpc_port, args.api_key)

    try:
        col = ensure_collection(client, args.collection)
        print(f"Using collection: {args.collection}")

        # Build docs
        docs: List[Tuple[str, Dict[str, Any], str]] = []
        for i, tr in enumerate(subset, start=args.start):
            doc_text = transcript_to_text(tr)
            if not doc_text.strip():
                continue

            uid = stable_uuid_for_transcript(tr, idx=i)
            props = build_properties(tr, doc_text)
            docs.append((uid, props, doc_text))

        if not docs:
            print("No non-empty documents to index.")
            return

        print(f"Prepared {len(docs)} documents. Embedding + inserting in batches of {args.batch_size}...")

        inserted = 0
        for batch in chunked(docs, args.batch_size):
            uuids = [b[0] for b in batch]
            props_list = [b[1] for b in batch]
            texts = [b[2] for b in batch]

            vectors = embed_texts(embedder, texts)

            objs: List[wvc.data.DataObject] = []
            for u, props, vec in zip(uuids, props_list, vectors):
                objs.append(
                    wvc.data.DataObject(
                        uuid=u,
                        properties=props,
                        vector=vec,  # IMPORTANT: vector is not a property.  [oai_citation:3‡Weaviate Documentation](https://docs.weaviate.io/weaviate/starter-guides/custom-vectors)
                    )
                )

            res = col.data.insert_many(objs)

            # Best-effort reporting; response structure varies by client version
            inserted += len(objs)
            print(f"Inserted {inserted}/{len(docs)}")

        print("Done.")

    finally:
        client.close()


if __name__ == "__main__":
    main()
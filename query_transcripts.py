from __future__ import annotations

import argparse
import os
import sys
from typing import Any, Dict, List, Optional

import weaviate
from weaviate.classes.init import Auth
import weaviate.classes as wvc


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


def build_filters(
    journey_type: Optional[str],
    outcome: Optional[str],
    sentiment: Optional[str],
    channel: Optional[str],
) -> Optional[wvc.query.Filter]:
    """
    Build an AND filter if any filter values are provided.
    Properties must match what we indexed.
    """
    clauses: List[wvc.query.Filter] = []

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
    if len(clauses) == 1:
        return clauses[0]

    # AND them
    f = clauses[0]
    for c in clauses[1:]:
        f = f & c
    return f


def clamp(s: str, n: int) -> str:
    s = (s or "").strip()
    if len(s) <= n:
        return s
    return s[: n - 1].rstrip() + "…"


def main():
    p = argparse.ArgumentParser(description="Query Weaviate for JourneyWorks transcripts using nearVector.")
    p.add_argument("--collection", default="JourneyWorksTranscript")
    p.add_argument("--q", required=True, help="User question / search query")
    p.add_argument("--k", type=int, default=5, help="Top-k results")
    p.add_argument("--host", default=os.getenv("WEAVIATE_HOST", "localhost"))
    p.add_argument("--port", type=int, default=int(os.getenv("WEAVIATE_PORT", "8080")))
    p.add_argument("--grpc-port", type=int, default=int(os.getenv("WEAVIATE_GRPC_PORT", "50051")))
    p.add_argument("--api-key", default=os.getenv("WEAVIATE_API_KEY"))
    p.add_argument("--embed-model", default=os.getenv("EMBED_MODEL", "sentence-transformers/all-MiniLM-L6-v2"))
    p.add_argument("--journey-type", default=None)
    p.add_argument("--outcome", default=None)
    p.add_argument("--sentiment", default=None)
    p.add_argument("--channel", default=None)
    p.add_argument("--show-turns", action="store_true", help="Print stored turns_json (can be long)")
    args = p.parse_args()

    print(f"Embedding model: {args.embed_model}")
    embedder = get_embedder(args.embed_model)
    qvec = embed_query(embedder, args.q)

    print(f"Connecting to Weaviate at http://{args.host}:{args.port} (gRPC {args.grpc_port})")
    client = connect_weaviate(args.host, args.port, args.grpc_port, args.api_key)

    try:
        if not client.collections.exists(args.collection):
            raise RuntimeError(f"Collection '{args.collection}' does not exist. Run index_transcripts.py first.")

        col = client.collections.get(args.collection)

        where = build_filters(args.journey_type, args.outcome, args.sentiment, args.channel)

        # Return these properties for evidence display
        props = [
            "text",
            "event_name",
            "journey_type",
            "sentiment",
            "outcome",
            "channel",
            "naturalised_status",
            "turns_json",
        ]

        res = col.query.near_vector(
            near_vector=qvec,
            limit=args.k,
            filters=where,
            return_properties=props,
            return_metadata=wvc.query.MetadataQuery(distance=True),
        )

        objs = res.objects or []
        if not objs:
            print("No results.")
            return

        print("\n--- RESULTS ---")
        for i, obj in enumerate(objs, start=1):
            md = obj.metadata
            dist = getattr(md, "distance", None)
            props = obj.properties or {}

            # Weaviate returns distance (lower is better) when requested.
            dist_s = f"{dist:.4f}" if isinstance(dist, (int, float)) else "n/a"

            print(f"\n#{i}  distance={dist_s}  uuid={obj.uuid}")
            print(
                f"  event={props.get('event_name','')!s} | "
                f"journey={props.get('journey_type','')!s} | "
                f"outcome={props.get('outcome','')!s} | "
                f"sentiment={props.get('sentiment','')!s} | "
                f"channel={props.get('channel','')!s}"
            )
            print(f"  naturalised_status={props.get('naturalised_status','')!s}")

            text = props.get("text", "")
            print("  snippet:", clamp(text, 400))

            if args.show_turns:
                turns_json = props.get("turns_json", "")
                if turns_json:
                    print("  turns_json:", clamp(turns_json, 1200))

    finally:
        client.close()


if __name__ == "__main__":
    main()


"""
python query_transcripts.py \
  --q "Why are customers failing identity verification during onboarding?" \
  --k 5
  
  python query_transcripts.py \
  --q "What are the common reasons customers escalate to a complaint?" \
  --journey-type "complaints" \
  --outcome "escalated" \
  --k 5
  
  
  python query_transcripts.py --q "late fee dispute" --show-turns --k 3
  
    python query_transcripts.py \
  --q "What are the common reasons customers escalate to a complaint?" \
  --journey-type "pricing dispute" \
  --outcome "escalated" \
  --k 5

"""
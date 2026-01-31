from __future__ import annotations

import argparse
from typing import Any, Dict, List, Tuple

import yaml
import weaviate
from weaviate.connect import ConnectionParams
from weaviate.classes.config import Configure, Property, DataType
from fastembed import TextEmbedding


# --------------------------
# Chunking utilities
# --------------------------

def normalise_turns(turns: List[Dict[str, Any]]) -> List[Tuple[str, str]]:
    """Return list of (speaker, text) pairs."""
    out = []
    for t in turns:
        speaker = str(t.get("speaker", "")).strip() or "Unknown"
        text = str(t.get("text", "")).strip()
        if text:
            out.append((speaker, text))
    return out


def chunk_by_turns(
    turns: List[Tuple[str, str]],
    max_words: int = 220,
    overlap_turns: int = 1,
) -> List[Dict[str, Any]]:
    """
    Create chunks that contain whole turns only.
    - max_words: approx chunk size
    - overlap_turns: how many turns to overlap between chunks (helps retrieval continuity)
    Returns list of dicts: {chunk_index, text, turn_start, turn_end}
    """
    chunks: List[Dict[str, Any]] = []
    n = len(turns)
    i = 0
    chunk_index = 0

    def turn_words(s: str) -> int:
        return len(s.split())

    while i < n:
        words = 0
        start = i
        lines = []

        while i < n:
            spk, txt = turns[i]
            line = f"{spk}: {txt}"
            w = turn_words(line)
            # if adding this turn would exceed max_words and we already have content, stop
            if lines and (words + w) > max_words:
                break
            lines.append(line)
            words += w
            i += 1

        end = i - 1
        chunks.append(
            {
                "chunk_index": chunk_index,
                "text": "\n".join(lines),
                "turn_start": start,
                "turn_end": end,
            }
        )
        chunk_index += 1

        # move back for overlap (but never below 0)
        if i < n and overlap_turns > 0:
            i = max(i - overlap_turns, 0)

        # safety: ensure progress even on pathological inputs
        if i == start:
            i += 1

    return chunks


# --------------------------
# Weaviate setup
# --------------------------

def ensure_collection(client: weaviate.WeaviateClient, name: str) -> None:
    """Create collection if it does not exist."""
    if client.collections.exists(name):
        return

    client.collections.create(
        name=name,
        vectorizer_config=Configure.Vectorizer.none(),  # we provide vectors
        properties=[
            Property(name="text", data_type=DataType.TEXT),

            Property(name="transcript_id", data_type=DataType.TEXT),
            Property(name="event_id", data_type=DataType.TEXT),
            Property(name="event_name", data_type=DataType.TEXT),

            Property(name="journey_type", data_type=DataType.TEXT),
            Property(name="sentiment", data_type=DataType.TEXT),
            Property(name="outcome", data_type=DataType.TEXT),
            Property(name="channel", data_type=DataType.TEXT),

            Property(name="chunk_index", data_type=DataType.INT),
            Property(name="turn_start", data_type=DataType.INT),
            Property(name="turn_end", data_type=DataType.INT),
            Property(name="turn_count", data_type=DataType.INT),
        ],
    )


# --------------------------
# Main ingestion
# --------------------------

def load_yaml(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--in", dest="inp", required=True, help="Input YAML (hsbc_transcripts_2000.yaml)")
    parser.add_argument("--collection", default="TranscriptChunk")
    parser.add_argument("--embed_model", default="BAAI/bge-small-en-v1.5")
    parser.add_argument("--max_words", type=int, default=220)
    parser.add_argument("--overlap_turns", type=int, default=1)
    parser.add_argument("--batch_size", type=int, default=64)
    args = parser.parse_args()

    # Connect to Weaviate v4 (HTTP + gRPC)
    client = weaviate.WeaviateClient(
        connection_params=ConnectionParams.from_url("http://localhost:8080", grpc_port=50051)
    )

    try:
        client.connect()
        if not client.is_ready():
            raise RuntimeError("Weaviate is not ready at localhost. Is Docker running with ports 8080 and 50051?")

        ensure_collection(client, args.collection)
        col = client.collections.get(args.collection)

        # Embeddings (fast, local, no torch)
        embedder = TextEmbedding(args.embed_model)

        data = load_yaml(args.inp)
        transcripts = data.get("transcripts", [])
        if not isinstance(transcripts, list):
            raise ValueError("Input YAML does not contain a 'transcripts' list")

        total_chunks = 0
        texts_for_batch: List[str] = []
        objects_for_batch: List[Dict[str, Any]] = []

        def flush_batch():
            nonlocal total_chunks, texts_for_batch, objects_for_batch
            if not objects_for_batch:
                return

            vectors = list(embedder.embed(texts_for_batch))  # returns numpy arrays
            with col.batch.fixed_size(batch_size=len(objects_for_batch)) as batch:
                for obj, vec in zip(objects_for_batch, vectors):
                    batch.add_object(properties=obj, vector=vec.tolist())

            total_chunks += len(objects_for_batch)
            texts_for_batch = []
            objects_for_batch = []

        for t in transcripts:
            turns_raw = t.get("turns", [])
            turns = normalise_turns(turns_raw if isinstance(turns_raw, list) else [])
            if not turns:
                continue

            chunks = chunk_by_turns(
                turns,
                max_words=args.max_words,
                overlap_turns=args.overlap_turns,
            )

            # Common metadata
            transcript_id = str(t.get("transcript_id", "")).strip()
            event_id = str(t.get("event_id", "")).strip()
            event_name = str(t.get("event_name", "")).strip()
            journey_type = str(t.get("journey_type", "")).strip()
            sentiment = str(t.get("sentiment", "")).strip()
            outcome = str(t.get("outcome", "")).strip()
            channel = str(t.get("channel", "phone")).strip()
            turn_count = len(turns)

            for ch in chunks:
                obj = {
                    "text": ch["text"],

                    "transcript_id": transcript_id,
                    "event_id": event_id,
                    "event_name": event_name,

                    "journey_type": journey_type,
                    "sentiment": sentiment,
                    "outcome": outcome,
                    "channel": channel,

                    "chunk_index": int(ch["chunk_index"]),
                    "turn_start": int(ch["turn_start"]),
                    "turn_end": int(ch["turn_end"]),
                    "turn_count": int(turn_count),
                }

                objects_for_batch.append(obj)
                texts_for_batch.append(ch["text"])

                if len(objects_for_batch) >= args.batch_size:
                    flush_batch()

        flush_batch()

        print(f"Done. Inserted {total_chunks} chunks into collection '{args.collection}'.")

    finally:
        client.close()


if __name__ == "__main__":
    main()
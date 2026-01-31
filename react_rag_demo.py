#!/usr/bin/env python3
"""
react_rag_demo.py

A single-file, from-scratch demo of **ReAct + RAG** for the JourneyWorks project.

What it demonstrates
--------------------
ReAct loop (controlled, single iteration + optional one revision):
  1) THINK  : Use Mistral to propose a retrieval plan (top_k + metadata filters)
  2) ACT    : Retrieve evidence from Weaviate (nearVector + filters)
  3) OBSERVE: Summarise what came back, decide if retrieval is sufficient (optional revise once)
  4) ANSWER : Use Mistral to generate an exec-friendly answer grounded ONLY in retrieved evidence

Assumptions
-----------
- Weaviate is running locally with defaults: http://localhost:8080 and gRPC 50051
- You have already indexed transcripts into a collection (default: JourneyWorksTranscript)
- Your Weaviate objects include at least:
    text, event_name, journey_type, sentiment, outcome, channel, naturalised_status

Dependencies
------------
pip install -U weaviate-client sentence-transformers llama-cpp-python

Example
-------
python react_rag_demo.py \
  --q "What are customers disputing about mortgage rate increases, and why does it escalate?" \
  --collection JourneyWorksTranscript \
  --require-naturalised-ok
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import weaviate
import weaviate.classes as wvc
from weaviate.classes.init import Auth
from llama_cpp import Llama


# ----------------------------
# Utilities
# ----------------------------
def clamp(s: str, n: int) -> str:
    s = (s or "").strip()
    if len(s) <= n:
        return s
    return s[: n - 1].rstrip() + "…"


def extract_json_obj(text: str) -> Optional[Dict[str, Any]]:
    """Best-effort extraction of a JSON object from an LLM response."""
    text = text.strip()
    m = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except Exception:
        return None


# ----------------------------
# Embeddings (local)
# ----------------------------
def get_embedder(model_name: str):
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError as e:
        raise RuntimeError(
            "Missing dependency: sentence-transformers. Install with:\n"
            "  pip install -U sentence-transformers\n"
        ) from e
    return SentenceTransformer(model_name)


def embed_text(embedder, text: str) -> List[float]:
    vec = embedder.encode([text], normalize_embeddings=True, show_progress_bar=False)[0]
    return vec.tolist()


# ----------------------------
# Weaviate
# ----------------------------
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
        raise RuntimeError("Weaviate is not ready. Check container + ports.")
    return client


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


def retrieve_evidence(
    client,
    collection: str,
    qvec: List[float],
    top_k: int,
    where: Optional[wvc.query.Filter],
) -> List[Any]:
    col = client.collections.get(collection)
    props = [
        "text",
        "event_name",
        "journey_type",
        "sentiment",
        "outcome",
        "channel",
        "naturalised_status",
    ]
    res = col.query.near_vector(
        near_vector=qvec,
        limit=top_k,
        filters=where,
        return_properties=props,
        return_metadata=wvc.query.MetadataQuery(distance=True),
    )
    return res.objects or []


# ----------------------------
# ReAct planning prompts
# ----------------------------
def plan_prompt(question: str, allowed: Dict[str, List[str]], default_top_k: int, default_require_ok: bool) -> str:
    schema = {
        "top_k": default_top_k,
        "require_naturalised_ok": default_require_ok,
        "filters": {
            "journey_type": None,
            "outcome": None,
            "sentiment": None,
            "channel": None,
        },
        "notes": "string",
    }

    rules = f"""
You are a retrieval planner for a customer-journey RAG system.
Your job: propose Weaviate retrieval parameters to find evidence for the USER QUESTION.

Constraints:
- Output MUST be valid JSON ONLY matching this schema: {json.dumps(schema)}.
- Choose filter values ONLY from the ALLOWED VALUES lists (or null).
- top_k must be between 5 and 30.
- Prefer require_naturalised_ok=true for demo credibility, unless that would likely return too few results.
- Do NOT answer the question; ONLY plan retrieval.
""".strip()

    return f"""[INST]
{rules}

USER QUESTION:
{question}

ALLOWED VALUES:
{json.dumps(allowed)}

Return JSON only.
[/INST]"""


def observe_prompt(question: str, plan: Dict[str, Any], evidence_summary: str, allowed: Dict[str, List[str]]) -> str:
    schema = {
        "sufficient": True,
        "revised_top_k": int(plan.get("top_k", 10)),
        "revised_filters": {
            "journey_type": plan.get("filters", {}).get("journey_type"),
            "outcome": plan.get("filters", {}).get("outcome"),
            "sentiment": plan.get("filters", {}).get("sentiment"),
            "channel": plan.get("filters", {}).get("channel"),
        },
        "why": "string",
    }

    rules = f"""
You are validating whether retrieved evidence is sufficient to answer the question.
Output MUST be valid JSON ONLY matching this schema: {json.dumps(schema)}.

Constraints:
- revised_top_k must be between 5 and 30.
- revised_filters values must be from ALLOWED VALUES lists or null.
- If evidence is off-topic or too thin, set sufficient=false and revise the plan.
- Do NOT answer the question.
""".strip()

    return f"""[INST]
{rules}

USER QUESTION:
{question}

PLAN USED:
{json.dumps(plan)}

EVIDENCE SUMMARY:
{evidence_summary}

ALLOWED VALUES:
{json.dumps(allowed)}

Return JSON only.
[/INST]"""


def answer_prompt(question: str, evidences: List[Dict[str, Any]]) -> str:
    blocks = []
    for i, ev in enumerate(evidences, start=1):
        m = ev["meta"]
        blocks.append(
            f"[E{i}] event={m.get('event_name','')} | journey={m.get('journey_type','')} | "
            f"outcome={m.get('outcome','')} | sentiment={m.get('sentiment','')} | channel={m.get('channel','')}\n"
            f"{ev['snippet']}"
        )

    rules = """
You are assisting a bank executive with insights from customer contact transcripts.

Rules:
- Answer the QUESTION using ONLY the EVIDENCE provided.
- If evidence is insufficient, say what is missing and what you would check next.
- Keep it concise and executive-friendly.
- Use this structure:
  1) Key findings (bullets)
  2) Recommended actions (bullets)
  3) Evidence references (map each finding/action to [E#])
- Do NOT invent numbers or facts.
""".strip()

    return f"""[INST]
{rules}

QUESTION:
{question}

EVIDENCE:
{chr(10).join(blocks)}
[/INST]"""


# ----------------------------
# Allowed values (simple + safe)
# ----------------------------
def get_allowed_values() -> Dict[str, List[str]]:
    """
    Keep this conservative: values you actually use in your generated spec.
    Edit these lists to match your repo taxonomy.
    """
    return {
        "journey_type": [
            "JT_PRICING_DISPUTE",
            "JT_ONBOARDING",
            "JT_CARD_ISSUE",
            "JT_FRAUD",
            "JT_COMPLAINTS",
            "JT_GENERAL_ENQUIRY",
        ],
        "outcome": ["resolved", "escalated", "abandoned"],
        "sentiment": ["negative", "neutral", "positive"],
        "channel": ["phone", "chat", "email", "twitter"],
    }


# ----------------------------
# Main demo
# ----------------------------
def summarise_results(objs: List[Any], max_items: int = 5) -> str:
    if not objs:
        return "NO RESULTS"
    lines = []
    for i, obj in enumerate(objs[:max_items], start=1):
        pr = obj.properties or {}
        lines.append(
            f"- R{i}: journey={pr.get('journey_type','')} outcome={pr.get('outcome','')} "
            f"sentiment={pr.get('sentiment','')} event={pr.get('event_name','')} "
            f"naturalised={pr.get('naturalised_status','')} :: {clamp(pr.get('text',''), 240)}"
        )
    return "\n".join(lines)


def objs_to_evidence(objs: List[Any], max_evidence: int = 10) -> List[Dict[str, Any]]:
    evidences: List[Dict[str, Any]] = []
    for obj in objs[:max_evidence]:
        pr = obj.properties or {}
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
                "snippet": clamp(pr.get("text", ""), 900),
            }
        )
    return evidences


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--q", required=True, help="User question")
    ap.add_argument("--collection", default="JourneyWorksTranscript")
    ap.add_argument("--k", type=int, default=10, help="Default top_k if planner fails")
    ap.add_argument("--require-naturalised-ok", action="store_true", help="Default require_naturalised_ok if planner fails")

    # Weaviate defaults
    ap.add_argument("--host", default=os.getenv("WEAVIATE_HOST", "localhost"))
    ap.add_argument("--port", type=int, default=int(os.getenv("WEAVIATE_PORT", "8080")))
    ap.add_argument("--grpc-port", type=int, default=int(os.getenv("WEAVIATE_GRPC_PORT", "50051")))
    ap.add_argument("--api-key", default=os.getenv("WEAVIATE_API_KEY"))

    # Embeddings
    ap.add_argument("--embed-model", default=os.getenv("EMBED_MODEL", "sentence-transformers/all-MiniLM-L6-v2"))

    # Mistral / llama.cpp
    ap.add_argument("--mistral-model", default=os.getenv("MISTRAL_GGUF", "models/mistral-7b-instruct-v0.2.Q5_K_M.gguf"))
    ap.add_argument("--n-ctx", type=int, default=4096)
    ap.add_argument("--n-gpu-layers", type=int, default=999)
    ap.add_argument("--temp", type=float, default=0.2)
    ap.add_argument("--top-p", type=float, default=0.95)

    # Safety: single revision at most
    ap.add_argument("--max-revisions", type=int, default=1)

    args = ap.parse_args()

    # 0) Prepare embedder
    embedder = get_embedder(args.embed_model)
    qvec = embed_text(embedder, args.q)

    # 1) Connect Weaviate
    client = connect_weaviate(args.host, args.port, args.grpc_port, args.api_key)
    try:
        if not client.collections.exists(args.collection):
            raise RuntimeError(f"Collection '{args.collection}' does not exist. Run index_transcripts.py first.")

        allowed = get_allowed_values()

        # 2) Load LLM once
        llm = Llama(
            model_path=args.mistral_model,
            n_ctx=args.n_ctx,
            n_gpu_layers=args.n_gpu_layers,
            verbose=False,
        )

        try:
            # ------------------------
            # THINK: create retrieval plan
            # ------------------------
            print("\n=== THINK (plan retrieval) ===")
            ptxt = plan_prompt(args.q, allowed, args.k, bool(args.require_naturalised_ok))
            pout = llm(
                ptxt,
                max_tokens=320,
                temperature=args.temp,
                top_p=args.top_p,
                stop=["</s>", "[INST]"],
            )["choices"][0]["text"].strip()

            plan = extract_json_obj(pout)
            if plan is None:
                plan = {
                    "top_k": args.k,
                    "require_naturalised_ok": bool(args.require_naturalised_ok),
                    "filters": {"journey_type": None, "outcome": None, "sentiment": None, "channel": None},
                    "notes": "planner JSON parse failed; using defaults",
                }

            # Sanitise plan
            top_k = int(plan.get("top_k") or args.k)
            top_k = max(5, min(30, top_k))
            plan["top_k"] = top_k

            req_ok = bool(plan.get("require_naturalised_ok", bool(args.require_naturalised_ok)))
            plan["require_naturalised_ok"] = req_ok

            filters = plan.get("filters") or {}
            for key in ["journey_type", "outcome", "sentiment", "channel"]:
                v = filters.get(key, None)
                if v is not None and v not in allowed.get(key, []):
                    filters[key] = None
            plan["filters"] = filters

            print(json.dumps(plan, indent=2))

            # ------------------------
            # ACT: retrieve evidence
            # ------------------------
            def run(plan_dict: Dict[str, Any]) -> List[Any]:
                f = plan_dict.get("filters") or {}
                where = build_filters(
                    require_naturalised_ok=bool(plan_dict.get("require_naturalised_ok")),
                    journey_type=f.get("journey_type"),
                    outcome=f.get("outcome"),
                    sentiment=f.get("sentiment"),
                    channel=f.get("channel"),
                )
                return retrieve_evidence(client, args.collection, qvec, int(plan_dict["top_k"]), where)

            print("\n=== ACT (retrieve) ===")
            objs = run(plan)
            print(f"Retrieved: {len(objs)} objects (requested top_k={plan['top_k']})")

            # ------------------------
            # OBSERVE: decide if sufficient; allow ONE revision
            # ------------------------
            revisions = 0
            while revisions < args.max_revisions:
                summary = summarise_results(objs, max_items=5)
                print("\n=== OBSERVE (judge retrieval) ===")
                print(summary)

                otxt = observe_prompt(args.q, plan, summary, allowed)
                oout = llm(
                    otxt,
                    max_tokens=260,
                    temperature=args.temp,
                    top_p=args.top_p,
                    stop=["</s>", "[INST]"],
                )["choices"][0]["text"].strip()

                obs = extract_json_obj(oout)
                if not obs:
                    # If parse fails, assume sufficient to avoid looping
                    break

                sufficient = bool(obs.get("sufficient", True))
                if sufficient:
                    break

                # Apply revised plan once
                revised_top_k = int(obs.get("revised_top_k") or plan["top_k"])
                revised_top_k = max(5, min(30, revised_top_k))

                revised_filters = obs.get("revised_filters") or plan.get("filters") or {}
                # sanitise revised filters
                for key in ["journey_type", "outcome", "sentiment", "channel"]:
                    v = revised_filters.get(key, None)
                    if v is not None and v not in allowed.get(key, []):
                        revised_filters[key] = None

                plan = {
                    "top_k": revised_top_k,
                    "require_naturalised_ok": plan.get("require_naturalised_ok", True),
                    "filters": revised_filters,
                    "notes": f"revised: {obs.get('why','')}",
                }

                revisions += 1
                print("\n--- REVISED PLAN ---")
                print(json.dumps(plan, indent=2))

                print("\n=== ACT (retrieve, revised) ===")
                objs = run(plan)
                print(f"Retrieved: {len(objs)} objects (requested top_k={plan['top_k']})")

            # ------------------------
            # ANSWER: grounded response from evidence
            # ------------------------
            evidences = objs_to_evidence(objs, max_evidence=int(plan["top_k"]))
            print("\n=== ANSWER (grounded) ===")
            atxt = answer_prompt(args.q, evidences)
            ans = llm(
                atxt,
                max_tokens=650,
                temperature=args.temp,
                top_p=args.top_p,
                stop=["</s>", "[INST]"],
            )["choices"][0]["text"].strip()

            print(ans)

            # For debugging / UI integration
            print("\n=== EVIDENCE (debug) ===")
            for i, ev in enumerate(evidences[:5], start=1):
                m = ev["meta"]
                print(
                    f"[E{i}] uuid={m['uuid']} naturalised={m['naturalised_status']} "
                    f"event={m['event_name']} journey={m['journey_type']} "
                    f"outcome={m['outcome']} sentiment={m['sentiment']}"
                )

        finally:
            # llama-cpp can be noisy with ResourceWarnings; safe to close.
            llm.close()

    finally:
        client.close()


if __name__ == "__main__":
    main()
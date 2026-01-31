from __future__ import annotations

import argparse
import json
import re
from typing import Any, Dict, List

import yaml
from llama_cpp import Llama


def load_yaml(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def save_yaml(path: str, data: Dict[str, Any]) -> None:
    with open(path, "w", encoding="utf-8") as f:
        yaml.safe_dump(data, f, sort_keys=False, allow_unicode=True)


def clamp_text(s: str, max_chars: int) -> str:
    s = s.strip()
    if len(s) <= max_chars:
        return s
    return s[: max_chars - 1].rstrip() + "…"


def build_prompt(transcript: Dict[str, Any], style: Dict[str, Any]) -> str:
    """
    We ask Mistral to return STRICT JSON so we can parse reliably.
    No <s> token here to avoid duplicate BOS warnings.
    """
    event_name = transcript.get("event_name", "")
    journey_type = transcript.get("journey_type", "")
    sentiment = transcript.get("sentiment", "")
    outcome = transcript.get("outcome", "")
    channel = transcript.get("channel", "phone")

    # Compact the original to keep prompt size stable
    original_turns = transcript.get("turns", [])
    original_lines = []
    for t in original_turns:
        spk = t.get("speaker", "")
        txt = clamp_text(t.get("text", ""), 220)
        original_lines.append(f"{spk}: {txt}")
    original_text = "\n".join(original_lines)

    # Style controls (UK feel, agent tone, etc.)
    uk_register = style.get("uk_register", "UK contact centre (polite, natural)")
    agent_style = style.get("agent_style", "Professional, helpful, concise")
    customer_style = style.get("customer_style", "Natural UK caller speech, mild hesitations")
    profanity = style.get("profanity", "none")  # none|mild
    keep_names = style.get("keep_names", False)

    # JSON schema we require
    schema = {
        "turns": [
            {"speaker": "Customer", "text": "string"},
            {"speaker": "Agent", "text": "string"},
        ]
    }

    rules = f"""
You are rewriting a fabricated customer support CALL transcript to sound more realistic and natural.
Constraints:
- Keep the SAME number of turns and SAME speakers in the SAME order.
- Keep the meaning consistent with the original.
- Reflect the labels: sentiment={sentiment}, outcome={outcome}, journey_type={journey_type}.
- Use {uk_register}.
- Agent style: {agent_style}. Customer style: {customer_style}.
- Do NOT add any personal data (no real names, phone numbers, addresses, account numbers).
- Profanity: {profanity}.
- Do NOT add extra commentary, headings, or analysis.
- Output MUST be valid JSON ONLY matching this schema: {json.dumps(schema)}.
- If you cannot comply, output: {{"turns":[]}}.
""".strip()

    if not keep_names:
        rules += "\n- If the original contains any names, replace with neutral terms (e.g., 'my partner', 'my mum')."

    prompt = f"""[INST]
{rules}

Context about the scenario:
- Event: {event_name}
- Channel: {channel}

ORIGINAL TRANSCRIPT:
{original_text}

Now rewrite it. Remember: JSON only.
[/INST]"""
    return prompt


def parse_json_turns(raw: str, expected_len: int) -> List[Dict[str, str]] | None:
    """
    Try to extract JSON object from model output robustly.
    """
    raw = raw.strip()

    # Some models may prefix stray text; attempt to find a JSON object
    m = re.search(r"\{.*\}", raw, flags=re.DOTALL)
    if not m:
        return None

    try:
        obj = json.loads(m.group(0))
    except Exception:
        return None

    turns = obj.get("turns")
    if not isinstance(turns, list) or len(turns) != expected_len:
        return None

    cleaned: List[Dict[str, str]] = []
    for t in turns:
        if not isinstance(t, dict):
            return None
        spk = t.get("speaker")
        txt = t.get("text")
        if not isinstance(spk, str) or not isinstance(txt, str):
            return None
        cleaned.append({"speaker": spk.strip(), "text": txt.strip()})
    return cleaned


def naturalise_file(
    in_path: str,
    out_path: str,
    model_path: str,
    n_ctx: int,
    n_gpu_layers: int,
    max_tokens: int,
    temperature: float,
    top_p: float,
    limit: int | None,
    start: int,
    style: Dict[str, Any],
) -> None:
    data = load_yaml(in_path)
    transcripts = data.get("transcripts", [])

    if not isinstance(transcripts, list):
        raise ValueError("Input YAML missing 'transcripts' list")

    # Slice for partial runs
    end = None if limit is None else start + limit
    subset = transcripts[start:end]

    llm = None
    try:
        llm = Llama(
            model_path=model_path,
            n_ctx=n_ctx,
            n_gpu_layers=n_gpu_layers,
            verbose=False,
        )

        rewritten: List[Dict[str, Any]] = []
        for idx, tr in enumerate(subset, start=start):
            turns = tr.get("turns", [])
            if not isinstance(turns, list) or len(turns) == 0:
                rewritten.append(tr)
                continue

            prompt = build_prompt(tr, style)
            print(f'PROMPT: {prompt}')

            out = llm(
                prompt,
                max_tokens=max_tokens,
                temperature=temperature,
                top_p=top_p,
                stop=["</s>", "[INST]"],
            )

            text = out["choices"][0]["text"]
            print(f"TEXT: {text}")
            new_turns = parse_json_turns(text, expected_len=len(turns))

            if new_turns is None:
                # fall back: keep original if parsing fails
                tr2 = dict(tr)
                tr2["naturalised"] = {
                    "status": "failed_parse",
                    "model_output_snippet": clamp_text(text, 300),
                }
                rewritten.append(tr2)
            else:
                tr2 = dict(tr)
                tr2["turns"] = new_turns
                tr2["naturalised"] = {"status": "ok"}
                rewritten.append(tr2)

            # lightweight progress
            print(f"Processed {idx+1} transcripts...")

        # Rebuild output
        out_data = dict(data)
        out_data["transcripts"] = rewritten
        out_data["naturalisation"] = {
            "model_path": model_path,
            "n_ctx": n_ctx,
            "n_gpu_layers": n_gpu_layers,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "top_p": top_p,
            "start": start,
            "limit": limit,
            "style": style,
        }

        save_yaml(out_path, out_data)
        print(f"Wrote naturalised YAML: {out_path}")

    finally:
        if llm is not None:
            llm.close()


def main(inp, out, model, n_ctx=4096, n_gpu_layers=999, max_tokens=900, temp=0.35, top_p=0.95, start=0, limit=None):
    # p = argparse.ArgumentParser()
    # p.add_argument("--in", dest="inp", required=True, help="Input YAML (generated transcripts)")
    # p.add_argument("--out", dest="out", required=True, help="Output YAML (naturalised transcripts)")
    # p.add_argument("--model", required=True, help="Path to Mistral GGUF")
    # p.add_argument("--n_ctx", type=int, default=4096)
    # p.add_argument("--n_gpu_layers", type=int, default=999, help="Use 999 to offload as many as possible (Metal)")
    # p.add_argument("--max_tokens", type=int, default=900)
    # p.add_argument("--temperature", type=float, default=0.35)
    # p.add_argument("--top_p", type=float, default=0.95)
    # p.add_argument("--start", type=int, default=0, help="Start index within transcripts list")
    # p.add_argument("--limit", type=int, default=None, help="How many transcripts to process (for testing)")
    # args = p.parse_args()

    # Style you can tweak
    style = {
        "uk_register": "UK contact centre language (polite, natural, not overly American)",
        "agent_style": "Professional, calm, empathetic, solutions-focused",
        "customer_style": "Natural UK caller speech with mild hesitations (e.g., 'erm', 'right', 'to be honest')",
        "profanity": "mild",   # set "mild" if you want occasional light swearing
        "keep_names": False,
    }

    naturalise_file(
        in_path=inp,
        out_path=out,
        model_path=model,
        n_ctx=n_ctx,
        n_gpu_layers=n_gpu_layers,
        max_tokens=max_tokens,
        temperature=temp,
        top_p=top_p,
        start=start,
        limit=limit,
        style=style,
    )


if __name__ == "__main__":
    main(inp='data/transcripts.yaml', out='data/transcripts_naturalised.yaml', model='models/mistral-7b-instruct-v0.2.Q5_K_M.gguf')
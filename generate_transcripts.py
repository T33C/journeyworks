from __future__ import annotations

import random
import uuid
from dataclasses import dataclass
from typing import Dict, Any, List, Tuple

import yaml


def weighted_choice(rng: random.Random, weights: Dict[str, float]) -> str:
    """Return key sampled by weights."""
    items = list(weights.items())
    total = sum(w for _, w in items)
    r = rng.random() * total
    upto = 0.0
    for k, w in items:
        upto += w
        if upto >= r:
            return k
    return items[-1][0]


def choose_turn_count(rng: random.Random, spec: Dict[str, Any]) -> int:
    dist = spec["generation"]["call_length"]["distribution"]
    band = weighted_choice(rng, dist)
    if band == "short":
        lo, hi = spec["generation"]["call_length"]["short_turns"]
    elif band == "medium":
        lo, hi = spec["generation"]["call_length"]["medium_turns"]
    else:
        lo, hi = spec["generation"]["call_length"]["long_turns"]
    return rng.randint(lo, hi)


def pick_journey_type(rng: random.Random, event_id: str, spec: Dict[str, Any]) -> str:
    mix = spec["event_journey_mix"][event_id]
    return weighted_choice(rng, mix)


def pick_scenario(rng: random.Random, journey_type: str, spec: Dict[str, Any]) -> Dict[str, Any]:
    options = spec["scenario_library"][journey_type]
    return rng.choice(options)


def tone_prefixes() -> Dict[str, List[str]]:
    return {
        "warm": [
            "Thanks for calling — ",
            "No problem at all — ",
            "Of course — ",
        ],
        "neutral": [
            "",
            "Okay — ",
            "Right — ",
        ],
        "formal": [
            "Thank you for contacting HSBC — ",
            "Certainly — ",
            "I appreciate that — ",
        ],
    }


def temperament_modifiers() -> Dict[str, Dict[str, List[str]]]:
    # short inserts to add realism / intensity without bloating
    return {
        "calm": {
            "customer": ["", "Just checking, ", "If you don’t mind, "],
            "agent": ["", ""],
        },
        "frustrated": {
            "customer": ["Honestly, ", "This is really frustrating — ", "I’ve tried twice now, "],
            "agent": ["I’m sorry about that. ", "I understand. ", ""],
        },
        "angry": {
            "customer": ["This is unacceptable — ", "I’m really angry about this — ", "I’ve had enough — "],
            "agent": ["I’m very sorry. ", "I understand how serious this is. ", ""],
        },
    }


def build_turns(
    rng: random.Random,
    scenario: Dict[str, Any],
    sentiment: str,
    outcome: str,
    agent_tone: str,
    customer_temperament: str,
    target_turns: int,
    speakers: Dict[str, str],
) -> List[Dict[str, str]]:
    """
    Expand a scenario skeleton to a turn list.
    Structure:
      - customer opening
      - 2–4 agent moves + customer responses interleaved
      - closing based on outcome
    """
    turns: List[Dict[str, str]] = []

    cust_name = speakers["customer"]
    agent_name = speakers["agent"]

    tone_pref = tone_prefixes()[agent_tone]
    mods = temperament_modifiers()[customer_temperament]

    opening = rng.choice(scenario["opening"])
    opening = mods["customer"][rng.randrange(len(mods["customer"]))] + opening
    turns.append({"speaker": cust_name, "text": opening})

    # Agent acknowledges + first move
    moves = list(scenario["agent_moves"])
    rng.shuffle(moves)

    # We’ll generate a back-and-forth until we’re close to target_turns
    # Each "move" typically adds 2 turns (agent + customer).
    move_i = 0
    while len(turns) < target_turns - 2 and move_i < len(moves):
        move = moves[move_i]
        move_i += 1

        agent_line = rng.choice(tone_pref) + move
        agent_line = mods["agent"][rng.randrange(len(mods["agent"]))] + agent_line
        turns.append({"speaker": agent_name, "text": agent_line.strip()})

        # Customer response: vary by sentiment/temperament
        if sentiment == "positive":
            responses = [
                "Okay, that makes sense.",
                "Thanks, that helps.",
                "Great — I appreciate it.",
            ]
        elif sentiment == "neutral":
            responses = [
                "Alright.",
                "Okay, I guess.",
                "Fine, what do I do next?",
            ]
        else:  # negative
            responses = [
                "That’s not good enough.",
                "Why wasn’t this clearer?",
                "I’m not happy about this.",
                "This is causing me real hassle.",
            ]
        cust_line = mods["customer"][rng.randrange(len(mods["customer"]))] + rng.choice(responses)
        turns.append({"speaker": cust_name, "text": cust_line.strip()})

    # Agent closing + Customer closing
    closing_agent_lines = {
        "resolved": [
            "I’m glad we could sort that today. Is there anything else I can help with?",
            "That should be all set now. Thanks for your patience.",
        ],
        "partial": [
            "I’ve done what I can from here. If it persists, please call back and quote this reference.",
            "I’ve logged this and the team will continue investigating.",
        ],
        "escalated": [
            "I’m escalating this now and you’ll receive an update as soon as possible.",
            "I’m raising this to the relevant team and arranging a follow-up.",
        ],
        "unresolved": [
            "I’m sorry we couldn’t resolve this on the call today.",
            "I understand your frustration — I don’t have a fix available right now.",
        ],
    }

    agent_close = rng.choice(closing_agent_lines[outcome])
    agent_close = rng.choice(tone_pref) + agent_close
    turns.append({"speaker": agent_name, "text": agent_close.strip()})

    customer_close = rng.choice(scenario["closings"][outcome])
    # Add a small modifier occasionally
    if rng.random() < 0.35:
        customer_close = mods["customer"][rng.randrange(len(mods["customer"]))] + customer_close
    turns.append({"speaker": cust_name, "text": customer_close.strip()})

    # If we overshot target_turns slightly, trim safely (keep last 2 turns)
    if len(turns) > target_turns:
        keep_tail = turns[-2:]
        turns = turns[: target_turns - 2] + keep_tail

    # If we undershot, pad with a brief clarifying exchange
    while len(turns) < target_turns:
        turns.insert(-2, {"speaker": agent_name, "text": "Just to confirm, did you want me to note anything else on your account?"})
        turns.insert(-2, {"speaker": cust_name, "text": "No, that’s all."})

        # If we went over after inserting, trim again
        if len(turns) > target_turns:
            keep_tail = turns[-2:]
            turns = turns[: target_turns - 2] + keep_tail

    return turns


def generate_transcripts(spec: Dict[str, Any]) -> Dict[str, Any]:
    rng = random.Random(spec["generation"]["seed"])
    n_per_event = int(spec["generation"]["transcripts_per_event"])

    speakers = spec["meta"]["speakers"]

    sentiments_dist = spec["generation"]["sentiments"]["distribution"]
    outcomes_dist = spec["generation"]["outcomes"]["distribution"]
    tone_dist = spec["generation"]["agent_tone"]["distribution"]
    temp_dist = spec["generation"]["customer_temperament"]["distribution"]

    transcripts: List[Dict[str, Any]] = []

    for event in spec["events"]:
        event_id = event["event_id"]
        event_name = event["event_name"]
        channel = spec["meta"].get("default_channel", "phone")

        for i in range(1, n_per_event + 1):
            journey_type = pick_journey_type(rng, event_id, spec)
            scenario = pick_scenario(rng, journey_type, spec)

            sentiment = weighted_choice(rng, sentiments_dist)
            outcome = weighted_choice(rng, outcomes_dist)
            agent_tone = weighted_choice(rng, tone_dist)
            customer_temperament = weighted_choice(rng, temp_dist)

            target_turns = choose_turn_count(rng, spec)

            turns = build_turns(
                rng=rng,
                scenario=scenario,
                sentiment=sentiment,
                outcome=outcome,
                agent_tone=agent_tone,
                customer_temperament=customer_temperament,
                target_turns=target_turns,
                speakers=speakers,
            )

            transcript = {
                "transcript_id": f"{event_id}-T{i:03d}",
                "event_id": event_id,
                "event_name": event_name,
                "channel": channel,
                "scenario_id": scenario["scenario_id"],
                "journey_type": journey_type,
                "sentiment": sentiment,
                "outcome": outcome,
                "turns": turns,
                # optional debug/analysis fields (handy for evaluation)
                "style": {
                    "agent_tone": agent_tone,
                    "customer_temperament": customer_temperament,
                    "target_turns": target_turns,
                },
            }
            transcripts.append(transcript)

    return {
        "meta": spec["meta"],
        "generation": {
            "transcripts_per_event": n_per_event,
            "seed": spec["generation"]["seed"],
            "total_transcripts": len(transcripts),
        },
        "transcripts": transcripts,
    }


def main(spec_file, output_file):


    with open(spec_file, "r", encoding="utf-8") as f:
        spec = yaml.safe_load(f)

    data = generate_transcripts(spec)

    with open(output_file, "w", encoding="utf-8") as f:
        yaml.safe_dump(data, f, sort_keys=False, allow_unicode=True)

    print(f"Wrote {data['generation']['total_transcripts']} transcripts to {output_file}")


if __name__ == "__main__":
    main('data/spec_hsbc_transcripts.yaml', 'data/transcripts.yaml')
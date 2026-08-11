#!/usr/bin/env python3
"""Generate a reproducible seed spoiler/safe JSONL dataset for fine-tuning."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

TITLES = [
    "Attack on Titan",
    "AOT",
    "Game of Thrones",
    "Breaking Bad",
    "The Last of Us",
    "Stranger Things",
    "One Piece",
    "Dune",
    "Avengers Endgame",
    "The Boys",
    "Succession",
    "Arcane",
    "Severance",
    "House of the Dragon",
    "The Mandalorian",
]

SPOILER_TEMPLATES = [
    "{title} ending explained",
    "{title} finale spoiler",
    "{title} who dies in the ending",
    "{title} death scene explained",
    "spoiler: {title} plot twist revealed",
    "{title} true identity reveal",
    "what happens to the main character in {title}",
    "{title} post credit scene explained",
    "{title} betrayal in the finale",
    "does the hero die in {title}",
    "{title} killer is revealed",
    "{title} final moment spoilers",
    "major {title} spoiler warning ending",
    "{title} season finale who survives",
    "turns out {title} twist changes everything",
    "{title} finds out the truth ending",
    "Watching: {title}. Text result: ending explained with spoilers",
    "Watching: {title}. Text result: who dies at the end",
    "Watching: {title}. Text result: plot twist finale analysis",
]

SAFE_TEMPLATES = [
    "{title} cast and crew interview",
    "{title} release date and streaming",
    "{title} where to watch",
    "{title} season renewal news",
    "{title} soundtrack list",
    "{title} trailer reaction",
    "{title} box office numbers",
    "{title} casting rumors",
    "{title} official poster",
    "{title} merchandise store",
    "{title} watch order guide",
    "{title} episode runtime",
    "{title} awards nominations",
    "{title} filming locations",
    "{title} behind the scenes featurette",
    "Watching: {title}. Text result: streaming schedule and cast",
    "Watching: {title}. Search result: how to watch legally",
    "Watching: {title}. Search result: ticket prices near me",
]

GENERIC_SPOILERS = [
    "ending explained with major spoilers",
    "who dies in the finale",
    "plot twist revealed in the last episode",
    "post-credit scene spoiler breakdown",
    "character death confirmed in season finale",
    "true identity of the killer explained",
    "final scene analysis with spoilers",
    "betrayal twist ending spoiler",
    "does the protagonist survive the ending",
    "spoiler review of the last episode",
]

GENERIC_SAFE = [
    "best headphones for commuting 2024",
    "how to roast vegetables in the oven",
    "local weather forecast this weekend",
    "python list comprehension tutorial",
    "cheap flights to tokyo in spring",
    "restaurant reservations downtown",
    "iphone battery replacement cost",
    "beginner yoga stretches for back pain",
    "stock market closing summary today",
    "garden soil mix for tomatoes",
    "resume template for software engineers",
    "public transit schedule update",
]


def build_examples() -> list[dict[str, str]]:
    examples: list[dict[str, str]] = []
    for title in TITLES:
        for template in SPOILER_TEMPLATES:
            examples.append({"text": template.format(title=title), "label": "spoiler"})
        for template in SAFE_TEMPLATES:
            examples.append({"text": template.format(title=title), "label": "safe"})

    for text in GENERIC_SPOILERS:
        examples.append({"text": text, "label": "spoiler"})
    for text in GENERIC_SAFE:
        examples.append({"text": text, "label": "safe"})

    # Deduplicate while preserving order.
    seen: set[str] = set()
    unique: list[dict[str, str]] = []
    for example in examples:
        key = example["text"].lower()
        if key in seen:
            continue
        seen.add(key)
        unique.append(example)
    return unique


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "data" / "seed_spoilers.jsonl",
    )
    args = parser.parse_args()

    examples = build_examples()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as handle:
        for example in examples:
            handle.write(json.dumps(example, ensure_ascii=True) + "\n")

    spoiler_count = sum(1 for item in examples if item["label"] == "spoiler")
    safe_count = len(examples) - spoiler_count
    print(f"Wrote {len(examples)} examples ({spoiler_count} spoiler, {safe_count} safe) to {args.output}")


if __name__ == "__main__":
    main()

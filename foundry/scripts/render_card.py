from __future__ import annotations

import argparse
from pathlib import Path

from _common import append_run_log, ensure_defaults, ensure_layout, now_iso, read_json, require_root, slugify, update_session, write_json, write_text


DEFAULT_PROMPT_SHELL = (
    "Tarot card illustration, vertical composition, centered symbolic figure, ornate but restrained frame, "
    "high legibility, luminous emblematic imagery, mystical but disciplined, serious sacred geometry, "
    "fine linework, rich but controlled palette, no text, no watermark."
)


def main() -> None:
    root, raw_args = require_root(__import__("sys").argv)
    ensure_layout(root)
    ensure_defaults(root)

    parser = argparse.ArgumentParser(description="Generate tarot render metadata")
    parser.add_argument("--card", required=True, help="card id like the-lantern")
    parser.add_argument("--provider", default="stability")
    parser.add_argument("--fallback-provider", default="fal")
    args = parser.parse_args(raw_args)

    card_path = root / "cards" / "defs" / f"{args.card}.json"
    card = read_json(card_path, default={}) or {}
    if not card:
        raise SystemExit(f"missing card definition: {card_path}")

    prompt = ", ".join([
        DEFAULT_PROMPT_SHELL,
        card.get("prompt_style", ""),
        ", ".join(card.get("visual_motifs", [])),
    ]).strip(", ")

    render_dir = root / "cards" / "renders" / slugify(args.card)
    render_dir.mkdir(parents=True, exist_ok=True)

    metadata = {
        "generated_at": now_iso(),
        "card_id": card["card_id"],
        "title": card["title"],
        "provider": args.provider,
        "fallback_provider": args.fallback_provider,
        "outputs": ["upright", "reversed", "emblem", "monochrome"],
        "passes": {
            "draft": {
                "quality": "fast",
                "prompt": prompt,
                "negative_prompt": ", ".join(card.get("negative_motifs", [])),
            },
            "keeper": {
                "quality": "high",
                "prompt": prompt,
                "negative_prompt": ", ".join(card.get("negative_motifs", [])),
            },
        },
        "variants": {
            "upright": "primary tarot composition",
            "reversed": "invert orientation and emphasize tension or blocked energy",
            "emblem": "single emblem/icon version for compact UI surfaces",
            "monochrome": "line-art print-safe version for low-ink or emboss workflows",
        },
    }

    write_json(render_dir / "request.json", metadata)
    write_text(render_dir / "prompt.txt", prompt)
    write_text(render_dir / "README.txt", "\n".join([
        f"card: {card['title']}",
        f"provider: {args.provider}",
        f"fallback_provider: {args.fallback_provider}",
        "status: prompt package prepared; image API invocation not yet wired into terminal foundry",
    ]))

    update_session(
        root,
        current_stage="tarot-render",
        latest_card_render=str((render_dir / "request.json").relative_to(root)),
    )
    append_run_log(
        root,
        "tarot-render",
        f"Prepared tarot render package for {card['title']}",
        {
            "card_id": card["card_id"],
            "provider": args.provider,
            "fallback_provider": args.fallback_provider,
        },
    )
    print(f"wrote {render_dir}")


if __name__ == "__main__":
    main()

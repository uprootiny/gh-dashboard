from __future__ import annotations

from _common import ensure_defaults, ensure_layout, read_json, require_root


EXPECTED_CARD_COUNT = 22
EXPECTED_MVP_COUNT = 20


def main() -> None:
    root, _ = require_root(__import__("sys").argv)
    ensure_layout(root)
    ensure_defaults(root)

    wizard = read_json(root / "design" / "wizard-flow.json", default={}) or {}
    arcana = read_json(root / "design" / "major-arcana.json", default={}) or {}
    matrix = read_json(root / "design" / "compilation-matrix.json", default={}) or {}

    if not wizard or not arcana or not matrix:
        raise SystemExit("missing design assets under foundry/design")

    cards = arcana.get("cards", [])
    if len(cards) != EXPECTED_CARD_COUNT:
        raise SystemExit(f"expected {EXPECTED_CARD_COUNT} major arcana cards, found {len(cards)}")

    card_ids = {card["id"] for card in cards}
    if len(card_ids) != EXPECTED_CARD_COUNT:
        raise SystemExit("duplicate arcana card ids found")

    screen_ids = set()
    for cluster in wizard.get("screen_clusters", []):
        for screen in cluster.get("screens", []):
            screen_id = screen["id"]
            if screen_id in screen_ids:
                raise SystemExit(f"duplicate screen id found: {screen_id}")
            screen_ids.add(screen_id)

    mvp_order = wizard.get("mvp_screen_order", [])
    if len(mvp_order) != EXPECTED_MVP_COUNT:
        raise SystemExit(f"expected {EXPECTED_MVP_COUNT} MVP screens, found {len(mvp_order)}")

    missing_mvp = [screen_id for screen_id in mvp_order if screen_id not in screen_ids]
    if missing_mvp:
        raise SystemExit(f"MVP order references unknown screens: {', '.join(missing_mvp)}")

    missing_weights = sorted(card_ids.difference(matrix.get("card_weights", {}).keys()))
    if missing_weights:
        raise SystemExit(f"missing compilation weights for cards: {', '.join(missing_weights)}")

    known_clusters = set(matrix.get("parameter_clusters", []))
    if not known_clusters:
        raise SystemExit("no parameter clusters defined")

    for card_id, weights in matrix.get("card_weights", {}).items():
        unknown = set(weights.keys()).difference(known_clusters)
        if unknown:
            raise SystemExit(f"card {card_id} references unknown clusters: {', '.join(sorted(unknown))}")

    for mapping in matrix.get("question_mappings", []):
        if mapping["screen_id"] not in screen_ids:
            raise SystemExit(f"question mapping references unknown screen: {mapping['screen_id']}")
        unknown = set(mapping.get("effects", {}).keys()).difference(known_clusters)
        if unknown:
            raise SystemExit(f"question mapping references unknown clusters: {', '.join(sorted(unknown))}")

    print("Design assets valid")
    print("===================")
    print(f"screen_clusters: {len(wizard.get('screen_clusters', []))}")
    print(f"mvp_screens: {len(mvp_order)}")
    print(f"major_arcana: {len(cards)}")
    print(f"parameter_clusters: {len(known_clusters)}")
    print(f"question_mappings: {len(matrix.get('question_mappings', []))}")
    print(f"branching_rules: {len(matrix.get('branching_rules', []))}")


if __name__ == "__main__":
    main()

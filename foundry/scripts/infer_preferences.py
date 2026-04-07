from __future__ import annotations

from _common import append_run_log, ensure_defaults, ensure_layout, now_iso, read_json, require_root, update_session, write_json


def main() -> None:
    root, _ = require_root(__import__("sys").argv)
    ensure_layout(root)
    ensure_defaults(root)
    intake = read_json(root / "inputs" / "intake.json", default={}) or {}
    if not intake:
        raise SystemExit("missing inputs/intake.json; run `foundry intake` first")

    arcana = intake.get("symbolic", {}).get("arcana", [])
    privacy = intake.get("practical", {}).get("privacy", "")
    mode = intake.get("behavioral", {}).get("collaboration_mode", "")
    pain = intake.get("behavioral", {}).get("pain_points", "")
    notes = intake.get("traces", {}).get("notes", "")

    hypotheses = [
        {
            "claim": "User wants symbolic frontstage only when it compiles into explicit tooling behavior.",
            "confidence": "high",
            "evidence": [", ".join(arcana) or "no arcana chosen", intake.get("symbolic", {}).get("motifs", "")],
        },
        {
            "claim": "Trust depends on inspectability and explicit structure.",
            "confidence": "high" if any(term in (pain + notes).lower() for term in ["inspect", "structure", "continuity"]) else "medium",
            "evidence": [pain, notes],
        },
        {
            "claim": "The assistant should behave as a collaborator rather than a hidden automaton.",
            "confidence": "medium",
            "evidence": [mode, privacy],
        },
    ]

    contradictions = []
    if "Chorus" in arcana and "single" in mode.lower():
        contradictions.append("Plural orchestration desired, but collaboration mode implies singular surface.")
    if "strict" in privacy.lower() and "durable" in notes.lower():
        contradictions.append("Strong privacy and strong continuity are both desired; memory policy must be explicit.")
    if not contradictions:
        contradictions.append("No hard contradiction detected, but review autonomy vs. inspectability during build routing.")

    inference = {
        "generated_at": now_iso(),
        "hypotheses": hypotheses,
        "contradictions": contradictions,
        "tension_axes": [
            "speed vs. depth",
            "autonomy vs. control",
            "memory vs. privacy",
            "plurality vs. coherence",
        ],
    }

    write_json(root / "state" / "inference.json", inference)
    update_session(
        root,
        current_stage="infer",
        latest_inference="state/inference.json",
    )
    append_run_log(
        root,
        "infer",
        "Derived hypotheses and tension axes from intake",
        {
            "hypothesis_count": len(hypotheses),
            "contradictions": contradictions,
        },
    )
    print("wrote state/inference.json")


if __name__ == "__main__":
    main()

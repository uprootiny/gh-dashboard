from __future__ import annotations

import argparse
from pathlib import Path

from _common import append_run_log, ensure_defaults, ensure_layout, now_iso, prompt, read_json, require_root, update_session, write_json


def main() -> None:
    root, raw_args = require_root(__import__("sys").argv)
    ensure_layout(root)
    ensure_defaults(root)

    parser = argparse.ArgumentParser(description="Initialize or update foundry intake")
    parser.add_argument("--devices")
    parser.add_argument("--budget")
    parser.add_argument("--hosting")
    parser.add_argument("--privacy")
    parser.add_argument("--domains")
    parser.add_argument("--collaboration-mode")
    parser.add_argument("--ambiguity-tolerance")
    parser.add_argument("--preferred-outputs")
    parser.add_argument("--pain-points")
    parser.add_argument("--working-rhythm")
    parser.add_argument("--arcana")
    parser.add_argument("--motifs")
    parser.add_argument("--trace-notes")
    args = parser.parse_args(raw_args)

    intake_path = root / "inputs" / "intake.json"
    existing = read_json(intake_path, default={}) or {}

    practical = existing.get("practical", {})
    behavioral = existing.get("behavioral", {})
    symbolic = existing.get("symbolic", {})
    traces = existing.get("traces", {})

    intake = {
        "captured_at": now_iso(),
        "practical": {
            "devices": args.devices or prompt("Devices", practical.get("devices", "desktop, laptop, occasional mobile")),
            "budget": args.budget or prompt("Budget / latency", practical.get("budget", "prefer resilience over minimal cost")),
            "hosting": args.hosting or prompt("Hosting", practical.get("hosting", "VPS-first, terminal-native, optional static web front")),
            "privacy": args.privacy or prompt("Privacy posture", practical.get("privacy", "consentful memory, explicit retention controls")),
            "primary_domains": args.domains or prompt("Primary domains", practical.get("primary_domains", "architecture, code hardening, research synthesis")),
        },
        "behavioral": {
            "collaboration_mode": args.collaboration_mode or prompt("Collaboration mode", behavioral.get("collaboration_mode", "collaborator with visible structure")),
            "ambiguity_tolerance": args.ambiguity_tolerance or prompt("Ambiguity tolerance", behavioral.get("ambiguity_tolerance", "medium: infer boldly but keep uncertainty visible")),
            "preferred_outputs": args.preferred_outputs or prompt("Preferred outputs", behavioral.get("preferred_outputs", "nested briefs, implementation plans, prompts, branchable alternatives")),
            "pain_points": args.pain_points or prompt("Pain points", behavioral.get("pain_points", "genericity, brittle magic, poor inspectability, weak continuity")),
            "working_rhythm": args.working_rhythm or prompt("Working rhythm", behavioral.get("working_rhythm", "alternates between deep work and opportunistic capture")),
        },
        "symbolic": {
            "arcana": [item.strip() for item in (args.arcana or prompt("Arcana (comma-separated)", ",".join(symbolic.get("arcana", ["Forge", "Lantern", "Archive"])))).split(",") if item.strip()],
            "motifs": args.motifs or prompt("Symbolic motifs", symbolic.get("motifs", "symbolic frontstage, formal backstage")),
        },
        "traces": {
            "notes": args.trace_notes or prompt("Trace notes", traces.get("notes", "repeated requests for stronger structure and durable context")),
        },
        "resource_posture": {
            "quota_aware": True,
            "preferred_mode": "resume-friendly",
            "long_running_agents": False,
            "parallelism": {"max_jobs": 2},
            "checkpoint_every_step": True,
            "degrade_gracefully": True,
        },
    }

    write_json(intake_path, intake)
    update_session(
        root,
        current_stage="intake",
        latest_intake=str(intake_path.relative_to(root)),
    )
    append_run_log(
        root,
        "intake",
        "Captured or updated intake payload",
        {
            "devices": intake["practical"]["devices"],
            "arcana": intake["symbolic"]["arcana"],
            "hosting": intake["practical"]["hosting"],
        },
    )
    print(f"wrote {intake_path}")


if __name__ == "__main__":
    main()

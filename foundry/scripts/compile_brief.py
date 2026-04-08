from __future__ import annotations

from _common import append_run_log, ensure_defaults, ensure_layout, now_iso, read_json, render_edn, require_root, update_session, write_json, write_text


def main() -> None:
    root, _ = require_root(__import__("sys").argv)
    ensure_layout(root)
    ensure_defaults(root)
    intake = read_json(root / "inputs" / "intake.json", default={}) or {}
    inference = read_json(root / "state" / "inference.json", default={}) or {}
    if not intake:
        raise SystemExit("missing inputs/intake.json; run `foundry intake` first")

    arcana = intake["symbolic"]["arcana"]
    privacy = intake["practical"]["privacy"]
    mode = intake["behavioral"]["collaboration_mode"]
    wants_plural = "Chorus" in arcana
    wants_archive = "Archive" in arcana
    wants_verify = "Lantern" in arcana
    wants_iterate = any(card in arcana for card in ["Forge", "Mirror"])
    wants_privacy = "strict" in privacy.lower() or "consent" in privacy.lower() or "private" in privacy.lower()

    brief = {
        "generated_at": now_iso(),
        "portrait": {
            "summary": f"User appears to want a {mode} harness with {privacy}.",
            "workstyle": [
                intake["behavioral"]["working_rhythm"],
                "iterative and revision-tolerant" if wants_iterate else "prefers convergent output",
                "expects explicit structure and reusable artifacts",
            ],
            "aiRelationship": [
                mode,
                "comfortable with plurality if merge is explicit" if wants_plural else "prefers a single coherent interface",
                "trust depends on evidence and uncertainty visibility" if wants_verify else "accepts best-effort synthesis with revision hooks",
            ],
            "operationalNeeds": [
                intake["practical"]["hosting"],
                intake["practical"]["devices"],
                "reviewable persistence and explicit consent gates" if wants_privacy else "durable history with configurable retention",
            ],
        },
        "hypotheses": inference.get("hypotheses", []),
        "contradictions": inference.get("contradictions", []),
        "archetypes": list(dict.fromkeys([
            "Switchboard" if wants_plural else "Foundry",
            "Conservatory" if wants_archive else "Atelier",
            "Shrine" if wants_privacy else "Observatory",
        ])),
        "capabilities": [
            "three-strata intake compiler",
            "editable preference hypotheses",
            "durable task ledger",
            "quota-aware routing",
            "tarot prompt and render pipeline",
            "resume-friendly checkpointing",
            "agent compare-and-merge surfaces" if wants_plural else "single-thread structured collaboration",
            "evidence and confidence channels" if wants_verify else "fast synthesis with revision hooks",
        ],
        "uiRecommendations": [
            "compare-and-merge panes for agent outputs" if wants_plural else "single primary workbench as default",
            "preserve branch history and side-by-side diffs" if wants_iterate else "keep the interface concise under overload",
            "expose evidence drawers and confidence markers" if wants_verify else "prefer direct synthesis with optional drill-down",
        ],
        "behavioralContract": [
            "keep uncertainty visible",
            "ask before durable memory writes" if wants_privacy else "make memory controls explicit",
            "do not hide agent disagreement" if wants_plural else "do not fabricate plurality for its own sake",
            "checkpoint every step",
        ],
        "implementationPlan": [
            "stabilize the PersonalBrief schema as the core artifact",
            "generate routed task packets for Claude Code, Codex, and Gemini",
            "persist prompts, outputs, diffs, and task status in the ledger",
            "render tarot cards via Stability first and fal as fallback",
        ],
        "toolSurface": {
            "cli": [
                "foundry intake",
                "foundry infer",
                "foundry compile",
                "foundry build",
                "foundry benchmark",
                "foundry run-agent --job-id <job-id>",
                "foundry accept-output --job-id <job-id> --decision accept",
                "foundry tarot-render --card the-lantern",
                "foundry resume",
            ],
            "artifacts": [
                "inputs/intake.json",
                "state/inference.json",
                "briefs/personal-brief.json",
                "briefs/personal-brief.edn",
                "state/jobs.json",
                "state/benchmark-report.json",
                "state/agent-runs.json",
                "state/reviews.json",
                "cards/renders/<card>/request.json",
            ],
            "policies": [
                "checkpoint every step",
                "prefer deterministic local compilation before API calls",
                "defer expensive agents until brief quality is coherent",
            ],
        },
        "buildAgents": [
            "Interview Interpreter",
            "Personal Ontologist",
            "Claude Code Architect",
            "Codex Implementer",
            "Gemini Utility Analyst",
            "Reviewer and Critic",
        ],
        "notesForReview": [
            "This brief is deterministic and unvalidated; treat it as a strong draft, not a verdict.",
            "Resource posture should shape routing before any expensive model use.",
        ],
        "resourcePosture": intake["resource_posture"],
    }

    json_path = root / "briefs" / "personal-brief.json"
    edn_path = root / "briefs" / "personal-brief.edn"
    prompt_pack_path = root / "briefs" / "prompt-pack.json"
    tool_manifest_path = root / "briefs" / "tool-manifest.json"
    scaffold_path = root / "briefs" / "starter-scaffold.txt"

    prompt_pack = {
        "system": {
            "identity": "Primary assistant inside a personal AI harness shaped by Ἑυνοῦς.",
            "contract": brief["behavioralContract"],
            "workstyle": brief["portrait"]["workstyle"],
            "capabilities": brief["capabilities"],
        },
        "agents": {
            "architect": "Translate the brief into topology, interfaces, and implementation order.",
            "implementer": "Generate bounded scaffolds and edits without violating the brief.",
            "critic": "Surface contradictions, privacy risks, and unjustified leaps.",
            "ritualist": "Maintain symbolic coherence without inventing nonfunctional theater.",
        },
    }
    tool_manifest = {
        "name": "hynous-terminal-foundry",
        "entrypoint": "foundry/bin/foundry",
        "brief": str(json_path.relative_to(root)),
        "commands": brief["toolSurface"]["cli"],
        "state_files": [
            "state/session.json",
            "state/quotas.json",
            "state/inference.json",
            "state/jobs.json",
        ],
        "agents": brief["buildAgents"],
        "routing": {
            "claude-code": ["architecture", "synthesis", "final review"],
            "codex": ["implementation", "scaffold generation", "tests"],
            "gemini": ["classification", "prompt support", "cheap review"],
        },
    }
    scaffold_text = "\n".join(
        [
            "foundry/",
            "  bin/foundry",
            "  inputs/intake.json",
            "  state/session.json",
            "  state/quotas.json",
            "  briefs/personal-brief.json",
            "  briefs/personal-brief.edn",
            "  briefs/prompt-pack.json",
            "  briefs/tool-manifest.json",
            "  benchmarks/suite.json",
            "  tasks/01-brief-compile-review.md",
            "  tasks/01-brief-compile-review.json",
            "  artifacts/<job-id>/latest-output.md",
            "  state/benchmark-report.json",
            "  state/agent-runs.json",
            "  state/reviews.json",
            "  cards/defs/the-lantern.json",
            "  cards/renders/the-lantern/request.json",
            "  agents/roles/architect.md",
            "  agents/roles/ontologist.md",
            "  agents/roles/implementer.md",
            "  agents/roles/critic.md",
            "  agents/roles/ritualist.md",
        ]
    )

    write_json(json_path, brief)
    write_text(edn_path, render_edn(brief))
    write_json(prompt_pack_path, prompt_pack)
    write_json(tool_manifest_path, tool_manifest)
    write_text(scaffold_path, scaffold_text)
    update_session(
        root,
        current_stage="compile",
        latest_brief_json=str(json_path.relative_to(root)),
        latest_brief_edn=str(edn_path.relative_to(root)),
        latest_prompt_pack=str(prompt_pack_path.relative_to(root)),
        latest_tool_manifest=str(tool_manifest_path.relative_to(root)),
    )
    append_run_log(
        root,
        "compile",
        "Compiled PersonalBrief and supporting artifacts",
        {
            "archetypes": brief["archetypes"],
            "capability_count": len(brief["capabilities"]),
            "tool_manifest": str(tool_manifest_path.relative_to(root)),
        },
    )
    print(f"wrote {json_path}")
    print(f"wrote {edn_path}")
    print(f"wrote {prompt_pack_path}")
    print(f"wrote {tool_manifest_path}")
    print(f"wrote {scaffold_path}")


if __name__ == "__main__":
    main()

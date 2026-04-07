from __future__ import annotations

from _common import append_run_log, ensure_defaults, ensure_layout, now_iso, read_json, require_root, slugify, update_session, write_json, write_text


def main() -> None:
    root, _ = require_root(__import__("sys").argv)
    ensure_layout(root)
    ensure_defaults(root)
    brief = read_json(root / "briefs" / "personal-brief.json", default={}) or {}
    if not brief:
        raise SystemExit("missing briefs/personal-brief.json; run `foundry compile` first")

    jobs = [
        {
            "id": "brief-compile-review",
            "kind": "synthesis",
            "agent_role": "architect",
            "preferred_agent": "claude-code",
            "fallback_agent": "codex",
            "max_cost": "high",
            "token_budget": 12000,
            "time_budget_minutes": 18,
            "allowed_tools": ["read", "analyze", "summarize"],
            "title": "Review and tighten the compiled PersonalBrief",
            "goal": "Ensure contradictions, capability mapping, and architectural posture are coherent.",
        },
        {
            "id": "schema-scaffold",
            "kind": "implementation",
            "agent_role": "implementer",
            "preferred_agent": "codex",
            "fallback_agent": "gemini",
            "max_cost": "medium",
            "token_budget": 9000,
            "time_budget_minutes": 15,
            "allowed_tools": ["read", "write", "test"],
            "title": "Generate the starter schema and scaffold",
            "goal": "Produce concrete starter files and implementation surfaces from the brief.",
        },
        {
            "id": "tarot-prompts",
            "kind": "prompt-design",
            "agent_role": "ritualist",
            "preferred_agent": "gemini",
            "fallback_agent": "claude-code",
            "max_cost": "low",
            "token_budget": 5000,
            "time_budget_minutes": 10,
            "allowed_tools": ["read", "summarize"],
            "title": "Refine tarot card prompt packs",
            "goal": "Turn selected arcana into image-ready prompt specs and negative motifs.",
        },
        {
            "id": "policy-audit",
            "kind": "review",
            "agent_role": "critic",
            "preferred_agent": "claude-code",
            "fallback_agent": "gemini",
            "max_cost": "medium",
            "token_budget": 7000,
            "time_budget_minutes": 12,
            "allowed_tools": ["read", "analyze"],
            "title": "Audit privacy and persistence policy",
            "goal": "Check whether the memory posture, consent gates, and retention defaults match the brief.",
        },
    ]

    tasks_dir = root / "tasks"
    for index, job in enumerate(jobs, start=1):
        stem = f"{index:02d}-{slugify(job['id'])}"
        filename = tasks_dir / f"{stem}.md"
        json_filename = tasks_dir / f"{stem}.json"
        packet = {
            "job_id": job["id"],
            "agent_role": job["agent_role"],
            "preferred_agent": job["preferred_agent"],
            "fallback_agent": job["fallback_agent"],
            "input_artifacts": [
                "briefs/personal-brief.json",
                "briefs/prompt-pack.json",
                "state/jobs.json",
            ],
            "target_files": [str(filename.relative_to(root))],
            "task_statement": job["goal"],
            "constraints": brief.get("behavioralContract", []),
            "success_conditions": [
                "produce a concrete artifact",
                "preserve quota-aware and resume-friendly posture",
                "call out contradictions and unresolved risks explicitly",
            ],
            "time_budget_minutes": job["time_budget_minutes"],
            "token_budget": job["token_budget"],
            "allowed_tools": job["allowed_tools"],
            "expected_output_shape": {
                "summary": "markdown",
                "result": "artifact bundle",
                "risks": "list",
            },
            "resume_from": "state/session.json",
            "trace_parent": "state/jobs.json",
        }
        content = [
            f"# {job['title']}",
            "",
            f"- agent_role: `{job['agent_role']}`",
            f"- preferred_agent: `{job['preferred_agent']}`",
            f"- fallback_agent: `{job['fallback_agent']}`",
            f"- max_cost: `{job['max_cost']}`",
            f"- kind: `{job['kind']}`",
            f"- token_budget: `{job['token_budget']}`",
            f"- time_budget_minutes: `{job['time_budget_minutes']}`",
            f"- allowed_tools: `{', '.join(job['allowed_tools'])}`",
            "",
            "## Goal",
            job["goal"],
            "",
            "## Brief context",
            f"- summary: {brief['portrait']['summary']}",
            f"- archetypes: {', '.join(brief.get('archetypes', []))}",
            f"- key capabilities: {', '.join(brief.get('capabilities', [])[:6])}",
            "",
            "## Contract",
            *[f"- {item}" for item in brief.get("behavioralContract", [])],
            "",
            "## Expected output",
            "- Produce a concrete artifact, not commentary alone.",
            "- Preserve quota-aware and resume-friendly posture.",
            "- Call out contradictions and unresolved risks explicitly.",
        ]
        write_text(filename, "\n".join(content))
        write_json(json_filename, packet)

    job_ledger = {
        "generated_at": now_iso(),
        "jobs": jobs,
        "artifacts": {
            "brief": "briefs/personal-brief.json",
            "prompt_pack": "briefs/prompt-pack.json",
            "tool_manifest": "briefs/tool-manifest.json",
            "task_packets": "tasks/*.json",
        },
        "quota_policy": {
            "tier_1": ["claude-code"],
            "tier_2": ["codex"],
            "tier_3": ["gemini"],
            "max_parallel_jobs": brief.get("resourcePosture", {}).get("parallelism", {}).get("max_jobs", 2),
            "checkpoint_every_step": True,
            "degrade_gracefully": True,
        },
    }

    write_json(root / "state" / "jobs.json", job_ledger)
    update_session(
        root,
        current_stage="build",
        latest_jobs="state/jobs.json",
    )
    append_run_log(
        root,
        "build",
        "Generated task packets and job ledger",
        {
            "job_count": len(jobs),
            "tasks_dir": "tasks/",
            "task_packets": True,
        },
    )
    print("wrote tasks/ and state/jobs.json")


if __name__ == "__main__":
    main()

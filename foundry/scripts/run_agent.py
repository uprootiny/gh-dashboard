from __future__ import annotations

import argparse
from pathlib import Path

from _common import (
    append_json_list,
    append_run_log,
    ensure_defaults,
    ensure_layout,
    load_job,
    now_iso,
    read_json,
    require_root,
    task_path_for_job,
    update_session,
    write_json,
    write_text,
)


def choose_agent(job: dict, quotas: dict, requested: str | None) -> tuple[str, str | None]:
    preferred = requested or job["preferred_agent"]
    agents = quotas.get("agents", {})
    preferred_state = agents.get(preferred, {})
    if preferred_state.get("available", True):
        return preferred, None
    fallback = job.get("fallback_agent")
    fallback_state = agents.get(fallback, {})
    if fallback and fallback_state.get("available", True):
        return fallback, preferred
    raise SystemExit(f"no available agent for job {job['id']}")


def build_artifact(job: dict, brief: dict, agent: str, task_packet: str) -> tuple[str, dict]:
    summary = brief["portrait"]["summary"]
    contract = brief.get("behavioralContract", [])
    capabilities = brief.get("capabilities", [])
    contradictions = brief.get("contradictions", [])
    contradiction_lines = [f"- {item}" for item in contradictions[:3]] if contradictions else ["- none surfaced in current brief"]
    notes = []
    if "policy" in job["id"]:
        notes.append("Privacy defaults should remain explicit and revocable.")
    if "schema" in job["id"]:
        notes.append("Scaffold should preserve the brief as the control artifact, not bypass it.")
    if not notes:
        notes.append("Output should remain inspectable and revisable.")

    output = "\n".join(
        [
            f"# {job['title']}",
            "",
            f"agent: {agent}",
            f"job_id: {job['id']}",
            "",
            "## Parent brief summary",
            summary,
            "",
            "## Task packet excerpt",
            task_packet.strip(),
            "",
            "## Child output",
            f"This pass tightens `{job['kind']}` work around the current brief and preserves the contract instead of free-ranging beyond it.",
            "",
            "## Constraints honored",
            *[f"- {item}" for item in contract],
            "",
            "## Capabilities in play",
            *[f"- {item}" for item in capabilities[:5]],
            "",
            "## Contradictions to preserve",
            *contradiction_lines,
            "",
            "## Notes",
            *[f"- {item}" for item in notes],
        ]
    )
    meter = {
        "synthetic_tokens_in": 600 + len(task_packet.split()),
        "synthetic_tokens_out": 420 + len(output.split()),
        "latency_ms": 900 if agent == "gemini" else 1400 if agent == "codex" else 2200,
        "cost_tier": job["max_cost"],
        "degraded_from": None,
    }
    return output, meter


def main() -> None:
    root, raw_args = require_root(__import__("sys").argv)
    ensure_layout(root)
    ensure_defaults(root)

    parser = argparse.ArgumentParser(description="Execute or simulate a child agent run for a routed job")
    parser.add_argument("--job-id", required=True)
    parser.add_argument("--agent")
    parser.add_argument("--simulate", action="store_true", default=True)
    args = parser.parse_args(raw_args)

    brief = read_json(root / "briefs" / "personal-brief.json", default={}) or {}
    if not brief:
        raise SystemExit("missing briefs/personal-brief.json; run `foundry compile` first")

    job = load_job(root, args.job_id)
    quotas = read_json(root / "state" / "quotas.json", default={}) or {}
    chosen_agent, degraded_from = choose_agent(job, quotas, args.agent)
    task_path = task_path_for_job(root, args.job_id)
    task_packet = task_path.read_text()
    task_json_path = task_path.with_suffix(".json")
    task_packet_json = read_json(task_json_path, default={}) or {}

    output, meter = build_artifact(job, brief, chosen_agent, task_packet)
    meter["degraded_from"] = degraded_from

    artifact_dir = root / "artifacts" / job["id"]
    artifact_dir.mkdir(parents=True, exist_ok=True)
    artifact_path = artifact_dir / "latest-output.md"
    metadata_path = artifact_dir / "latest-run.json"

    run_record = {
        "id": f"{job['id']}:{now_iso()}",
        "created_at": now_iso(),
        "job_id": job["id"],
        "agent_role": job.get("agent_role"),
        "kind": job["kind"],
        "status": "completed",
        "agent": chosen_agent,
        "degraded_from": degraded_from,
        "task_packet": str(task_path.relative_to(root)),
        "task_packet_json": str(task_json_path.relative_to(root)) if task_packet_json else None,
        "artifact": str(artifact_path.relative_to(root)),
        "meter": meter,
        "budgets": {
            "token_budget": job.get("token_budget"),
            "time_budget_minutes": job.get("time_budget_minutes"),
        },
        "summary": f"Completed child run for {job['id']} via {chosen_agent}",
    }

    write_text(artifact_path, output)
    write_json(metadata_path, run_record)
    append_json_list(root / "state" / "agent-runs.json", run_record)
    append_run_log(root, "run-agent", run_record["summary"], run_record)
    update_session(
        root,
        current_stage="run-agent",
        latest_agent_run=str(metadata_path.relative_to(root)),
    )
    print(f"wrote {artifact_path}")
    print(f"wrote {metadata_path}")


if __name__ == "__main__":
    main()

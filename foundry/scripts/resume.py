from __future__ import annotations

from _common import ensure_layout, read_json, require_root


def main() -> None:
    root, _ = require_root(__import__("sys").argv)
    ensure_layout(root)
    session = read_json(root / "state" / "session.json", default={}) or {}
    intake = read_json(root / "inputs" / "intake.json", default={}) or {}
    inference = read_json(root / "state" / "inference.json", default={}) or {}
    jobs = read_json(root / "state" / "jobs.json", default={}) or {}
    agent_runs = read_json(root / "state" / "agent-runs.json", default=[]) or []
    reviews = read_json(root / "state" / "reviews.json", default=[]) or []

    print("Foundry resume")
    print("==============")
    print(f"current_stage: {session.get('current_stage', 'uninitialized')}")
    print(f"updated_at: {session.get('updated_at', 'unknown')}")
    print("")
    print("Latest artifacts")
    print("---------------")
    for key, value in session.items():
        if key in {"current_stage", "updated_at"}:
            continue
        print(f"{key}: {value}")
    print("")
    print("Intake summary")
    print("-------------")
    if intake:
        print(f"domains: {intake['practical']['primary_domains']}")
        print(f"arcana: {', '.join(intake['symbolic']['arcana'])}")
    else:
        print("No intake captured yet.")
    print("")
    print("Inference")
    print("---------")
    for hypothesis in inference.get("hypotheses", [])[:3]:
        print(f"- {hypothesis['claim']} ({hypothesis['confidence']})")
    print("")
    print("Jobs")
    print("----")
    for job in jobs.get("jobs", []):
        status = job.get("status", "pending")
        print(f"- {job['id']} -> {job['preferred_agent']} (fallback {job['fallback_agent']}) [{status}]")
    print("")
    print("Child runs")
    print("----------")
    for run in agent_runs[-3:]:
        print(f"- {run['job_id']} via {run['agent']} tokens {run['meter']['synthetic_tokens_in']}/{run['meter']['synthetic_tokens_out']}")
    print("")
    print("Reviews")
    print("-------")
    for review in reviews[-3:]:
        print(f"- {review['job_id']}: {review['decision']} ({review['notes']})")


if __name__ == "__main__":
    main()

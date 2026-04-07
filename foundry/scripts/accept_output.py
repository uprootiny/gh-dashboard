from __future__ import annotations

import argparse

from _common import (
    append_json_list,
    append_run_log,
    ensure_defaults,
    ensure_layout,
    load_job,
    now_iso,
    read_json,
    require_root,
    update_session,
    write_json,
)


def latest_run_for_job(root, job_id: str) -> dict:
    runs = read_json(root / "state" / "agent-runs.json", default=[]) or []
    matches = [run for run in runs if run.get("job_id") == job_id]
    if not matches:
        raise SystemExit(f"no child runs recorded for job {job_id}")
    return matches[-1]


def main() -> None:
    root, raw_args = require_root(__import__("sys").argv)
    ensure_layout(root)
    ensure_defaults(root)

    parser = argparse.ArgumentParser(description="Accept, reject, or request revision on a child agent output")
    parser.add_argument("--job-id", required=True)
    parser.add_argument("--decision", choices=["accept", "revise", "reject"], required=True)
    parser.add_argument("--notes", default="")
    args = parser.parse_args(raw_args)

    job = load_job(root, args.job_id)
    run_record = latest_run_for_job(root, args.job_id)
    review = {
        "id": f"{job['id']}:{args.decision}:{now_iso()}",
        "created_at": now_iso(),
        "job_id": job["id"],
        "run_id": run_record["id"],
        "decision": args.decision,
        "notes": args.notes or "No review note supplied.",
        "artifact": run_record["artifact"],
    }

    append_json_list(root / "state" / "reviews.json", review)

    job_ledger = read_json(root / "state" / "jobs.json", default={}) or {}
    updated_jobs = []
    for existing in job_ledger.get("jobs", []):
        if existing.get("id") == job["id"]:
            existing = dict(existing)
            existing["status"] = {
                "accept": "accepted",
                "revise": "needs_revision",
                "reject": "rejected",
            }[args.decision]
            existing["last_reviewed_at"] = review["created_at"]
            existing["latest_run_id"] = run_record["id"]
        updated_jobs.append(existing)
    job_ledger["jobs"] = updated_jobs
    write_json(root / "state" / "jobs.json", job_ledger)

    append_run_log(root, "accept-output", f"{args.decision} review for {job['id']}", review)
    update_session(
        root,
        current_stage="accept-output",
        latest_review="state/reviews.json",
    )
    print(f"recorded {args.decision} for {job['id']}")


if __name__ == "__main__":
    main()

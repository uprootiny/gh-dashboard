from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

from _common import append_run_log, ensure_defaults, ensure_layout, now_iso, read_json, require_root, update_session, write_json

REPO_ROOT = Path(__file__).resolve().parents[2]


def run_command(cwd: Path, argv: list[str]) -> tuple[str, str, int]:
    completed = subprocess.run(
        argv,
        cwd=cwd,
        text=True,
        capture_output=True,
    )
    return completed.stdout, completed.stderr, completed.returncode


def evaluate_benchmark(foundry_root: Path, benchmark: dict) -> dict:
    check = benchmark["check"]
    status = "fail"
    score = 0.0
    details: dict[str, object] = {}

    if check["kind"] == "command":
        cwd = REPO_ROOT if check.get("cwd") == "repo" else foundry_root
        stdout, stderr, returncode = run_command(cwd, check["argv"])
        status = "pass" if returncode == 0 else "fail"
        score = 1.0 if returncode == 0 else 0.0
        details = {
            "argv": check["argv"],
            "returncode": returncode,
            "stdout_tail": "\n".join(stdout.strip().splitlines()[-8:]) if stdout.strip() else "",
            "stderr_tail": "\n".join(stderr.strip().splitlines()[-8:]) if stderr.strip() else "",
        }
    elif check["kind"] == "files_exist":
        missing = []
        for relative in check["paths"]:
            if not (foundry_root / relative).exists():
                missing.append(relative)
        status = "pass" if not missing else "fail"
        score = 1.0 if not missing else 0.0
        details = {
            "checked_paths": check["paths"],
            "missing_paths": missing,
        }
    elif check["kind"] == "manual_note":
        status = "partial"
        score = 0.5
        details = {
            "note": check["message"],
        }
    else:
        details = {"error": f"unknown check kind: {check['kind']}"}

    return {
        "id": benchmark["id"],
        "title": benchmark["title"],
        "class": benchmark["class"],
        "verification_cost": benchmark["verification_cost"],
        "source": benchmark["source"],
        "status": status,
        "score": score,
        "details": details,
    }


def summarize(results: list[dict]) -> dict:
    total = len(results)
    passed = sum(1 for item in results if item["status"] == "pass")
    partial = sum(1 for item in results if item["status"] == "partial")
    failed = sum(1 for item in results if item["status"] == "fail")
    average = round(sum(item["score"] for item in results) / total, 3) if total else 0.0

    by_class: dict[str, dict[str, float | int]] = {}
    for item in results:
        bucket = by_class.setdefault(item["class"], {"count": 0, "avg_score": 0.0})
        bucket["count"] += 1
        bucket["avg_score"] += item["score"]

    for bucket in by_class.values():
        count = int(bucket["count"])
        bucket["avg_score"] = round(float(bucket["avg_score"]) / count, 3) if count else 0.0

    return {
        "total": total,
        "passed": passed,
        "partial": partial,
        "failed": failed,
        "average_score": average,
        "by_class": by_class,
    }


def main() -> None:
    root, raw_args = require_root(__import__("sys").argv)
    ensure_layout(root)
    ensure_defaults(root)

    parser = argparse.ArgumentParser(description="Run the local benchmark suite and score benchmark classes")
    parser.add_argument("--suite", default="benchmarks/suite.json")
    args = parser.parse_args(raw_args)

    suite_path = root / args.suite
    suite = read_json(suite_path, default={}) or {}
    if not suite:
        raise SystemExit(f"missing benchmark suite: {suite_path}")

    results = [evaluate_benchmark(root, benchmark) for benchmark in suite.get("benchmarks", [])]
    summary = summarize(results)
    report = {
        "generated_at": now_iso(),
        "suite": str(suite_path.relative_to(root)),
        "methodology": suite.get("methodology", {}),
        "summary": summary,
        "results": results,
    }

    report_path = root / "state" / "benchmark-report.json"
    write_json(report_path, report)
    update_session(
        root,
        current_stage="benchmark",
        latest_benchmark_report=str(report_path.relative_to(root)),
    )
    append_run_log(
        root,
        "benchmark",
        "Ran local benchmark suite",
        {
            "summary": summary,
            "suite": str(suite_path.relative_to(root)),
        },
    )

    print("Benchmark summary")
    print("=================")
    print(f"passed: {summary['passed']}/{summary['total']}")
    print(f"partial: {summary['partial']}")
    print(f"failed: {summary['failed']}")
    print(f"average_score: {summary['average_score']}")
    for class_name, bucket in summary["by_class"].items():
        print(f"- {class_name}: {bucket['count']} benchmark(s), avg_score {bucket['avg_score']}")
    print(f"wrote {report_path}")


if __name__ == "__main__":
    main()

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def slugify(value: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower()).strip("-")
    return value or "item"


def ensure_layout(root: Path) -> dict[str, Path]:
    paths = {
        "root": root,
        "state": root / "state",
        "locks": root / "state" / "locks",
        "briefs": root / "briefs",
        "inputs": root / "inputs",
        "traces": root / "inputs" / "traces",
        "cards_defs": root / "cards" / "defs",
        "cards_renders": root / "cards" / "renders",
        "agents_roles": root / "agents" / "roles",
        "tasks": root / "tasks",
        "runs": root / "runs",
        "templates": root / "templates",
        "scripts": root / "scripts",
    }
    for path in paths.values():
        if path.suffix:
            continue
        path.mkdir(parents=True, exist_ok=True)
    return paths


def read_json(path: Path, default: Any | None = None) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text())


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n")


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text.rstrip() + "\n")


def require_root(argv: list[str]) -> tuple[Path, list[str]]:
    if len(argv) < 2:
        raise SystemExit("expected foundry root path as argv[1]")
    root = Path(argv[1]).resolve()
    return root, argv[2:]


def update_session(root: Path, **entries: Any) -> dict[str, Any]:
    session_path = root / "state" / "session.json"
    session = read_json(session_path, default={}) or {}
    session.update(entries)
    session["updated_at"] = now_iso()
    write_json(session_path, session)
    return session


def append_run_log(root: Path, stage: str, summary: str, details: dict[str, Any] | None = None) -> Path:
    run_dir = root / "runs" / datetime.now(timezone.utc).strftime("%Y%m%d")
    run_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%H%M%S")
    path = run_dir / f"{stamp}-{slugify(stage)}.json"
    payload = {
        "created_at": now_iso(),
        "stage": stage,
        "summary": summary,
        "details": details or {},
    }
    write_json(path, payload)
    return path


def ensure_defaults(root: Path) -> None:
    quotas_path = root / "state" / "quotas.json"
    if not quotas_path.exists():
        write_json(
            quotas_path,
            {
                "updated_at": now_iso(),
                "agents": {
                    "claude-code": {"tier": 1, "budget": "high", "available": True},
                    "codex": {"tier": 2, "budget": "medium", "available": True},
                    "gemini": {"tier": 3, "budget": "low", "available": True},
                },
                "policy": {
                    "quota_aware": True,
                    "max_parallel_jobs": 2,
                    "checkpoint_every_step": True,
                    "degrade_gracefully": True,
                },
            },
        )


def upsert_json_list(path: Path, item: dict[str, Any], key: str = "id") -> list[dict[str, Any]]:
    current = read_json(path, default=[]) or []
    replaced = False
    for index, existing in enumerate(current):
        if existing.get(key) == item.get(key):
            current[index] = item
            replaced = True
            break
    if not replaced:
        current.append(item)
    write_json(path, current)
    return current


def append_json_list(path: Path, item: dict[str, Any]) -> list[dict[str, Any]]:
    current = read_json(path, default=[]) or []
    current.append(item)
    write_json(path, current)
    return current


def load_job(root: Path, job_id: str) -> dict[str, Any]:
    jobs = read_json(root / "state" / "jobs.json", default={}) or {}
    for job in jobs.get("jobs", []):
        if job.get("id") == job_id:
            return job
    raise SystemExit(f"unknown job id: {job_id}")


def task_path_for_job(root: Path, job_id: str) -> Path:
    tasks_dir = root / "tasks"
    matches = sorted(tasks_dir.glob(f"*-{slugify(job_id)}.md"))
    if not matches:
        raise SystemExit(f"no task packet found for job: {job_id}")
    return matches[0]


def prompt(label: str, default: str = "") -> str:
    suffix = f" [{default}]" if default else ""
    value = input(f"{label}{suffix}: ").strip()
    return value or default


def render_edn(value: Any, indent: int = 0) -> str:
    space = " " * indent
    if isinstance(value, dict):
        items = []
        for key, inner in value.items():
            items.append(f"{space}:{key} {render_edn(inner, indent + 2).lstrip()}")
        return "{\n" + "\n".join(items) + f"\n{space}" + "}"
    if isinstance(value, list):
        if not value:
            return "[]"
        items = [render_edn(item, indent + 2).lstrip() for item in value]
        return "[\n" + "\n".join(f"{space}  {item}" for item in items) + f"\n{space}]"
    if isinstance(value, bool):
        return "true" if value else "false"
    if value is None:
        return "nil"
    if isinstance(value, (int, float)):
        return str(value)
    escaped = str(value).replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'

from __future__ import annotations

import json
import subprocess
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path("/Users/uprootiny/anotherone/onetwennyseven/gh-dashboard")
SCRIPTS = REPO_ROOT / "foundry" / "scripts"
SOURCE_FOUNDY = REPO_ROOT / "foundry"


class FoundryCliTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        for rel in [
            Path("cards/defs/the-lantern.json"),
            Path("cards/defs/the-forge.json"),
            Path("cards/defs/the-archive.json"),
            Path("cards/defs/the-veil.json"),
            Path("cards/defs/the-chorus.json"),
        ]:
            target = self.root / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text((SOURCE_FOUNDY / rel).read_text())

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def run_script(self, name: str, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["python3", str(SCRIPTS / name), str(self.root), *args],
            cwd=REPO_ROOT,
            text=True,
            capture_output=True,
            check=True,
        )

    def test_full_pipeline_emits_core_artifacts(self) -> None:
        self.run_script(
            "intake.py",
            "--devices",
            "desktop,laptop",
            "--budget",
            "resilience over cost",
            "--hosting",
            "vps-first",
            "--privacy",
            "consentful durable memory",
            "--domains",
            "architecture,code hardening",
            "--collaboration-mode",
            "single visible collaborator",
            "--ambiguity-tolerance",
            "low",
            "--preferred-outputs",
            "briefs, plans, prompts",
            "--pain-points",
            "inspectability and brittle magic",
            "--working-rhythm",
            "deep work and opportunistic capture",
            "--arcana",
            "Forge,Lantern,Archive",
            "--motifs",
            "symbolic frontstage, formal backstage",
            "--trace-notes",
            "needs durable context and explicit structure",
        )
        self.run_script("infer_preferences.py")
        self.run_script("compile_brief.py")
        self.run_script("route_jobs.py")
        self.run_script("run_agent.py", "--job-id", "schema-scaffold")
        self.run_script("accept_output.py", "--job-id", "schema-scaffold", "--decision", "accept", "--notes", "scaffold accepted")
        self.run_script("render_card.py", "--card", "the-lantern")

        brief = json.loads((self.root / "briefs" / "personal-brief.json").read_text())
        jobs = json.loads((self.root / "state" / "jobs.json").read_text())
        agent_runs = json.loads((self.root / "state" / "agent-runs.json").read_text())
        reviews = json.loads((self.root / "state" / "reviews.json").read_text())
        render = json.loads((self.root / "cards" / "renders" / "the-lantern" / "request.json").read_text())

        self.assertIn("toolSurface", brief)
        self.assertIn("prompt-pack.json", (self.root / "briefs" / "starter-scaffold.txt").read_text())
        self.assertEqual(jobs["quota_policy"]["max_parallel_jobs"], 2)
        self.assertEqual(jobs["jobs"][1]["status"], "accepted")
        self.assertTrue((self.root / "tasks" / "02-schema-scaffold.json").exists())
        self.assertEqual(agent_runs[-1]["job_id"], "schema-scaffold")
        self.assertEqual(reviews[-1]["decision"], "accept")
        self.assertEqual(render["outputs"], ["upright", "reversed", "emblem", "monochrome"])
        self.assertTrue((self.root / "tasks" / "04-policy-audit.md").exists())

    def test_resume_reports_stage(self) -> None:
        self.run_script(
            "intake.py",
            "--devices",
            "desktop",
            "--budget",
            "balanced",
            "--hosting",
            "vps",
            "--privacy",
            "strict private boundaries",
            "--domains",
            "research synthesis",
            "--collaboration-mode",
            "collaborator with visible structure",
            "--ambiguity-tolerance",
            "medium",
            "--preferred-outputs",
            "plans",
            "--pain-points",
            "genericity",
            "--working-rhythm",
            "steady",
            "--arcana",
            "Veil,Lantern",
            "--motifs",
            "ritual but typed",
            "--trace-notes",
            "privacy matters",
        )
        result = self.run_script("resume.py")
        self.assertIn("current_stage: intake", result.stdout)

    def test_agent_falls_back_when_preferred_unavailable(self) -> None:
        self.run_script(
            "intake.py",
            "--devices",
            "desktop",
            "--budget",
            "balanced",
            "--hosting",
            "vps",
            "--privacy",
            "consentful memory",
            "--domains",
            "architecture",
            "--collaboration-mode",
            "visible collaborator",
            "--ambiguity-tolerance",
            "medium",
            "--preferred-outputs",
            "plans",
            "--pain-points",
            "inspectability",
            "--working-rhythm",
            "steady",
            "--arcana",
            "Forge,Lantern",
            "--motifs",
            "typed ritual",
            "--trace-notes",
            "needs explicit structure",
        )
        self.run_script("infer_preferences.py")
        self.run_script("compile_brief.py")
        self.run_script("route_jobs.py")

        quotas = json.loads((self.root / "state" / "quotas.json").read_text())
        quotas["agents"]["codex"]["available"] = False
        (self.root / "state" / "quotas.json").write_text(json.dumps(quotas, indent=2) + "\n")

        self.run_script("run_agent.py", "--job-id", "schema-scaffold")
        agent_runs = json.loads((self.root / "state" / "agent-runs.json").read_text())
        self.assertEqual(agent_runs[-1]["agent"], "gemini")
        self.assertEqual(agent_runs[-1]["degraded_from"], "codex")


if __name__ == "__main__":
    unittest.main()

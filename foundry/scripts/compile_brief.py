from __future__ import annotations

from collections import defaultdict

from _common import append_run_log, ensure_defaults, ensure_layout, now_iso, read_json, render_edn, require_root, update_session, write_json, write_text


LEGACY_ARCANA_ALIASES = {
    "forge": "the-magician",
    "lantern": "justice",
    "archive": "judgement",
    "chorus": "the-world",
    "veil": "the-hermit",
    "mirror": "the-hanged-man",
    "garden": "the-empress",
    "blade": "death",
}

CLUSTER_TO_CAPABILITY = {
    "interaction_style": "adaptive collaboration posture",
    "reasoning_visibility": "evidence and confidence channels",
    "agent_topology": "agent compare-and-merge surfaces",
    "memory_policy": "durable logs and replay",
    "privacy_policy": "reviewable memory and consent gates",
    "verification_policy": "verification-first synthesis",
    "ui_topology": "inspectable workbench topology",
    "aesthetic_motif": "symbolic frontstage with parameter grounding",
    "learning_mode": "pedagogical scaffolds",
    "branching_and_versioning": "branch history and replay",
    "orchestration_and_tools": "tool-rich orchestration shell",
    "tempo_and_notification_policy": "adaptive pacing and interruption control",
}

CLUSTER_TO_UI = {
    "reasoning_visibility": "Expose evidence drawers and confidence markers.",
    "agent_topology": "Use compare-and-merge panes for agent outputs.",
    "memory_policy": "Preserve replay, snapshots, and resurfacing controls.",
    "privacy_policy": "Make retention scopes and consent gates first-class UI elements.",
    "verification_policy": "Show provenance, citations, and explicit uncertainty.",
    "ui_topology": "Keep a dense workbench with inspectable panels by default.",
    "branching_and_versioning": "Preserve branch history and side-by-side diffs.",
    "tempo_and_notification_policy": "Provide low-energy and high-stakes mode switches.",
}

CLUSTER_TO_CONTRACT = {
    "reasoning_visibility": "keep uncertainty visible",
    "privacy_policy": "ask before durable memory writes",
    "agent_topology": "do not hide agent disagreement",
    "verification_policy": "cite or justify high-stakes claims",
    "branching_and_versioning": "preserve branch history and revision paths",
    "tempo_and_notification_policy": "adapt interruption intensity to current mode",
}

RULE_TO_NOTES = {
    "privacy-escalation": "Escalate privacy-first defaults and compartmentalized agent boundaries.",
    "orchestration-escalation": "Promote multi-agent topology with visible merge surfaces.",
    "observatory-mode": "Turn on evidence-first defaults and critique loops.",
}


def slug(value: str) -> str:
    return value.strip().lower().replace(" ", "-")


def load_design_assets(root):
    wizard = read_json(root / "design" / "wizard-flow.json", default={}) or {}
    arcana = read_json(root / "design" / "major-arcana.json", default={}) or {}
    matrix = read_json(root / "design" / "compilation-matrix.json", default={}) or {}
    if not wizard or not arcana or not matrix:
        raise SystemExit("missing design assets; run `foundry design-validate` after adding foundry/design")
    return wizard, arcana, matrix


def canonical_arcana(selected: list[str], cards: list[dict]) -> list[dict]:
    by_id = {card["id"]: card for card in cards}
    by_title = {slug(card["title"]): card for card in cards}
    resolved = []
    seen = set()
    for raw in selected:
        key = slug(raw)
        canonical = LEGACY_ARCANA_ALIASES.get(key, key)
        card = by_id.get(canonical) or by_title.get(canonical)
        if not card or card["id"] in seen:
            continue
        resolved.append(card)
        seen.add(card["id"])
    return resolved


def score_clusters(selected_cards: list[dict], matrix: dict) -> dict[str, float]:
    totals = defaultdict(float)
    for card in selected_cards:
        for cluster, weight in matrix.get("card_weights", {}).get(card["id"], {}).items():
            totals[cluster] += float(weight)
    if not totals:
        return {cluster: 0.0 for cluster in matrix.get("parameter_clusters", [])}
    max_score = max(totals.values()) or 1.0
    return {
        cluster: round(totals.get(cluster, 0.0) / max_score, 3)
        for cluster in matrix.get("parameter_clusters", [])
    }


def infer_archetypes(cluster_scores: dict[str, float], wants_privacy: bool) -> list[str]:
    archetypes = []
    if cluster_scores.get("agent_topology", 0) >= 0.7:
        archetypes.append("Switchboard")
    else:
        archetypes.append("Foundry")
    if cluster_scores.get("memory_policy", 0) >= 0.6:
        archetypes.append("Conservatory")
    elif cluster_scores.get("learning_mode", 0) >= 0.6:
        archetypes.append("Atelier")
    else:
        archetypes.append("Observatory")
    if wants_privacy or cluster_scores.get("privacy_policy", 0) >= 0.7:
        archetypes.append("Shrine")
    return list(dict.fromkeys(archetypes))


def top_clusters(cluster_scores: dict[str, float], threshold: float = 0.55) -> list[str]:
    ranked = sorted(cluster_scores.items(), key=lambda item: item[1], reverse=True)
    selected = [name for name, score in ranked if score >= threshold]
    return selected[:4] or [name for name, _score in ranked[:3]]


def derive_capabilities(cluster_scores: dict[str, float], wants_plural: bool) -> list[str]:
    capabilities = [
        "three-strata intake compiler",
        "editable preference hypotheses",
        "durable task ledger",
        "quota-aware routing",
        "resume-friendly checkpointing",
    ]
    if wants_plural:
        capabilities.append("agent compare-and-merge surfaces")
    else:
        capabilities.append("single-thread structured collaboration")
    for cluster in top_clusters(cluster_scores):
        capability = CLUSTER_TO_CAPABILITY.get(cluster)
        if capability and capability not in capabilities:
            capabilities.append(capability)
    return capabilities


def derive_ui(cluster_scores: dict[str, float], wants_plural: bool) -> list[str]:
    items = []
    if wants_plural:
        items.append("Use compare-and-merge panes for agent outputs.")
    else:
        items.append("Keep a primary single-thread workbench as default.")
    for cluster in top_clusters(cluster_scores):
        item = CLUSTER_TO_UI.get(cluster)
        if item and item not in items:
            items.append(item)
    return items[:4]


def derive_contract(cluster_scores: dict[str, float], wants_plural: bool, wants_privacy: bool) -> list[str]:
    contract = ["keep uncertainty visible", "checkpoint every step"]
    if wants_privacy:
        contract.append("ask before durable memory writes")
    elif not wants_plural:
        contract.append("do not fabricate plurality for its own sake")
    for cluster in top_clusters(cluster_scores):
        item = CLUSTER_TO_CONTRACT.get(cluster)
        if item and item not in contract:
            contract.append(item)
    return contract[:5]


def apply_branching_rules(selected_cards: list[dict], matrix: dict, intake: dict) -> list[str]:
    selected_ids = {card["id"] for card in selected_cards}
    notes = []
    privacy = intake["practical"]["privacy"].lower()
    mode = intake["behavioral"]["collaboration_mode"].lower()
    for rule in matrix.get("branching_rules", []):
        if rule["id"] == "privacy-escalation":
            if "the-hermit" in selected_ids and ("consent" in privacy or "private" in privacy):
                notes.append(RULE_TO_NOTES[rule["id"]])
        elif rule["id"] == "orchestration-escalation":
            if "the-world" in selected_ids or "chorus" in intake["symbolic"]["arcana"]:
                notes.append(RULE_TO_NOTES[rule["id"]])
        elif rule["id"] == "observatory-mode":
            if "justice" in selected_ids or "lantern" in [slug(item) for item in intake["symbolic"]["arcana"]]:
                notes.append(RULE_TO_NOTES[rule["id"]])
    if "single" in mode and any("Switchboard" in note for note in notes):
        notes.append("Plural orchestration should stay behind a coherent single-face surface.")
    return list(dict.fromkeys(notes))


def build_prompt_pack(brief: dict) -> dict:
    return {
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


def build_tool_manifest(brief: dict, json_path) -> dict:
    return {
        "name": "hynous-terminal-foundry",
        "entrypoint": "foundry/bin/foundry",
        "brief": str(json_path),
        "commands": brief["toolSurface"]["cli"],
        "state_files": [
            "state/session.json",
            "state/quotas.json",
            "state/inference.json",
            "state/jobs.json",
            "state/benchmark-report.json",
        ],
        "agents": brief["buildAgents"],
        "routing": {
            "claude-code": ["architecture", "synthesis", "final review"],
            "codex": ["implementation", "scaffold generation", "tests"],
            "gemini": ["classification", "prompt support", "cheap review"],
        },
    }


def main() -> None:
    root, _ = require_root(__import__("sys").argv)
    ensure_layout(root)
    ensure_defaults(root)
    intake = read_json(root / "inputs" / "intake.json", default={}) or {}
    inference = read_json(root / "state" / "inference.json", default={}) or {}
    if not intake:
        raise SystemExit("missing inputs/intake.json; run `foundry intake` first")

    _wizard, arcana_design, matrix = load_design_assets(root)
    selected_cards = canonical_arcana(intake["symbolic"]["arcana"], arcana_design.get("cards", []))
    cluster_scores = score_clusters(selected_cards, matrix)
    top_design_clusters = top_clusters(cluster_scores)

    privacy = intake["practical"]["privacy"]
    mode = intake["behavioral"]["collaboration_mode"]
    wants_plural = cluster_scores.get("agent_topology", 0) >= 0.7 or "chorus" in [slug(item) for item in intake["symbolic"]["arcana"]]
    wants_privacy = "strict" in privacy.lower() or "consent" in privacy.lower() or "private" in privacy.lower() or cluster_scores.get("privacy_policy", 0) >= 0.7

    brief = {
        "generated_at": now_iso(),
        "portrait": {
            "summary": f"User appears to want a {mode} harness with {privacy}.",
            "workstyle": [
                intake["behavioral"]["working_rhythm"],
                "iterative and revision-tolerant" if cluster_scores.get("branching_and_versioning", 0) >= 0.55 else "prefers convergent output",
                "expects explicit structure and reusable artifacts",
            ],
            "aiRelationship": [
                mode,
                "comfortable with plurality if merge is explicit" if wants_plural else "prefers a single coherent interface",
                "trust depends on evidence and uncertainty visibility" if cluster_scores.get("verification_policy", 0) >= 0.55 else "accepts best-effort synthesis with revision hooks",
            ],
            "operationalNeeds": [
                intake["practical"]["hosting"],
                intake["practical"]["devices"],
                "reviewable persistence and explicit consent gates" if wants_privacy else "durable history with configurable retention",
            ],
        },
        "hypotheses": inference.get("hypotheses", []),
        "contradictions": inference.get("contradictions", []),
        "selectedArcana": [{"id": card["id"], "title": card["title"]} for card in selected_cards],
        "parameterClusters": cluster_scores,
        "dominantClusters": top_design_clusters,
        "archetypes": infer_archetypes(cluster_scores, wants_privacy),
        "capabilities": derive_capabilities(cluster_scores, wants_plural),
        "uiRecommendations": derive_ui(cluster_scores, wants_plural),
        "behavioralContract": derive_contract(cluster_scores, wants_plural, wants_privacy),
        "implementationPlan": [
            "stabilize the PersonalBrief schema as the core artifact",
            "compile wizard and arcana priors through the parameter matrix",
            "generate routed task packets for Claude Code, Codex, and Gemini",
            "persist prompts, outputs, diffs, and task status in the ledger",
            "render tarot cards via relay first with explicit fallbacks",
        ],
        "toolSurface": {
            "cli": [
                "foundry intake",
                "foundry infer",
                "foundry compile",
                "foundry build",
                "foundry design-validate",
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
                "design/wizard-flow.json",
                "design/major-arcana.json",
                "design/compilation-matrix.json",
                "cards/renders/<card>/request.json",
            ],
            "policies": [
                "checkpoint every step",
                "prefer deterministic local compilation before API calls",
                "defer expensive agents until brief quality is coherent",
                "keep symbolic frontstage subordinate to typed design assets",
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
            *apply_branching_rules(selected_cards, matrix, intake),
        ],
        "resourcePosture": intake["resource_posture"],
    }

    json_path = root / "briefs" / "personal-brief.json"
    edn_path = root / "briefs" / "personal-brief.edn"
    prompt_pack_path = root / "briefs" / "prompt-pack.json"
    tool_manifest_path = root / "briefs" / "tool-manifest.json"
    scaffold_path = root / "briefs" / "starter-scaffold.txt"

    prompt_pack = build_prompt_pack(brief)
    tool_manifest = build_tool_manifest(brief, json_path.relative_to(root))
    scaffold_text = "\n".join(
        [
            "foundry/",
            "  bin/foundry",
            "  design/wizard-flow.json",
            "  design/major-arcana.json",
            "  design/compilation-matrix.json",
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
            "dominant_clusters": top_design_clusters,
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

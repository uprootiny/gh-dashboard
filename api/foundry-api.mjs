import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FOUNDRY = path.resolve(__dirname, "..", "foundry");

// --- JSON helpers ---

async function readJson(relativePath, fallback) {
  try {
    const raw = await readFile(path.join(FOUNDRY, relativePath), "utf8");
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// Write-lock map to prevent concurrent writes to the same file
const writeLocks = new Map();

async function writeJson(relativePath, data) {
  // Wait for any pending write to the same file
  while (writeLocks.has(relativePath)) {
    await writeLocks.get(relativePath);
  }
  const filePath = path.join(FOUNDRY, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  // Atomic write via temp file
  const tmpPath = filePath + `.tmp.${Date.now()}`;
  const content = JSON.stringify(data, null, 2) + "\n";
  const { rename } = await import("node:fs/promises");
  const promise = writeFile(tmpPath, content, "utf8").then(() => rename(tmpPath, filePath));
  writeLocks.set(relativePath, promise);
  try {
    await promise;
  } finally {
    writeLocks.delete(relativePath);
  }
}

async function loadCardDefs() {
  const cardsDir = path.join(FOUNDRY, "cards", "defs");
  const cards = [];
  try {
    const files = await readdir(cardsDir);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const raw = await readFile(path.join(cardsDir, file), "utf8");
      cards.push(JSON.parse(raw));
    }
  } catch { /* no cards dir */ }
  return cards;
}

// --- Trace ledger ---

async function buildTraceLedger() {
  const [explicit, runs, reviews, session] = await Promise.all([
    readJson("state/trace-ledger.json", []),
    readJson("state/agent-runs.json", []),
    readJson("state/reviews.json", []),
    readJson("state/session.json", {})
  ]);

  const inferred = [];
  for (const run of runs) {
    inferred.push({
      "event/type": "child-completed",
      "event/id": `inferred-run-${run.id}`,
      "job/id": run.job_id,
      agent: run.agent,
      status: run.status,
      created_at: run.created_at
    });
  }
  for (const review of reviews) {
    inferred.push({
      "event/type": "acceptance-decided",
      "event/id": `inferred-review-${review.id}`,
      "job/id": review.job_id,
      decision: review.decision,
      created_at: review.created_at
    });
  }

  const all = [...explicit, ...inferred]
    .sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));

  return {
    events: all,
    count: all.length,
    currentStage: session.current_stage || "unknown",
    updatedAt: session.updated_at || null
  };
}

// --- Frame snapshot ---

async function buildFrameSnapshot() {
  const [session, jobs, runs, reviews, inference, quotas, brief, traceLedger, cards] = await Promise.all([
    readJson("state/session.json", {}),
    readJson("state/jobs.json", { jobs: [] }),
    readJson("state/agent-runs.json", []),
    readJson("state/reviews.json", []),
    readJson("state/inference.json", {}),
    readJson("state/quotas.json", {}),
    readJson("briefs/personal-brief.json", null),
    readJson("state/trace-ledger.json", []),
    loadCardDefs()
  ]);

  const accepted = jobs.jobs.filter((j) => j.status === "accepted").length;
  const pending = jobs.jobs.filter((j) => !j.status || j.status === "pending").length;
  const rejected = jobs.jobs.filter((j) => j.status === "rejected" || j.status === "needs_revision").length;

  return {
    "frame/root": {
      id: "root",
      type: "meta-orchestration-shell",
      stage: session.current_stage || "uninitialized",
      updatedAt: session.updated_at || null
    },
    "frame/parent-context": {
      invariants: [
        "User overrides dominate",
        "Arcana remain soft priors",
        "Trace is first-class",
        "Every costly inference call must leave durable residue",
        "Recovery favors bounded execution over narrative drift"
      ],
      quota: quotas
    },
    "frame/child-harness": {
      evidence: {
        hasIntake: Boolean(session.latest_intake),
        hasInference: Boolean(inference.hypotheses),
        hypothesisCount: (inference.hypotheses || []).length
      },
      hypotheses: inference.hypotheses || [],
      tensions: inference.tensions || [],
      brief: brief ? { present: true, archetypes: brief.archetypes || [] } : { present: false },
      cards: cards.map((c) => c.name || c.id || "unnamed")
    },
    "frame/developer-loop": {
      jobs: { total: jobs.jobs.length, accepted, pending, rejected },
      runs: { total: runs.length, latest: runs.length ? runs[runs.length - 1] : null },
      reviews: { total: reviews.length, latest: reviews.length ? reviews[reviews.length - 1] : null },
      trace: {
        explicitEvents: traceLedger.length,
        inferredFromRuns: runs.length,
        inferredFromReviews: reviews.length
      }
    },
    "frame/sibling-branches": {
      repair: rejected > 0 ? { needed: true, count: rejected } : { needed: false },
      pending: pending > 0 ? { waiting: true, count: pending } : { waiting: false }
    }
  };
}

// --- Acceptance ---

async function recordAcceptance(jobId, decision, notes) {
  const jobs = await readJson("state/jobs.json", { jobs: [] });
  const job = jobs.jobs.find((j) => j.id === jobId);
  if (!job) return { error: `unknown job: ${jobId}` };

  const runs = await readJson("state/agent-runs.json", []);
  const latestRun = [...runs].reverse().find((r) => r.job_id === jobId);

  const review = {
    id: `${jobId}:${decision}:${new Date().toISOString()}`,
    created_at: new Date().toISOString(),
    job_id: jobId,
    run_id: latestRun?.id || null,
    decision,
    notes: notes || "No review note supplied.",
    artifact: latestRun?.artifact || null
  };

  const reviews = await readJson("state/reviews.json", []);
  reviews.push(review);
  await writeJson("state/reviews.json", reviews);

  const statusMap = { accept: "accepted", revise: "needs_revision", reject: "rejected" };
  job.status = statusMap[decision];
  job.last_reviewed_at = review.created_at;
  if (latestRun) job.latest_run_id = latestRun.id;
  await writeJson("state/jobs.json", jobs);

  const ledger = await readJson("state/trace-ledger.json", []);
  ledger.push({
    "event/type": "acceptance-decided",
    "event/id": `evt-${Date.now()}`,
    "job/id": jobId,
    decision,
    created_at: review.created_at
  });
  await writeJson("state/trace-ledger.json", ledger);

  return review;
}

// --- Task envelope ---

function buildTaskEnvelope(body) {
  return {
    id: String(body?.id || `job-${Date.now()}`),
    agent_role: String(body?.agentRole || "builder"),
    kind: String(body?.kind || "implementation"),
    title: String(body?.title || "Untitled task"),
    goal: String(body?.goal || ""),
    preferred_agent: String(body?.preferredAgent || "claude-code"),
    fallback_agent: String(body?.fallbackAgent || "codex"),
    max_cost: String(body?.maxCost || "medium"),
    token_budget: Number(body?.tokenBudget || 8000),
    time_budget_minutes: Number(body?.timeBudget || 15),
    allowed_tools: Array.isArray(body?.allowedTools) ? body.allowedTools : ["read", "write", "test"],
    success_conditions: Array.isArray(body?.successConditions) ? body.successConditions : [],
    status: "pending",
    created_at: new Date().toISOString()
  };
}

async function issueTask(body) {
  const envelope = buildTaskEnvelope(body);
  const jobs = await readJson("state/jobs.json", { jobs: [] });
  const existing = jobs.jobs.findIndex((j) => j.id === envelope.id);
  if (existing >= 0) jobs.jobs[existing] = envelope;
  else jobs.jobs.push(envelope);
  await writeJson("state/jobs.json", jobs);

  const ledger = await readJson("state/trace-ledger.json", []);
  ledger.push({
    "event/type": "task-issued",
    "event/id": `evt-${Date.now()}`,
    "job/id": envelope.id,
    created_at: new Date().toISOString()
  });
  await writeJson("state/trace-ledger.json", ledger);

  return envelope;
}

// --- Recovery ---

async function getRecoveryStatus() {
  const session = await readJson("state/session.json", {});
  const jobs = await readJson("state/jobs.json", { jobs: [] });
  const reviews = await readJson("state/reviews.json", []);
  const rejected = jobs.jobs.filter((j) => j.status === "rejected" || j.status === "needs_revision");
  const stale = jobs.jobs.filter((j) => !j.status || j.status === "pending");

  return {
    currentStage: session.current_stage || "unknown",
    needsRecovery: rejected.length > 0,
    rejectedJobs: rejected,
    staleJobs: stale,
    totalReviews: reviews.length,
    protocol: [
      "write recovery.md",
      "write acceptance-checklist.md",
      "finish one smallest end-to-end slice",
      "execute it",
      "write demo.md",
      "stop"
    ],
    labels: {
      SIMULATED: "cooperative assumptions, hand-authored fixtures",
      UNVERIFIED: "implemented but not exercised in deployment",
      ACCEPTED: "passed current gate",
      PENDING: "remains in sibling branch backlog"
    }
  };
}

// --- Route handler ---

export async function handleFoundryRoute(req, url, writeJsonResponse, readJsonBody) {
  const p = url.pathname;

  // GET endpoints
  if (req.method === "GET") {
    if (p === "/api/foundry/session") return writeJsonResponse(200, await readJson("state/session.json", {}));
    if (p === "/api/foundry/jobs") return writeJsonResponse(200, await readJson("state/jobs.json", { jobs: [] }));
    if (p === "/api/foundry/runs") return writeJsonResponse(200, await readJson("state/agent-runs.json", []));
    if (p === "/api/foundry/reviews") return writeJsonResponse(200, await readJson("state/reviews.json", []));
    if (p === "/api/foundry/inference") return writeJsonResponse(200, await readJson("state/inference.json", {}));
    if (p === "/api/foundry/quotas") return writeJsonResponse(200, await readJson("state/quotas.json", {}));
    if (p === "/api/foundry/cards") return writeJsonResponse(200, { cards: await loadCardDefs() });
    if (p === "/api/foundry/compiled-brief") return writeJsonResponse(200, await readJson("briefs/personal-brief.json", null));
    if (p === "/api/foundry/trace") return writeJsonResponse(200, await buildTraceLedger());
    if (p === "/api/foundry/frames") return writeJsonResponse(200, await buildFrameSnapshot());
    if (p === "/api/foundry/recovery") return writeJsonResponse(200, await getRecoveryStatus());
  }

  // POST endpoints
  if (req.method === "POST") {
    if (p === "/api/foundry/accept") {
      const body = await readJsonBody(req);
      const jobId = String(body?.jobId || "").trim();
      const decision = String(body?.decision || "").trim();
      if (!jobId || !["accept", "revise", "reject"].includes(decision)) {
        return writeJsonResponse(400, { error: "jobId and decision (accept|revise|reject) required" });
      }
      return writeJsonResponse(200, await recordAcceptance(jobId, decision, String(body?.notes || "")));
    }

    if (p === "/api/foundry/trace/append") {
      const body = await readJsonBody(req);
      const eventType = String(body?.type || "").trim();
      if (!eventType) return writeJsonResponse(400, { error: "type is required" });
      const event = {
        "event/type": eventType,
        "event/id": `evt-${Date.now()}`,
        created_at: new Date().toISOString(),
        ...body
      };
      delete event.type;
      const ledger = await readJson("state/trace-ledger.json", []);
      ledger.push(event);
      await writeJson("state/trace-ledger.json", ledger);
      return writeJsonResponse(200, event);
    }

    if (p === "/api/foundry/task/issue") {
      const body = await readJsonBody(req);
      return writeJsonResponse(200, await issueTask(body));
    }

    // Persist a compiled brief (merges web and CLI brief paths)
    if (p === "/api/foundry/compiled-brief") {
      const body = await readJsonBody(req);
      if (!body || typeof body !== "object") {
        return writeJsonResponse(400, { error: "brief object required" });
      }
      body.compiled_at = new Date().toISOString();
      body.source = body.source || "web";
      await writeJson("briefs/personal-brief.json", body);

      // Trace the compilation
      const ledger = await readJson("state/trace-ledger.json", []);
      ledger.push({
        "event/type": "brief-compiled",
        "event/id": `evt-${Date.now()}`,
        source: body.source,
        created_at: body.compiled_at
      });
      await writeJson("state/trace-ledger.json", ledger);

      // Update session
      const session = await readJson("state/session.json", {});
      session.current_stage = "brief-compiled";
      session.updated_at = body.compiled_at;
      session.latest_brief_json = "briefs/personal-brief.json";
      await writeJson("state/session.json", session);

      return writeJsonResponse(200, { saved: true, compiled_at: body.compiled_at });
    }
  }

  return false; // not handled
}

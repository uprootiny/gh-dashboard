#!/usr/bin/env node
// Thorough integration tests for the foundry API.
// Tests the full cycle: issue task → trace appears → accept → status updates → recovery reflects.
// Usage: node tests/test-foundry-api.mjs [base-url]

const BASE = process.argv[2] || "http://localhost:8788";
let pass = 0;
let fail = 0;

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return { status: res.status, data: await res.json() };
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  return { status: res.status, data: await res.json() };
}

function assert(name, condition, detail) {
  if (condition) {
    console.log(`  PASS  ${name}`);
    pass++;
  } else {
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
    fail++;
  }
}

async function run() {
  console.log("=== Foundry API Integration Tests ===\n");

  // --- Health ---
  console.log("Health & Providers");
  const health = await get("/api/health");
  assert("health returns ok", health.data.ok === true);
  assert("health has providerOrder", Array.isArray(health.data.providerOrder));

  const providers = await get("/api/providers");
  assert("providers lists configured providers", providers.data.providers.length > 0);
  assert("ollama always configured", providers.data.providers.some((p) => p.id === "ollama" && p.configured));

  // --- Foundry state reads ---
  console.log("\nFoundry State (read-only)");
  const session = await get("/api/foundry/session");
  assert("session returns object", typeof session.data === "object");
  assert("session has current_stage", "current_stage" in session.data);

  const jobs = await get("/api/foundry/jobs");
  assert("jobs has jobs array", Array.isArray(jobs.data.jobs));

  const inference = await get("/api/foundry/inference");
  assert("inference has hypotheses", Array.isArray(inference.data.hypotheses));

  const cards = await get("/api/foundry/cards");
  assert("cards returns array", Array.isArray(cards.data.cards));
  assert("cards count >= 1", cards.data.cards.length >= 1);

  const brief = await get("/api/foundry/compiled-brief");
  assert("compiled brief exists", brief.data !== null);
  assert("brief has portrait", brief.data?.portrait?.summary?.length > 0);

  const quotas = await get("/api/foundry/quotas");
  assert("quotas has agents", typeof quotas.data.agents === "object");
  assert("quotas has policy", typeof quotas.data.policy === "object");

  // --- Frames snapshot ---
  console.log("\nFrames Snapshot");
  const frames = await get("/api/foundry/frames");
  assert("frame/root present", "frame/root" in frames.data);
  assert("frame/root has stage", typeof frames.data["frame/root"].stage === "string");
  assert("frame/parent-context has invariants", Array.isArray(frames.data["frame/parent-context"].invariants));
  assert("frame/child-harness has evidence", "evidence" in frames.data["frame/child-harness"]);
  assert("frame/developer-loop has jobs summary", "jobs" in frames.data["frame/developer-loop"]);
  assert("frame/sibling-branches present", "frame/sibling-branches" in frames.data);

  // --- Task lifecycle: issue → trace → accept ---
  console.log("\nTask Lifecycle");
  const testJobId = `test-job-${Date.now()}`;

  // Issue a task
  const issued = await post("/api/foundry/task/issue", {
    id: testJobId,
    agentRole: "tester",
    kind: "validation",
    title: "Integration test task",
    goal: "Verify the task lifecycle works end-to-end",
    preferredAgent: "claude-code",
    tokenBudget: 1000,
    timeBudget: 5,
    successConditions: ["task appears in jobs", "trace event emitted", "acceptance updates status"]
  });
  assert("task issued successfully", issued.status === 200);
  assert("task has correct id", issued.data.id === testJobId);
  assert("task status is pending", issued.data.status === "pending");
  assert("task has success_conditions", issued.data.success_conditions.length === 3);

  // Verify it appears in jobs
  const jobsAfter = await get("/api/foundry/jobs");
  const foundJob = jobsAfter.data.jobs.find((j) => j.id === testJobId);
  assert("task appears in jobs list", Boolean(foundJob));
  assert("task in jobs has pending status", foundJob?.status === "pending");

  // Verify trace captured the issue event
  const traceAfter = await get("/api/foundry/trace");
  const issueEvent = traceAfter.data.events.find(
    (e) => e["event/type"] === "task-issued" && e["job/id"] === testJobId
  );
  assert("task-issued event in trace", Boolean(issueEvent));

  // Append a custom trace event
  const customEvent = await post("/api/foundry/trace/append", {
    type: "test-milestone",
    "job/id": testJobId,
    note: "integration test checkpoint"
  });
  assert("custom trace event created", customEvent.status === 200);
  assert("custom event has event/id", typeof customEvent.data["event/id"] === "string");

  // Accept the task (even though no child ran — tests the acceptance path)
  const accepted = await post("/api/foundry/accept", {
    jobId: testJobId,
    decision: "accept",
    notes: "Integration test — accepted without child run"
  });
  assert("acceptance recorded", accepted.status === 200);
  assert("acceptance decision is accept", accepted.data.decision === "accept");

  // Verify job status updated
  const jobsFinal = await get("/api/foundry/jobs");
  const finalJob = jobsFinal.data.jobs.find((j) => j.id === testJobId);
  assert("job status updated to accepted", finalJob?.status === "accepted");
  assert("job has last_reviewed_at", typeof finalJob?.last_reviewed_at === "string");

  // Verify acceptance appears in trace
  const traceFinal = await get("/api/foundry/trace");
  const acceptEvent = traceFinal.data.events.find(
    (e) => e["event/type"] === "acceptance-decided" && e["job/id"] === testJobId
  );
  assert("acceptance-decided event in trace", Boolean(acceptEvent));

  // --- Recovery ---
  console.log("\nRecovery Status");
  const recovery = await get("/api/foundry/recovery");
  assert("recovery has currentStage", typeof recovery.data.currentStage === "string");
  assert("recovery has protocol", Array.isArray(recovery.data.protocol));
  assert("recovery protocol has 6 steps", recovery.data.protocol.length === 6);
  assert("recovery has labels", "SIMULATED" in recovery.data.labels);
  assert("recovery has needsRecovery flag", typeof recovery.data.needsRecovery === "boolean");

  // --- Rejection path ---
  console.log("\nRejection Path");
  const rejectJobId = `test-reject-${Date.now()}`;
  await post("/api/foundry/task/issue", {
    id: rejectJobId, agentRole: "tester", kind: "validation",
    title: "Task to be rejected", goal: "Test rejection flow"
  });
  const rejected = await post("/api/foundry/accept", {
    jobId: rejectJobId, decision: "reject", notes: "Testing rejection path"
  });
  assert("rejection recorded", rejected.data.decision === "reject");

  const recoveryAfter = await get("/api/foundry/recovery");
  const rejectedInRecovery = recoveryAfter.data.rejectedJobs.find((j) => j.id === rejectJobId);
  assert("rejected job appears in recovery", Boolean(rejectedInRecovery));
  assert("needsRecovery is true after rejection", recoveryAfter.data.needsRecovery === true);

  // --- Revision path ---
  console.log("\nRevision Path");
  const reviseJobId = `test-revise-${Date.now()}`;
  await post("/api/foundry/task/issue", {
    id: reviseJobId, agentRole: "tester", kind: "validation",
    title: "Task to be revised", goal: "Test revision flow"
  });
  const revised = await post("/api/foundry/accept", {
    jobId: reviseJobId, decision: "revise", notes: "Needs another pass"
  });
  assert("revision recorded", revised.data.decision === "revise");

  const jobsRevised = await get("/api/foundry/jobs");
  const revisedJob = jobsRevised.data.jobs.find((j) => j.id === reviseJobId);
  assert("revised job has needs_revision status", revisedJob?.status === "needs_revision");

  // --- Chat fallback ---
  console.log("\nChat Fallback");
  const chat = await post("/api/chat", { prompt: "test ping" });
  assert("chat returns response", chat.status === 200);
  assert("chat has output or fallback", typeof chat.data.output === "string");
  assert("chat identifies provider", typeof chat.data.provider === "string");

  // --- Brief compilation ---
  console.log("\nBrief Compilation");
  const compiledBrief = await post("/api/foundry/brief", {
    practical: { devices: "M4 MacBook Air", budget: "free-tier", hosting: "GitHub Pages + Render" },
    behavioral: { collaborationMode: "inspectable", ambiguityTolerance: "moderate" },
    symbolic: { arcana: ["Forge", "Lantern", "Archive"], tensions: ["speed vs depth"] },
    traces: { notes: "integration test" }
  });
  assert("brief compilation returns 200", compiledBrief.status === 200);
  assert("brief has provider", typeof compiledBrief.data.provider === "string");

  // --- Error handling ---
  console.log("\nError Handling");
  const badAccept = await post("/api/foundry/accept", { jobId: "", decision: "nope" });
  assert("bad accept returns 400", badAccept.status === 400);

  const badChat = await post("/api/chat", { prompt: "" });
  assert("empty prompt returns 400", badChat.status === 400);

  const badTrace = await post("/api/foundry/trace/append", {});
  assert("empty trace type returns 400", badTrace.status === 400);

  // --- Summary ---
  console.log(`\n=== ${pass} passed, ${fail} failed out of ${pass + fail} ===`);
  process.exit(fail > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});

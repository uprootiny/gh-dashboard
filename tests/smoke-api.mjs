#!/usr/bin/env node
// Smoke test: verifies every API endpoint returns a valid response.
// Usage: node tests/smoke-api.mjs [base-url]

const BASE = process.argv[2] || "http://localhost:8788";

const endpoints = [
  ["GET",  "/api/health"],
  ["GET",  "/api/providers"],
  ["GET",  "/api/capabilities"],
  ["GET",  "/api/admin/summary"],
  ["GET",  "/api/admin/events"],
  ["GET",  "/api/foundry/session"],
  ["GET",  "/api/foundry/jobs"],
  ["GET",  "/api/foundry/runs"],
  ["GET",  "/api/foundry/reviews"],
  ["GET",  "/api/foundry/inference"],
  ["GET",  "/api/foundry/quotas"],
  ["GET",  "/api/foundry/cards"],
  ["GET",  "/api/foundry/compiled-brief"],
  ["GET",  "/api/foundry/trace"],
  ["GET",  "/api/foundry/frames"],
  ["GET",  "/api/foundry/recovery"],
  ["GET",  "/"],
  ["POST", "/api/chat", { prompt: "ping" }],
  ["POST", "/api/foundry/brief", { practical: { devices: "mac" }, behavioral: {}, symbolic: { arcana: ["Forge"] }, traces: {} }],
];

(async () => {
  let pass = 0;
  let fail = 0;

  for (const [method, path, body] of endpoints) {
    try {
      const opts = { method };
      if (body) {
        opts.headers = { "Content-Type": "application/json" };
        opts.body = JSON.stringify(body);
      }
      const res = await fetch(`${BASE}${path}`, opts);
      const text = await res.text();
      const ok = res.status < 400;
      const isJson = text.startsWith("{") || text.startsWith("[");
      const isHtml = text.startsWith("<!") || text.startsWith("<html");
      const valid = ok && (isJson || isHtml);

      if (valid) {
        console.log(`  PASS  ${method.padEnd(4)} ${path}`);
        pass++;
      } else {
        console.log(`  FAIL  ${method.padEnd(4)} ${path} → ${res.status}`);
        fail++;
      }
    } catch (err) {
      console.log(`  FAIL  ${method.padEnd(4)} ${path} → ${err.message}`);
      fail++;
    }
  }

  console.log(`\n  ${pass} passed, ${fail} failed out of ${endpoints.length}`);
  process.exit(fail > 0 ? 1 : 0);
})();

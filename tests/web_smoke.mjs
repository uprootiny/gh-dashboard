import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const PORT = 8812;
const BASE = `http://127.0.0.1:${PORT}`;

async function waitForServer(proc) {
  let stderr = "";
  proc.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return;
    } catch {}
    await delay(200);
  }
  throw new Error(`server did not start on ${BASE}\n${stderr}`);
}

async function fetchText(pathname) {
  const res = await fetch(`${BASE}${pathname}`);
  const text = await res.text();
  assert.equal(res.status, 200, `${pathname} should return 200`);
  return text;
}

async function fetchJson(pathname, options) {
  const res = await fetch(`${BASE}${pathname}`, options);
  const json = await res.json();
  assert.equal(res.status, 200, `${pathname} should return 200`);
  return json;
}

const proc = spawn("node", ["api/server.mjs"], {
  cwd: "/Users/uprootiny/anotherone/onetwennyseven/gh-dashboard",
  env: {
    ...process.env,
    PORT: String(PORT),
    OPENAI_API_KEY: "",
    ANTHROPIC_API_KEY: "",
    OPENROUTER_API_KEY: "",
    HF_TOKEN: ""
  },
  stdio: ["ignore", "pipe", "pipe"]
});

try {
  await waitForServer(proc);

  const rootHtml = await fetchText("/");
  assert.match(rootHtml, /Ἑυνοῦς/);
  assert.match(rootHtml, /Foundry/);
  assert.match(rootHtml, /Tool manifest/);
  assert.match(rootHtml, /Download tool manifest/);

  const tarotHtml = await fetchText("/tarot/");
  assert.match(tarotHtml, /Tarot/i);
  assert.match(tarotHtml, /Metering ledger/);
  assert.match(tarotHtml, /Refresh diagnostics/);

  const opsHtml = await fetchText("/ops/");
  assert.match(opsHtml, /GitHub/i);

  const orbitalHtml = await fetchText("/orbital/");
  assert.match(orbitalHtml, /Orbital Foundry Demo/);
  assert.match(orbitalHtml, /Temperament of selected orbit/);
  assert.match(orbitalHtml, /Reality probes/);
  assert.match(orbitalHtml, /Trace bus/);

  const health = await fetchJson("/api/health");
  assert.equal(health.ok, true);
  assert.ok(Array.isArray(health.providerOrder));

  const providers = await fetchJson("/api/providers");
  assert.ok(Array.isArray(providers.providers));

  const chat = await fetchJson("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "Shape this into one durable next step." })
  });
  assert.ok(chat.output || chat.warnings);

  const brief = await fetchJson("/api/foundry/brief", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      practical: {
        devices: "desktop",
        budget: "balanced",
        hosting: "vps",
        privacy: "consentful memory",
        primary_domains: "architecture"
      },
      behavioral: {
        collaboration_mode: "visible collaborator",
        ambiguity_tolerance: "medium",
        preferred_outputs: "briefs",
        pain_points: "genericity",
        working_rhythm: "steady"
      },
      symbolic: {
        arcana: ["Forge", "Lantern"],
        motifs: "symbolic frontstage, formal backstage"
      },
      traces: {
        notes: "needs explicit structure"
      }
    })
  });
  assert.ok(brief.brief);
  assert.ok(brief.brief.capabilities?.length > 0);

  const tarot = await fetchJson("/api/tarot-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      card: "The Lantern",
      motif: "ember-lit woodcut workshop"
    })
  });
  assert.ok(tarot.imageDataUrl);
  assert.match(tarot.imageDataUrl, /^data:image\//);

  console.log("web smoke passed");
} finally {
  proc.kill("SIGTERM");
  await delay(200);
}

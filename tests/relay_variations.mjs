import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const REPO = "/Users/uprootiny/anotherone/onetwennyseven/gh-dashboard";

const scenarios = [
  {
    name: "no-remote-keys",
    port: 8821,
    env: {
      OPENAI_API_KEY: "",
      ANTHROPIC_API_KEY: "",
      OPENROUTER_API_KEY: "",
      HF_TOKEN: "",
      LLM_PROVIDER_ORDER: "openai,anthropic,openrouter,ollama"
    },
    expectConfigured: {
      openai: false,
      anthropic: false,
      openrouter: false,
      ollama: true
    }
  },
  {
    name: "openai-configured",
    port: 8822,
    env: {
      OPENAI_API_KEY: "test-openai-key",
      ANTHROPIC_API_KEY: "",
      OPENROUTER_API_KEY: "",
      HF_TOKEN: "",
      LLM_PROVIDER_ORDER: "openai,ollama"
    },
    expectConfigured: {
      openai: true,
      ollama: true
    }
  },
  {
    name: "anthropic-and-openrouter",
    port: 8823,
    env: {
      OPENAI_API_KEY: "",
      ANTHROPIC_API_KEY: "test-anthropic-key",
      OPENROUTER_API_KEY: "test-openrouter-key",
      HF_TOKEN: "",
      LLM_PROVIDER_ORDER: "anthropic,openrouter,ollama"
    },
    expectConfigured: {
      anthropic: true,
      openrouter: true,
      ollama: true
    }
  }
];

async function waitForServer(base) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) return;
    } catch {}
    await delay(200);
  }
  throw new Error(`server did not start on ${base}`);
}

async function fetchJson(base, path, options) {
  const res = await fetch(`${base}${path}`, options);
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${path} did not return JSON`);
  }
  assert.equal(res.status, 200, `${path} should return 200`);
  return json;
}

for (const scenario of scenarios) {
  const base = `http://127.0.0.1:${scenario.port}`;
  const proc = spawn("node", ["api/server.mjs"], {
    cwd: REPO,
    env: {
      ...process.env,
      PORT: String(scenario.port),
      ...scenario.env
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  try {
    await waitForServer(base);

    const health = await fetchJson(base, "/api/health");
    assert.deepEqual(health.providerOrder, scenario.env.LLM_PROVIDER_ORDER.split(","));

    const providers = await fetchJson(base, "/api/providers");
    const byId = Object.fromEntries((providers.providers || []).map((provider) => [provider.id, provider]));
    for (const [id, expected] of Object.entries(scenario.expectConfigured)) {
      assert.equal(Boolean(byId[id]?.configured), expected, `${scenario.name}: provider ${id} configured mismatch`);
    }

    const capabilities = await fetchJson(base, "/api/capabilities");
    assert.equal(Array.isArray(capabilities.llm.providers), true);
    assert.equal(Array.isArray(capabilities.images.browserFallbacks), true);
    assert.equal(Boolean(capabilities.images.relay.configured), false);

    const trace = await fetchJson(base, "/api/foundry/trace");
    assert.equal(typeof trace.count, "number");
    assert.ok(Array.isArray(trace.events));

    const recovery = await fetchJson(base, "/api/foundry/recovery");
    assert.equal(typeof recovery.needsRecovery, "boolean");
    assert.ok(Array.isArray(recovery.protocol));

    const tarot = await fetchJson(base, "/api/tarot-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        card: "The Lantern",
        motif: `scenario ${scenario.name}`
      })
    });
    assert.match(tarot.imageDataUrl, /^data:image\//);

    const brief = await fetchJson(base, "/api/foundry/brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        practical: { devices: "desktop", hosting: "pages+relay", privacy: "consentful memory" },
        behavioral: { collaborationMode: "Collaborator with visible structure" },
        symbolic: { arcana: ["Forge", "Lantern"], motifs: "ritual but inspectable" },
        traces: { notes: `variation ${scenario.name}` }
      })
    });
    assert.ok(brief.brief);
    assert.ok(Array.isArray(brief.brief.capabilities));

    console.log(`PASS ${scenario.name}`);
  } finally {
    proc.kill("SIGTERM");
    await delay(200);
  }
}

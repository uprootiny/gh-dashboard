import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleFoundryRoute } from "./foundry-api.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT || 8787);
const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 30000);
const MAX_RETRIES = Number(process.env.LLM_MAX_RETRIES || 2);
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000);
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 120);
const PROVIDER_ORDER = (process.env.LLM_PROVIDER_ORDER || "openai,anthropic,openrouter,ollama")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const ALLOW_ORIGINS = (process.env.CORS_ALLOW_ORIGINS || "*")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const requestBuckets = new Map();
const adminEvents = [];
const adminStats = {
  totalRequests: 0,
  apiRequests: 0,
  recentErrors: 0,
  statusCounts: {},
  routeCounts: {}
};

const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".ico", "image/x-icon"]
]);

createServer(async (req, res) => {
  const requestStart = Date.now();
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const requestMeta = {
    route: url.pathname,
    method: req.method || "GET"
  };
  try {
    setCorsHeaders(req, res);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      recordAdminEvent({ ...requestMeta, status: 204, durationMs: Date.now() - requestStart });
      return;
    }

    if (!checkRateLimit(req, url.pathname)) {
      writeJson(res, 429, { error: "rate limit exceeded" });
      recordAdminEvent({ ...requestMeta, status: 429, durationMs: Date.now() - requestStart, error: "rate limit exceeded" });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/health") {
      writeJson(res, 200, {
        ok: true,
        service: "hynous-foundry",
        providerOrder: PROVIDER_ORDER,
        timestamp: new Date().toISOString()
      });
      recordAdminEvent({ ...requestMeta, status: 200, durationMs: Date.now() - requestStart });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/providers") {
      writeJson(res, 200, {
        providerOrder: PROVIDER_ORDER,
        providers: listConfiguredProviders()
      });
      recordAdminEvent({ ...requestMeta, status: 200, durationMs: Date.now() - requestStart });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/capabilities") {
      writeJson(res, 200, await buildCapabilitiesPayload());
      recordAdminEvent({ ...requestMeta, status: 200, durationMs: Date.now() - requestStart });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/summary") {
      writeJson(res, 200, buildAdminSummary());
      recordAdminEvent({ ...requestMeta, status: 200, durationMs: Date.now() - requestStart });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/events") {
      writeJson(res, 200, { events: adminEvents.slice(-50).reverse() });
      recordAdminEvent({ ...requestMeta, status: 200, durationMs: Date.now() - requestStart });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/chat") {
      const body = await readJsonBody(req);
      const prompt = String(body?.prompt || "").trim();
      if (!prompt) return writeJson(res, 400, { error: "prompt is required" });

      const system = String(body?.system || "").trim() || "You are Ἑυνοῦς, a grounded AI foundry assistant.";
      const result = await invokeWithFallback({
        task: "chat",
        system,
        user: prompt,
        responseMode: "text",
        fallback: () => ({
          provider: "heuristic",
          model: "local-fallback",
          output: heuristicChat(prompt),
          warnings: ["All configured LLM providers failed. Returned deterministic fallback."]
        })
      });

      writeJson(res, 200, result);
      recordAdminEvent({ ...requestMeta, status: 200, durationMs: Date.now() - requestStart, provider: result.provider });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/foundry/brief") {
      const body = await readJsonBody(req);
      const payload = sanitizeFoundryPayload(body);
      const result = await invokeWithFallback({
        task: "foundry",
        system: buildFoundrySystemPrompt(),
        user: buildFoundryUserPrompt(payload),
        responseMode: "json",
        fallback: () => ({
          provider: "heuristic",
          model: "local-fallback",
          brief: heuristicFoundryBrief(payload),
          warnings: ["All configured LLM providers failed. Returned deterministic fallback brief."]
        })
      });

      // Persist the compiled brief so CLI and web share the same artifact
      if (result.brief) {
        const persistBody = { ...result.brief, source: "web", provider: result.provider };
        handleFoundryRoute(
          { method: "POST" }, { pathname: "/api/foundry/compiled-brief" },
          () => {}, () => Promise.resolve(persistBody)
        ).catch(() => {});
      }

      writeJson(res, 200, result);
      recordAdminEvent({ ...requestMeta, status: 200, durationMs: Date.now() - requestStart, provider: result.provider });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/tarot-image") {
      const body = await readJsonBody(req);
      const card = String(body?.card || "The Lantern").trim();
      const motif = String(body?.motif || "woodcut tarot, ember-lit workshop, symbolic frontstage").trim();
      const prompt = buildTarotPrompt(card, motif);

      try {
        const image = await generateTarotImage(prompt);
        writeJson(res, 200, image);
        recordAdminEvent({ ...requestMeta, status: 200, durationMs: Date.now() - requestStart, provider: image.provider });
        return;
      } catch (error) {
        writeJson(res, 200, {
          provider: "svg-fallback",
          model: "local-svg",
          prompt,
          imageDataUrl: svgTarotFallback(card, motif),
          warnings: [error.message || "Remote image generation failed; returned SVG fallback."]
        });
        recordAdminEvent({ ...requestMeta, status: 200, durationMs: Date.now() - requestStart, provider: "svg-fallback", error: error.message || "image generation failed" });
        return;
      }
    }

    // Foundry state API (trace ledger, task envelopes, acceptance, frames)
    if (url.pathname.startsWith("/api/foundry/") && url.pathname !== "/api/foundry/brief") {
      const handled = await handleFoundryRoute(
        req, url,
        (status, payload) => writeJson(res, status, payload),
        readJsonBody
      );
      if (handled !== false) {
        recordAdminEvent({ ...requestMeta, status: 200, durationMs: Date.now() - requestStart });
        return;
      }
    }

    if (req.method === "GET" || req.method === "HEAD") {
      await serveStatic(url.pathname, res, req.method === "HEAD");
      recordAdminEvent({ ...requestMeta, status: 200, durationMs: Date.now() - requestStart });
      return;
    }

    writeJson(res, 404, { error: "Not found" });
    recordAdminEvent({ ...requestMeta, status: 404, durationMs: Date.now() - requestStart, error: "not found" });
  } catch (error) {
    writeJson(res, 500, { error: error.message || "Internal server error" });
    recordAdminEvent({ ...requestMeta, status: 500, durationMs: Date.now() - requestStart, error: error.message || "internal server error" });
  }
}).listen(PORT, () => {
  console.log(`hynous-foundry listening on http://0.0.0.0:${PORT}`);
});

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (!origin || ALLOW_ORIGINS.includes("*")) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  } else if (ALLOW_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function checkRateLimit(req, routePath) {
  if (!routePath.startsWith("/api/")) return true;
  const ip = req.socket.remoteAddress || "unknown";
  const key = `${ip}:${req.method || "GET"}:${routePath}`;
  const now = Date.now();
  const bucket = requestBuckets.get(key) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }
  bucket.count += 1;
  requestBuckets.set(key, bucket);
  return bucket.count <= RATE_LIMIT_MAX_REQUESTS;
}

async function serveStatic(requestPath, res, headOnly = false) {
  const safePath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(ROOT, safePath === "/" ? "index.html" : safePath);

  if (filePath.endsWith(path.sep)) filePath = path.join(filePath, "index.html");

  if (!existsSync(filePath)) {
    filePath = path.join(ROOT, "index.html");
  } else {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = path.join(filePath, "index.html");
  }

  const ext = path.extname(filePath).toLowerCase();
  const type = MIME_TYPES.get(ext) || "application/octet-stream";
  res.writeHead(200, { "Content-Type": type });
  if (headOnly) {
    res.end();
    return;
  }
  createReadStream(filePath).pipe(res);
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function writeJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

function recordAdminEvent(event) {
  adminStats.totalRequests += 1;
  if (event.route.startsWith("/api/")) adminStats.apiRequests += 1;
  adminStats.statusCounts[event.status] = (adminStats.statusCounts[event.status] || 0) + 1;
  adminStats.routeCounts[event.route] = (adminStats.routeCounts[event.route] || 0) + 1;

  adminEvents.push({
    at: new Date().toISOString(),
    ...event
  });
  while (adminEvents.length > 200) adminEvents.shift();

  adminStats.recentErrors = adminEvents.filter((item) => item.status >= 400 || item.error).length;
}

function buildAdminSummary() {
  return {
    ...adminStats,
    rateLimit: {
      windowMs: RATE_LIMIT_WINDOW_MS,
      maxRequests: RATE_LIMIT_MAX_REQUESTS
    },
    recentRoutes: Object.entries(adminStats.routeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([route, count]) => ({ route, count }))
  };
}

function listConfiguredProviders() {
  return PROVIDER_ORDER.map((provider) => ({
    id: provider,
    configured: isProviderConfigured(provider),
    model: configuredModel(provider)
  }));
}

async function buildCapabilitiesPayload() {
  const providers = listConfiguredProviders();
  const foundry = await readFoundryStateSummary();
  return {
    service: "hynous-foundry",
    providerOrder: PROVIDER_ORDER,
    llm: {
      providers,
      configuredCount: providers.filter((provider) => provider.configured).length
    },
    images: {
      relay: {
        configured: Boolean(process.env.HF_TOKEN),
        provider: Boolean(process.env.HF_TOKEN) ? "huggingface" : null,
        model: process.env.HF_IMAGE_MODEL || "stabilityai/stable-diffusion-xl-base-1.0"
      },
      browserFallbacks: ["pollinations", "svg"]
    },
    foundry
  };
}

async function readFoundryStateSummary() {
  try {
    const [traceRaw, recoveryRaw] = await Promise.all([
      readFile(path.join(ROOT, "foundry", "state", "trace-ledger.json"), "utf8").catch(() => "[]"),
      readFile(path.join(ROOT, "foundry", "state", "session.json"), "utf8").catch(() => "{}")
    ]);
    const trace = traceRaw ? JSON.parse(traceRaw) : [];
    const session = recoveryRaw ? JSON.parse(recoveryRaw) : {};
    return {
      traceCount: Array.isArray(trace) ? trace.length : 0,
      currentStage: session.current_stage || "unknown"
    };
  } catch {
    return {
      traceCount: 0,
      currentStage: "unknown"
    };
  }
}

function isProviderConfigured(provider) {
  switch (provider) {
    case "openai":
      return Boolean(process.env.OPENAI_API_KEY);
    case "anthropic":
      return Boolean(process.env.ANTHROPIC_API_KEY);
    case "openrouter":
      return Boolean(process.env.OPENROUTER_API_KEY);
    case "ollama":
      return true;
    default:
      return false;
  }
}

function configuredModel(provider) {
  switch (provider) {
    case "openai":
      return process.env.OPENAI_MODEL || "gpt-5";
    case "anthropic":
      return process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
    case "openrouter":
      return process.env.OPENROUTER_MODEL || "openai/gpt-4.1-mini";
    case "ollama":
      return process.env.OLLAMA_MODEL || "llama3.1";
    default:
      return null;
  }
}

async function invokeWithFallback({ task, system, user, responseMode, fallback }) {
  const failures = [];

  for (const provider of PROVIDER_ORDER) {
    if (!isProviderConfigured(provider)) {
      failures.push({ provider, error: "not configured" });
      continue;
    }

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        const responseText = await callProvider(provider, { system, user, task });

        if (responseMode === "json") {
          const brief = extractJsonObject(responseText);
          return {
            provider,
            model: configuredModel(provider),
            brief,
            failures
          };
        }

        return {
          provider,
          model: configuredModel(provider),
          output: responseText.trim(),
          failures
        };
      } catch (error) {
        const retryable = isRetryable(error);
        failures.push({ provider, attempt, error: error.message || String(error) });
        if (!retryable || attempt === MAX_RETRIES) break;
      }
    }
  }

  const fallbackResult = fallback();
  fallbackResult.failures = failures;
  return fallbackResult;
}

function isRetryable(error) {
  const message = error.message || "";
  return /timeout|429|5\d\d|ECONNRESET|ENOTFOUND|fetch failed/i.test(message);
}

async function callProvider(provider, prompt) {
  switch (provider) {
    case "openai":
      return callOpenAI(prompt);
    case "anthropic":
      return callAnthropic(prompt);
    case "openrouter":
      return callOpenRouter(prompt);
    case "ollama":
      return callOllama(prompt);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

async function callOpenAI({ system, user }) {
  const json = await fetchJson(`${process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5",
      temperature: 0.7,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    })
  });

  return json.choices?.[0]?.message?.content || "";
}

async function callAnthropic({ system, user }) {
  const json = await fetchJson(`${process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com"}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
      max_tokens: 1800,
      system,
      messages: [
        { role: "user", content: user }
      ]
    })
  });

  return (json.content || [])
    .filter((item) => item.type === "text")
    .map((item) => item.text)
    .join("\n");
}

async function callOpenRouter({ system, user }) {
  const json = await fetchJson(`${process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1"}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER || "https://uprootiny.github.io/gh-dashboard/",
      "X-Title": process.env.OPENROUTER_APP_TITLE || "Hynous Foundry"
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || "openai/gpt-4.1-mini",
      temperature: 0.7,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    })
  });

  return json.choices?.[0]?.message?.content || "";
}

async function callOllama({ system, user }) {
  const json = await fetchJson(`${process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434"}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OLLAMA_MODEL || "llama3.1",
      stream: false,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    })
  });

  return json.message?.content || "";
}

async function fetchJson(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    const text = await response.text();
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${text}`);
    return text ? JSON.parse(text) : {};
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`timeout after ${TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function extractJsonObject(text) {
  const trimmed = String(text || "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}$/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Provider response was not valid JSON");
  }
}

function sanitizeFoundryPayload(body) {
  return {
    practical: {
      devices: String(body?.practical?.devices || "").trim(),
      budget: String(body?.practical?.budget || "").trim(),
      hosting: String(body?.practical?.hosting || "").trim(),
      privacy: String(body?.practical?.privacy || "").trim(),
      primaryDomains: String(body?.practical?.primaryDomains || "").trim()
    },
    behavioral: {
      collaborationMode: String(body?.behavioral?.collaborationMode || "").trim(),
      ambiguityTolerance: String(body?.behavioral?.ambiguityTolerance || "").trim(),
      preferredOutputs: String(body?.behavioral?.preferredOutputs || "").trim(),
      painPoints: String(body?.behavioral?.painPoints || "").trim(),
      workingRhythm: String(body?.behavioral?.workingRhythm || "").trim()
    },
    symbolic: {
      arcana: Array.isArray(body?.symbolic?.arcana) ? body.symbolic.arcana.slice(0, 6).map(String) : [],
      tensions: Array.isArray(body?.symbolic?.tensions) ? body.symbolic.tensions.slice(0, 8).map(String) : [],
      motifs: String(body?.symbolic?.motifs || "").trim()
    },
    traces: {
      notes: String(body?.traces?.notes || "").trim(),
      logs: String(body?.traces?.logs || "").trim().slice(0, 12000)
    }
  };
}

function buildFoundrySystemPrompt() {
  return [
    "You are the schema compiler for a personal AI harness foundry called Ἑυνοῦς.",
    "Your job is to turn practical constraints, behavioral preferences, symbolic card picks, and optional trace excerpts into a coherent PersonalBrief.",
    "Be grounded and specific. Infer only where justified, and phrase speculative inferences as hypotheses.",
    "Return JSON only with this exact shape:",
    JSON.stringify({
      portrait: {
        summary: "",
        workstyle: [],
        aiRelationship: [],
        operationalNeeds: []
      },
      hypotheses: [
        { claim: "", confidence: "low|medium|high", evidence: [] }
      ],
      archetypes: [],
      capabilities: [],
      uiRecommendations: [],
      behavioralContract: [],
      implementationPlan: [],
      buildAgents: [],
      notesForReview: []
    }, null, 2)
  ].join("\n");
}

function buildFoundryUserPrompt(payload) {
  return [
    "Compile a PersonalBrief from this intake payload.",
    "",
    JSON.stringify(payload, null, 2),
    "",
    "Requirements:",
    "- Tie arcana picks to concrete system behavior.",
    "- Surface contradictions or tensions if present.",
    "- Prefer explicit structure over generic inspiration.",
    "- Keep implementation steps concrete and buildable."
  ].join("\n");
}

function heuristicChat(prompt) {
  return [
    "Fallback response:",
    `I received: ${prompt}`,
    "No external LLM provider responded, so this deterministic fallback is confirming transport and resilience behavior only."
  ].join("\n\n");
}

function heuristicFoundryBrief(payload) {
  const arcana = payload.symbolic.arcana.length ? payload.symbolic.arcana : ["Forge", "Lantern"];
  const collaboration = payload.behavioral.collaborationMode || "collaborative but inspectable";
  const privacy = payload.practical.privacy || "balanced privacy with explicit consent for persistence";
  const tracesPresent = Boolean(payload.traces.logs || payload.traces.notes);
  const domains = payload.practical.primaryDomains
    ? payload.practical.primaryDomains.split(",").map((item) => item.trim()).filter(Boolean)
    : ["architecture", "research", "code hardening"];

  return {
    portrait: {
      summary: `This user appears to want a ${collaboration} AI harness with ${privacy}.`,
      workstyle: [
        payload.behavioral.workingRhythm || "mixed deep-work and opportunistic use",
        payload.behavioral.ambiguityTolerance || "moderate ambiguity tolerance",
        "prefers explicit structure and reusable artifacts"
      ],
      aiRelationship: [
        collaboration,
        "wants inspectability rather than opaque magic",
        "benefits from role-based or staged workflows"
      ],
      operationalNeeds: [
        payload.practical.hosting || "GitHub Pages frontend plus VPS API",
        payload.practical.devices || "desktop-first with mobile fallback",
        tracesPresent ? "trace ingestion and inference review" : "manual intake with optional trace ingestion"
      ]
    },
    hypotheses: [
      {
        claim: "The user prefers symbolic frontstage with formal backstage.",
        confidence: "medium",
        evidence: [
          `arcana picks: ${arcana.join(", ")}`,
          payload.symbolic.motifs || "symbolic motif language requested"
        ]
      },
      {
        claim: "The harness should preserve explicit reasoning structure and durable outputs.",
        confidence: "medium",
        evidence: [
          payload.behavioral.preferredOutputs || "asked for structured outputs",
          payload.behavioral.painPoints || "friction around generic or brittle outputs"
        ]
      }
    ],
    archetypes: Array.from(new Set([
      arcana.includes("Archive") ? "Conservatory" : "Foundry",
      arcana.includes("Chorus") ? "Switchboard" : "Atelier",
      arcana.includes("Veil") ? "Shrine" : "Observatory"
    ])),
    capabilities: [
      "wizard intake across practical, behavioral, and symbolic strata",
      "editable preference hypotheses with evidence",
      "card-driven arcana priors compiled into system settings",
      "multi-provider LLM fallback routing",
      "deployable static frontend plus VPS API",
      ...domains.map((domain) => `${domain} workflow support`)
    ],
    uiRecommendations: [
      "Keep the hero and arcana layer expressive, but compile choices into inspectable panels.",
      "Expose provider state, failures, and fallback provenance.",
      "Use card spreads for symbolic elicitation and structured forms for constraints.",
      "Show generated brief, agent roles, and implementation plan side by side."
    ],
    behavioralContract: [
      "Default to explicit structure.",
      "Keep uncertainty visible.",
      "Do not infer sensitive traits without evidence and review.",
      "Ask before enabling durable memory when privacy is strict.",
      "Preserve provider provenance and fallback history."
    ],
    implementationPlan: [
      "Deploy static app to GitHub Pages.",
      "Run Node API on a VPS behind nginx and systemd.",
      "Configure provider order and secrets through environment variables.",
      "Add persistence only after consent review and data-retention policy are explicit.",
      "Expand the foundry compiler with log ingestion and contradiction surfacing."
    ],
    buildAgents: [
      "Interview Interpreter",
      "Personal Ontologist",
      "Product Architect",
      "Interface Stylist",
      "Prompt and Policy Engineer",
      "Systems Builder",
      "Reviewer and Critic"
    ],
    notesForReview: [
      "Heuristic fallback output was used because no LLM provider succeeded.",
      "Review arcana-to-feature mappings before production use."
    ]
  };
}

function buildTarotPrompt(card, motif) {
  return [
    `${card}, tarot card illustration`,
    motif,
    "ornate vertical composition",
    "symbolic archetype",
    "warm bark and ash palette",
    "woodgrain textures",
    "subtle ember light",
    "high detail",
    "no text, no watermark, no logo"
  ].join(", ");
}

async function generateTarotImage(prompt) {
  if (!process.env.HF_TOKEN) {
    throw new Error("HF_TOKEN not configured");
  }

  const model = process.env.HF_IMAGE_MODEL || "stabilityai/stable-diffusion-xl-base-1.0";
  const response = await fetch(`https://api-inference.huggingface.co/models/${encodeURIComponent(model)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.HF_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        negative_prompt: "blurry, distorted hands, extra limbs, text, watermark, logo, cropped, low quality",
        width: 768,
        height: 1152,
        guidance_scale: 8,
        num_inference_steps: 30
      }
    })
  });

  if (!response.ok) {
    throw new Error(`HF image generation failed: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  return {
    provider: "huggingface",
    model,
    prompt,
    imageDataUrl: `data:image/png;base64,${base64}`
  };
}

function svgTarotFallback(card, motif) {
  const safeCard = escapeXml(card);
  const safeMotif = escapeXml(motif);
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="768" height="1152" viewBox="0 0 768 1152">
    <defs>
      <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="#233d32"/>
        <stop offset="50%" stop-color="#4b2e2a"/>
        <stop offset="100%" stop-color="#8a5a44"/>
      </linearGradient>
      <radialGradient id="ember" cx="50%" cy="44%" r="26%">
        <stop offset="0%" stop-color="#fff4e2"/>
        <stop offset="30%" stop-color="#ffc15c"/>
        <stop offset="65%" stop-color="#ff8740"/>
        <stop offset="100%" stop-color="rgba(179,63,43,0)"/>
      </radialGradient>
    </defs>
    <rect width="768" height="1152" rx="40" fill="url(#bg)"/>
    <rect x="26" y="26" width="716" height="1100" rx="28" fill="none" stroke="#f5e9d3" stroke-opacity="0.55" stroke-width="2"/>
    <circle cx="384" cy="392" r="170" fill="rgba(255,244,226,0.06)" stroke="#f5e9d3" stroke-opacity="0.18"/>
    <circle cx="384" cy="392" r="132" fill="none" stroke="#f5e9d3" stroke-opacity="0.14"/>
    <circle cx="384" cy="392" r="86" fill="url(#ember)"/>
    <path d="M154 612 C268 540 318 720 384 612 C450 504 510 696 620 612" fill="none" stroke="#f5e9d3" stroke-opacity="0.52" stroke-width="4" stroke-linecap="round"/>
    <path d="M164 670 C268 612 326 760 384 690 C442 620 498 744 604 676" fill="none" stroke="#f5e9d3" stroke-opacity="0.28" stroke-width="2.5" stroke-linecap="round"/>
    <text x="384" y="136" text-anchor="middle" font-family="Georgia, serif" font-size="54" fill="#fff4e2">${safeCard}</text>
    <text x="384" y="972" text-anchor="middle" font-family="Georgia, serif" font-size="24" fill="#f5e9d3" opacity="0.82">${safeMotif}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

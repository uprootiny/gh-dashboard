const POLLINATIONS = "https://image.pollinations.ai/prompt/";
const RELAY_KEY = "hynous_api_base";
const METER_KEY = "hynous_tarot_meter_v1";
const apiBaseInput = document.getElementById("api-base");
const cardSelect = document.getElementById("card");
const motifInput = document.getElementById("motif");
const generateBtn = document.getElementById("generate");
const refreshDiagBtn = document.getElementById("refresh-diag");
const imageEl = document.getElementById("image");
const promptEl = document.getElementById("prompt");
const statusEl = document.getElementById("status");
const relayStatusEl = document.getElementById("relay-status");
const pollinationsStatusEl = document.getElementById("pollinations-status");
const lastProviderEl = document.getElementById("last-provider");
const lastLatencyEl = document.getElementById("last-latency");
const attemptCountEl = document.getElementById("attempt-count");
const fallbackCountEl = document.getElementById("fallback-count");
const meterSummaryEl = document.getElementById("meter-summary");
const eventLogEl = document.getElementById("event-log");

let meter = loadMeter();

apiBaseInput.value = localStorage.getItem(RELAY_KEY) || "";
seed();
renderDiagnostics();
probeDiagnostics();

apiBaseInput.addEventListener("change", persistBase);
apiBaseInput.addEventListener("blur", persistBase);
generateBtn.addEventListener("click", generate);
refreshDiagBtn.addEventListener("click", probeDiagnostics);

function persistBase() {
  const value = apiBaseInput.value.trim().replace(/\/$/, "");
  if (value) localStorage.setItem(RELAY_KEY, value);
  else localStorage.removeItem(RELAY_KEY);
  probeDiagnostics();
}

function buildPrompt(card, motif) {
  return `${card}, tarot card illustration, ${motif}, ornate vertical composition, symbolic archetype, warm bark and ash palette, woodgrain textures, subtle ember light, high detail, no text, no watermark, no logo`;
}

function seed() {
  const prompt = buildPrompt(cardSelect.value, motifInput.value.trim());
  promptEl.textContent = prompt;
  imageEl.src = fallbackSvg(cardSelect.value, motifInput.value.trim());
}

async function generate() {
  const card = cardSelect.value;
  const motif = motifInput.value.trim();
  const prompt = buildPrompt(card, motif);
  promptEl.textContent = prompt;

  const base = (apiBaseInput.value.trim() || "").replace(/\/$/, "");
  const startedAt = performance.now();
  recordAttempt();

  // Strategy 1: Custom relay (if configured)
  if (base) {
    statusEl.textContent = "Generating via relay…";
    try {
      const res = await fetch(`${base}/api/tarot-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card, motif })
      });
      const data = await res.json();
      if (res.ok && data.imageDataUrl) {
        imageEl.src = data.imageDataUrl;
        const latency = Math.round(performance.now() - startedAt);
        recordSuccess(data.provider || "relay", latency, data.warnings || []);
        statusEl.textContent = `Generated via ${data.provider || "relay"} in ${latency} ms.`;
        renderDiagnostics();
        return;
      }
    } catch (e) {
      recordFailure("relay", e.message);
      statusEl.textContent = `Relay failed (${e.message}), falling back to Pollinations…`;
    }
  }

  // Strategy 2: Pollinations.ai (free, no auth, CORS-friendly)
  statusEl.textContent = "Generating via Pollinations.ai…";
  const pollinationsUrl = POLLINATIONS + encodeURIComponent(prompt) + "?width=512&height=768&nologo=true&seed=" + Math.floor(Math.random() * 99999);

  try {
    // Preload as image to verify it works
    const img = new Image();
    img.crossOrigin = "anonymous";
    const loaded = await new Promise((resolve, reject) => {
      img.onload = () => resolve(true);
      img.onerror = () => reject(new Error("image failed"));
      setTimeout(() => reject(new Error("timeout")), 45000);
      img.src = pollinationsUrl;
    });
    void loaded;
    imageEl.src = pollinationsUrl;
    const latency = Math.round(performance.now() - startedAt);
    recordSuccess("pollinations", latency, base ? ["Relay failed first; used free fallback."] : []);
    statusEl.textContent = `Generated via Pollinations.ai in ${latency} ms.`;
  } catch (e) {
    // Strategy 3: SVG fallback
    imageEl.src = fallbackSvg(card, motif);
    const latency = Math.round(performance.now() - startedAt);
    recordSuccess("svg-fallback", latency, [`Remote generation failed: ${e.message}`]);
    statusEl.textContent = `All remote providers failed. SVG fallback rendered in ${latency} ms.`;
  }

  renderDiagnostics();
}

function fallbackSvg(card, motif) {
  const safeCard = escapeXml(card);
  const safeMotif = escapeXml(motif);
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="768" height="1152" viewBox="0 0 768 1152">
    <defs>
      <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="#233d32"/>
        <stop offset="55%" stop-color="#4b2e2a"/>
        <stop offset="100%" stop-color="#8a5a44"/>
      </linearGradient>
      <radialGradient id="ember" cx="50%" cy="42%" r="26%">
        <stop offset="0%" stop-color="#fff4e2"/>
        <stop offset="32%" stop-color="#ffc15c"/>
        <stop offset="65%" stop-color="#ff8740"/>
        <stop offset="100%" stop-color="rgba(179,63,43,0)"/>
      </radialGradient>
    </defs>
    <rect width="768" height="1152" rx="40" fill="url(#bg)"/>
    <rect x="26" y="26" width="716" height="1100" rx="28" fill="none" stroke="#f5e9d3" stroke-opacity="0.5" stroke-width="2"/>
    <circle cx="384" cy="394" r="150" fill="rgba(255,244,226,0.06)" stroke="#f5e9d3" stroke-opacity="0.16"/>
    <circle cx="384" cy="394" r="96" fill="url(#ember)"/>
    <path d="M152 620 C258 552 320 714 384 632 C446 552 514 708 618 622" fill="none" stroke="#f5e9d3" stroke-opacity="0.48" stroke-width="4" stroke-linecap="round"/>
    <text x="384" y="134" text-anchor="middle" font-family="Georgia, serif" font-size="54" fill="#fff4e2">${safeCard}</text>
    <text x="384" y="980" text-anchor="middle" font-family="Georgia, serif" font-size="22" fill="#f5e9d3" opacity="0.84">${safeMotif}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function loadMeter() {
  try {
    const saved = JSON.parse(localStorage.getItem(METER_KEY) || "{}");
    return {
      attempts: Number(saved.attempts || 0),
      fallbackEvents: Number(saved.fallbackEvents || 0),
      providers: saved.providers || {},
      lastProvider: saved.lastProvider || null,
      lastLatencyMs: Number(saved.lastLatencyMs || 0),
      events: Array.isArray(saved.events) ? saved.events.slice(0, 12) : []
    };
  } catch {
    return {
      attempts: 0,
      fallbackEvents: 0,
      providers: {},
      lastProvider: null,
      lastLatencyMs: 0,
      events: []
    };
  }
}

function saveMeter() {
  localStorage.setItem(METER_KEY, JSON.stringify(meter));
}

function recordAttempt() {
  meter.attempts += 1;
  saveMeter();
}

function recordFailure(provider, error) {
  const entry = meter.providers[provider] || { attempts: 0, successes: 0, failures: 0 };
  entry.attempts += 1;
  entry.failures += 1;
  meter.providers[provider] = entry;
  meter.fallbackEvents += 1;
  pushEvent(`${provider} failed: ${error}`);
  saveMeter();
}

function recordSuccess(provider, latencyMs, warnings) {
  const entry = meter.providers[provider] || { attempts: 0, successes: 0, failures: 0 };
  entry.attempts += 1;
  entry.successes += 1;
  meter.providers[provider] = entry;
  meter.lastProvider = provider;
  meter.lastLatencyMs = latencyMs;
  pushEvent(`${provider} succeeded in ${latencyMs} ms`);
  for (const warning of warnings || []) {
    meter.fallbackEvents += 1;
    pushEvent(String(warning));
  }
  saveMeter();
}

function pushEvent(message) {
  meter.events.unshift({
    message,
    at: new Date().toISOString()
  });
  meter.events = meter.events.slice(0, 8);
}

function renderDiagnostics() {
  const base = (apiBaseInput.value.trim() || "").replace(/\/$/, "");
  const relayText = base ? "Configured; probe pending or completed." : "No relay configured; browser will use free path.";
  relayStatusEl.textContent = relayStatusEl.textContent === "Unknown" ? relayText : relayStatusEl.textContent;
  lastProviderEl.textContent = meter.lastProvider || "None yet";
  lastLatencyEl.textContent = meter.lastLatencyMs ? `${meter.lastLatencyMs} ms` : "No runs yet";
  attemptCountEl.textContent = String(meter.attempts);
  fallbackCountEl.textContent = String(meter.fallbackEvents);

  const providerBits = Object.entries(meter.providers)
    .map(([name, stats]) => `${name}: ${stats.successes}/${stats.attempts} success`)
    .join(" · ");
  meterSummaryEl.textContent = providerBits || "No provider calls recorded yet.";

  eventLogEl.innerHTML = meter.events.length
    ? meter.events.map((event) => `<li>${escapeHtml(event.message)} <small>(${new Date(event.at).toLocaleTimeString()})</small></li>`).join("")
    : "<li>Diagnostics will appear here after the first probe.</li>";
}

async function probeDiagnostics() {
  const base = (apiBaseInput.value.trim() || "").replace(/\/$/, "");
  relayStatusEl.textContent = base ? "Checking relay…" : "No relay configured; skipped.";
  pollinationsStatusEl.textContent = "Free provider available at runtime; next generate will verify it.";

  if (!base) {
    renderDiagnostics();
    return;
  }

  try {
    const [healthRes, providersRes] = await Promise.all([
      fetch(`${base}/api/health`),
      fetch(`${base}/api/providers`)
    ]);

    const health = await healthRes.json();
    const providers = await providersRes.json();
    const configured = (providers.providers || [])
      .filter((provider) => provider.configured)
      .map((provider) => `${provider.id}:${provider.model || "configured"}`);

    relayStatusEl.textContent = health.ok
      ? `Reachable. Service ${health.service} responded; configured providers: ${configured.join(", ") || "none"}`
      : "Relay responded without healthy status.";
    pushEvent(`relay probe ok: ${configured.length} configured provider(s)`);
  } catch (error) {
    relayStatusEl.textContent = `Relay probe failed: ${error.message}`;
    pushEvent(`relay probe failed: ${error.message}`);
  }

  saveMeter();
  renderDiagnostics();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

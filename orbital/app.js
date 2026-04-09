const TAU = Math.PI * 2;
const REPO_API = "https://api.github.com/repos/uprootiny/gh-dashboard";
const RATE_API = "https://api.github.com/rate_limit";
const RELAY_KEY = "hynous_api_base";
const MODE_LEGEND = {
  instrument: "Crisp control, stronger response, visible coupling.",
  reverie: "Soft drift, layered residue, slower semantic thickening.",
  oracle: "Sparse response, delayed echoes, stillness becomes active."
};

const wrap = document.getElementById("orbital-canvas");
const svg = document.getElementById("orbital-svg");
const metricsEl = document.getElementById("orbit-metrics");
const statsGrid = document.getElementById("stats-grid");
const modeChip = document.getElementById("mode-chip");
const ringChip = document.getElementById("ring-chip");
const modeTitle = document.getElementById("mode-title");
const modeDescription = document.getElementById("mode-description");
const resetBtn = document.getElementById("reset-btn");
const traceToggle = document.getElementById("trace-toggle");
const probeBtn = document.getElementById("probe-btn");
const apiBaseInput = document.getElementById("api-base");
const timeScaleInput = document.getElementById("time-scale");
const timeScaleValue = document.getElementById("time-scale-value");
const diagList = document.getElementById("diag-list");
const traceList = document.getElementById("trace-list");

let size = { w: 900, h: 640 };
let rings = seedRings(6);
let hovered = null;
let selected = 2;
let dragging = false;
let timeScale = 1;
let traceOn = true;
let stats = { hovers: 0, drags: 0, clicks: 0, stillness: 0 };
let traces = [];
let pointer = { x: 0, y: 0, inside: false };
let last = performance.now();
let lastMove = performance.now();
let raf = 0;
let diagnostics = {
  repoFreshnessHours: null,
  githubRateRemaining: null,
  relayHealthy: false,
  configuredProviders: 0,
  traceCount: null,
  recoveryNeeded: false
};
let systemEvents = [];

const ro = new ResizeObserver(([entry]) => {
  const rect = entry.contentRect;
  size = { w: rect.width, h: rect.height };
  svg.setAttribute("viewBox", `0 0 ${size.w} ${size.h}`);
});
ro.observe(wrap);

wrap.addEventListener("pointermove", onPointerMove);
wrap.addEventListener("pointerleave", () => {
  pointer.inside = false;
  hovered = null;
});
wrap.addEventListener("pointerdown", () => {
  if (hovered == null) return;
  selected = hovered;
  dragging = true;
  stats.clicks += 1;
  renderUi();
});
window.addEventListener("pointerup", () => {
  dragging = false;
});
resetBtn.addEventListener("click", resetAll);
traceToggle.addEventListener("click", () => {
  traceOn = !traceOn;
  renderUi();
});
timeScaleInput.addEventListener("input", () => {
  timeScale = Number(timeScaleInput.value);
  renderUi();
});
probeBtn.addEventListener("click", refreshDiagnostics);
apiBaseInput.value = localStorage.getItem(RELAY_KEY) || "";
apiBaseInput.addEventListener("change", persistBase);
apiBaseInput.addEventListener("blur", persistBase);

renderUi();
renderDiagnostics();
raf = requestAnimationFrame(step);
refreshDiagnostics();

function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function polar(cx, cy, r, theta) {
  return { x: cx + Math.cos(theta) * r, y: cy + Math.sin(theta) * r };
}

function seedRings(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    radius: 70 + i * 52,
    theta: Math.random() * TAU,
    speed: 0.0018 + i * 0.00065,
    coupling: 0.18 + i * 0.08,
    drag: 0.985 - i * 0.008,
    resonance: 0.3 + Math.random() * 0.4,
    memory: 0.5,
    neglect: Math.random() * 0.3,
    consecration: 0,
    fatigue: 0,
    brightness: 0.45,
    satellites: 1 + (i % 3)
  }));
}

function modeFromStats() {
  if (stats.hovers > 120 && stats.clicks < 8) return "oracle";
  if (stats.drags > 24 || stats.clicks > 16) return "instrument";
  return "reverie";
}

function persistBase() {
  const value = apiBaseInput.value.trim().replace(/\/$/, "");
  if (value) localStorage.setItem(RELAY_KEY, value);
  else localStorage.removeItem(RELAY_KEY);
  refreshDiagnostics();
}

function center() {
  return { x: size.w / 2, y: size.h / 2 };
}

function ringPositions() {
  const c = center();
  return rings.map((ring) => ({ ...ring, pos: polar(c.x, c.y, ring.radius, ring.theta) }));
}

function onPointerMove(event) {
  const rect = wrap.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  pointer = { x, y, inside: true };
  lastMove = performance.now();

  const c = center();
  let best = null;
  let bestScore = Infinity;
  ringPositions().forEach((ring) => {
    const score = Math.abs(dist(c.x, c.y, x, y) - ring.radius);
    if (score < bestScore) {
      bestScore = score;
      best = ring.id;
    }
  });

  if (bestScore < 28) {
    if (hovered !== best) stats.hovers += 1;
    hovered = best;
  } else {
    hovered = null;
  }

  if (dragging && selected != null) {
    const ang = Math.atan2(y - c.y, x - c.x);
    rings = rings.map((ring) =>
      ring.id === selected
        ? {
            ...ring,
            theta: ang,
            consecration: clamp(ring.consecration + 0.02, 0, 1),
            fatigue: clamp(ring.fatigue + 0.008, 0, 1)
          }
        : ring
    );
    stats.drags += 1;
  }
}

function step(now) {
  const dt = Math.min(32, now - last);
  last = now;
  const c = center();
  const mode = modeFromStats();

  rings = rings.map((ring, index, arr) => {
    const selectedBoost = index === selected ? 0.0032 : 0;
    const hoverBoost = index === hovered ? 0.002 : 0;
    const pointerD = pointer.inside ? dist(c.x, c.y, pointer.x, pointer.y) : 9999;
    const pointerNear = clamp(1 - Math.abs(pointerD - ring.radius) / 90, 0, 1);
    const neighbor = arr[(index + 1) % arr.length];
    const couplingInfluence = Math.sin(neighbor.theta - ring.theta) * ring.coupling * 0.008;
    const fatiguePenalty = 1 - ring.fatigue * 0.35;
    const reverieDrift = mode === "reverie" ? 0.0003 * Math.sin(now / 1700 + index) : 0;
    const oracleDelay = mode === "oracle" ? Math.sin(now / (2100 + index * 200)) * 0.00055 : 0;
    const theta = ring.theta + ((ring.speed + selectedBoost + hoverBoost + couplingInfluence + pointerNear * 0.002 + reverieDrift + oracleDelay) * fatiguePenalty * timeScale * dt);
    const neglect = clamp(ring.neglect + (index === hovered || index === selected ? -0.006 : 0.0018), 0, 1);
    const consecration = clamp(ring.consecration + (dragging && index === selected ? 0.005 : -0.0015), 0, 1);
    const fatigue = clamp(ring.fatigue + (index === selected && dragging ? 0.006 : -0.0028), 0, 1);
    const diagnosticBoost = index === 0 && diagnostics.githubRateRemaining != null
      ? diagnostics.githubRateRemaining * 0.12
      : index === 1 && diagnostics.repoFreshnessHours != null
        ? clamp(1 - diagnostics.repoFreshnessHours / 72, 0, 1) * 0.1
        : index === 2 && diagnostics.relayHealthy
          ? 0.12
          : index === 3 && diagnostics.configuredProviders
            ? clamp(diagnostics.configuredProviders / 4, 0, 1) * 0.1
            : index === 4 && diagnostics.traceCount != null
              ? clamp(diagnostics.traceCount / 30, 0, 1) * 0.1
              : index === 5 && diagnostics.recoveryNeeded
                ? -0.08
                : 0;
    const brightness = clamp(0.28 + consecration * 0.35 + (1 - neglect) * 0.24 - fatigue * 0.18 + ring.resonance * 0.15 + diagnosticBoost, 0.18, 0.95);
    const memory = clamp(ring.memory + consecration * 0.004 - 0.0012 + (traceOn ? 0.0005 : -0.001) + diagnosticBoost * 0.3, 0.1, 1);
    return { ...ring, theta: theta % TAU, neglect, consecration, fatigue, brightness, memory };
  });

  if (traceOn && pointer.inside) {
    traces = [...traces, { x: pointer.x, y: pointer.y, t: now, mode }].slice(-260);
  }

  if (now - lastMove > 1200 && pointer.inside) {
    stats.stillness += 1;
  }

  renderUi();
  renderScene(now);
  raf = requestAnimationFrame(step);
}

function renderUi() {
  const active = rings[selected] || rings[0];
  const mode = modeFromStats();
  modeChip.textContent = `mode: ${mode}`;
  ringChip.textContent = `ring: ${selected + 1}`;
  modeTitle.textContent = mode;
  modeDescription.textContent = MODE_LEGEND[mode];
  timeScaleValue.textContent = `${timeScale.toFixed(2)}x`;
  traceToggle.textContent = traceOn ? "Traces on" : "Traces off";
  traceToggle.classList.toggle("btn--solid", traceOn);

  const metrics = [
    ["brightness", active.brightness],
    ["memory", active.memory],
    ["neglect", active.neglect],
    ["consecration", active.consecration],
    ["fatigue", active.fatigue],
    ["resonance", active.resonance]
  ];
  metricsEl.innerHTML = metrics
    .map(([label, value]) => `
      <div class="metric">
        <label>${label}</label>
        <div class="bar"><span style="width:${Math.round(value * 100)}%"></span></div>
        <small>${Math.round(value * 100)}%</small>
      </div>
    `)
    .join("");

  statsGrid.innerHTML = Object.entries(stats)
    .map(([label, value]) => `
      <div class="stat">
        <span>${label}</span>
        <strong>${value}</strong>
      </div>
    `)
    .join("");
  renderTrace();
}

function renderScene(now) {
  const c = center();
  const positions = ringPositions();
  svg.innerHTML = `
    <defs>
      <radialGradient id="coreGlow">
        <stop offset="0%" stop-color="rgba(255,255,255,0.95)"></stop>
        <stop offset="45%" stop-color="rgba(255,255,255,0.2)"></stop>
        <stop offset="100%" stop-color="rgba(255,255,255,0)"></stop>
      </radialGradient>
    </defs>
    ${traces.map((trace) => {
      const age = now - trace.t;
      const alpha = clamp(1 - age / 6000, 0, 1) * 0.18;
      const r = trace.mode === "oracle" ? 7 : trace.mode === "instrument" ? 3.5 : 5.5;
      return `<circle cx="${trace.x}" cy="${trace.y}" r="${r}" fill="rgba(255,255,255,${alpha})"></circle>`;
    }).join("")}
    <circle cx="${c.x}" cy="${c.y}" r="34" fill="url(#coreGlow)"></circle>
    <circle cx="${c.x}" cy="${c.y}" r="7" fill="rgba(255,255,255,0.85)"></circle>
    ${positions.map((ring, index) => {
      const isHovered = hovered === ring.id;
      const isSelected = selected === ring.id;
      const sw = isSelected ? 2.8 : isHovered ? 2.1 : 1.2;
      const op = 0.18 + ring.brightness * 0.42;
      const mode = modeFromStats();
      const dash = mode === "oracle" ? "3 7" : mode === "reverie" ? "2 5" : "";
      const satellites = Array.from({ length: ring.satellites }, (_, satIndex) => {
        const t = ring.theta + (TAU * satIndex) / ring.satellites + index * 0.45;
        const sat = polar(ring.pos.x, ring.pos.y, 16 + satIndex * 10, t * (1.2 + satIndex * 0.12));
        return `<circle cx="${sat.x}" cy="${sat.y}" r="${2.2 + satIndex * 0.6}" fill="rgba(255,255,255,${0.22 + ring.brightness * 0.5})"></circle>`;
      }).join("");
      return `
        <g>
          <circle cx="${c.x}" cy="${c.y}" r="${ring.radius}" fill="none" stroke="rgba(255,255,255,${op})" stroke-width="${sw}" stroke-dasharray="${dash}"></circle>
          ${satellites}
          <line x1="${c.x}" y1="${c.y}" x2="${ring.pos.x}" y2="${ring.pos.y}" stroke="rgba(255,255,255,${0.08 + ring.consecration * 0.3})" stroke-width="1"></line>
          <circle cx="${ring.pos.x}" cy="${ring.pos.y}" r="${isSelected ? 12 : 8.5}" fill="rgba(255,255,255,${0.32 + ring.brightness * 0.45})"></circle>
          <circle cx="${ring.pos.x}" cy="${ring.pos.y}" r="${18 + ring.consecration * 16}" fill="rgba(255,255,255,${0.02 + ring.consecration * 0.07})"></circle>
        </g>
      `;
    }).join("")}
  `;
}

function resetAll() {
  rings = seedRings(6);
  hovered = null;
  selected = 2;
  dragging = false;
  stats = { hovers: 0, drags: 0, clicks: 0, stillness: 0 };
  traces = [];
  renderUi();
}

async function refreshDiagnostics() {
  const base = apiBaseInput.value.trim().replace(/\/$/, "");
  systemEvents.unshift(eventLine("diagnostic-refresh", "started probe cycle"));
  systemEvents = systemEvents.slice(0, 10);
  renderTrace();

  const probes = await Promise.allSettled([
    probeRepo(),
    probeRateLimit(),
    base ? probeRelay(base) : Promise.resolve({ skipped: true })
  ]);

  const [repo, rate, relay] = probes;

  if (repo.status === "fulfilled") {
    diagnostics.repoFreshnessHours = repo.value.freshnessHours;
    systemEvents.unshift(eventLine("repo", `latest push ${repo.value.pushedAt}`));
  } else {
    systemEvents.unshift(eventLine("repo", `failed: ${repo.reason.message}`));
  }

  if (rate.status === "fulfilled") {
    diagnostics.githubRateRemaining = rate.value.remainingRatio;
    systemEvents.unshift(eventLine("github-rate", `${rate.value.remaining}/${rate.value.limit} remaining`));
  } else {
    systemEvents.unshift(eventLine("github-rate", `failed: ${rate.reason.message}`));
  }

  if (relay.status === "fulfilled" && !relay.value.skipped) {
    diagnostics.relayHealthy = relay.value.healthy;
    diagnostics.configuredProviders = relay.value.configuredProviders;
    diagnostics.traceCount = relay.value.traceCount;
    diagnostics.recoveryNeeded = relay.value.recoveryNeeded;
    systemEvents.unshift(eventLine("relay", relay.value.summary));
  } else if (base && relay.status === "rejected") {
    diagnostics.relayHealthy = false;
    diagnostics.configuredProviders = 0;
    diagnostics.traceCount = null;
    diagnostics.recoveryNeeded = false;
    systemEvents.unshift(eventLine("relay", `failed: ${relay.reason.message}`));
  } else {
    diagnostics.relayHealthy = false;
    diagnostics.configuredProviders = 0;
    diagnostics.traceCount = null;
    diagnostics.recoveryNeeded = false;
    systemEvents.unshift(eventLine("relay", "not configured"));
  }

  systemEvents = systemEvents.slice(0, 10);
  renderDiagnostics();
  renderTrace();
}

async function probeRepo() {
  const started = performance.now();
  const response = await fetch(REPO_API, { headers: { Accept: "application/vnd.github+json" } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const data = await response.json();
  const pushedAt = data.pushed_at;
  const freshnessHours = pushedAt ? (Date.now() - Date.parse(pushedAt)) / 36e5 : null;
  return {
    pushedAt: pushedAt ? new Date(pushedAt).toLocaleString() : "unknown",
    freshnessHours,
    latencyMs: Math.round(performance.now() - started),
    stars: data.stargazers_count
  };
}

async function probeRateLimit() {
  const response = await fetch(RATE_API, { headers: { Accept: "application/vnd.github+json" } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const data = await response.json();
  const core = data.resources?.core;
  if (!core) throw new Error("missing core rate limit");
  return {
    remaining: core.remaining,
    limit: core.limit,
    remainingRatio: core.limit ? core.remaining / core.limit : 0
  };
}

async function probeRelay(base) {
  const [healthRes, providersRes, traceRes, recoveryRes] = await Promise.all([
    fetch(`${base}/api/health`),
    fetch(`${base}/api/providers`),
    fetch(`${base}/api/foundry/trace`),
    fetch(`${base}/api/foundry/recovery`)
  ]);
  if (!healthRes.ok) throw new Error(`health ${healthRes.status}`);
  const health = await healthRes.json();
  const providers = providersRes.ok ? await providersRes.json() : { providers: [] };
  const trace = traceRes.ok ? await traceRes.json() : { count: null };
  const recovery = recoveryRes.ok ? await recoveryRes.json() : { needsRecovery: false };
  const configuredProviders = (providers.providers || []).filter((provider) => provider.configured).length;
  return {
    healthy: Boolean(health.ok),
    configuredProviders,
    traceCount: typeof trace.count === "number" ? trace.count : null,
    recoveryNeeded: Boolean(recovery.needsRecovery),
    summary: `healthy=${Boolean(health.ok)} configuredProviders=${configuredProviders} trace=${trace.count ?? "n/a"} recovery=${Boolean(recovery.needsRecovery)}`
  };
}

function renderDiagnostics() {
  const lines = [
    diagnostics.githubRateRemaining == null
      ? "GitHub rate probe unavailable."
      : `GitHub core rate remaining: ${Math.round(diagnostics.githubRateRemaining * 100)}%.`,
    diagnostics.repoFreshnessHours == null
      ? "Repo freshness unknown."
      : `Latest public repo push age: ${diagnostics.repoFreshnessHours.toFixed(1)} hours.`,
    apiBaseInput.value.trim()
      ? `Relay configured. Healthy: ${diagnostics.relayHealthy ? "yes" : "no"}.`
      : "Relay not configured; running on public GitHub diagnostics only.",
    diagnostics.configuredProviders
      ? `Relay reports ${diagnostics.configuredProviders} configured provider(s).`
      : "No configured relay providers detected.",
    diagnostics.traceCount == null
      ? "Foundry trace count unavailable."
      : `Foundry trace events available: ${diagnostics.traceCount}.`,
    diagnostics.recoveryNeeded
      ? "Recovery is needed on the foundry ledger."
      : "No recovery flag is currently raised."
  ];

  diagList.innerHTML = lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
}

function renderTrace() {
  traceList.innerHTML = systemEvents.length
    ? systemEvents.map((event) => `<li>${escapeHtml(event)}</li>`).join("")
    : "<li>Live trace events will appear here.</li>";
}

function eventLine(kind, message) {
  return `[${new Date().toLocaleTimeString()}] ${kind}: ${message}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

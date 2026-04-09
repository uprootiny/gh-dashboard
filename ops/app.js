const API = "https://api.github.com";
const USER = "uprootiny";
const tokenKey = window.HynousRuntime.GITHUB_TOKEN_KEY;

const tokenInput = document.getElementById("token");
const apiBaseInput = document.getElementById("api-base");
const statusEl = document.getElementById("status");
const updatedEl = document.getElementById("updated");
const dashboardEl = document.getElementById("dashboard");
const relayStatusEl = document.getElementById("relay-status");
const relayEventsEl = document.getElementById("relay-events");

let token = window.HynousRuntime.getGithubToken();
apiBaseInput.value = window.HynousRuntime.getApiBase();
if (token) {
  tokenInput.value = token;
  statusEl.textContent = "Token loaded from local storage.";
  refresh();
}
refreshRelay();

document.getElementById("connect").addEventListener("click", () => {
  token = tokenInput.value.trim();
  if (!token) {
    statusEl.textContent = "Token required.";
    return;
  }
  window.HynousRuntime.setGithubToken(token);
  statusEl.textContent = "Token stored locally. Loading telemetry…";
  refresh();
});

document.getElementById("refresh").addEventListener("click", refresh);
document.getElementById("refresh-relay").addEventListener("click", refreshRelay);
apiBaseInput.addEventListener("change", persistApiBase);
apiBaseInput.addEventListener("blur", persistApiBase);

function persistApiBase() {
  apiBaseInput.value = window.HynousRuntime.setApiBase(apiBaseInput.value);
  refreshRelay();
}

async function gh(path) {
  const res = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json"
    }
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function refresh() {
  if (!token) {
    statusEl.textContent = "No token stored.";
    return;
  }

  dashboardEl.innerHTML = `<article class="card"><h2>Loading</h2><div class="status">Fetching GitHub telemetry…</div></article>`;

  try {
    const [rateLimit, user, repos] = await Promise.all([
      gh("/rate_limit"),
      gh("/user"),
      gh(`/users/${USER}/repos?per_page=6&sort=updated`)
    ]);

    const cards = [];
    cards.push(card("API Rate Limits", ["core", "search", "graphql", "code_search"].map((key) => {
      const item = rateLimit.resources[key];
      if (!item) return "";
      const pct = item.limit > 0 ? (item.remaining / item.limit) * 100 : 100;
      return metric(key, `${item.remaining} / ${item.limit}`, pct);
    }).join("")));

    const diskMB = ((user.disk_usage || 0) / 1024).toFixed(1);
    cards.push(card("Account", [
      metric("Plan", user.plan?.name || "free"),
      metric("Public repos", `${user.public_repos}`),
      metric("Disk usage", `${diskMB} MB`)
    ].join("")));

    cards.push(card("Recent Repos", repos.map((repo) => metric(repo.name, `pushed ${timeSince(new Date(repo.pushed_at))}`)).join("")));

    dashboardEl.innerHTML = cards.join("");
    statusEl.textContent = "Telemetry loaded successfully.";
    updatedEl.textContent = `Last updated: ${new Date().toLocaleString()}`;
  } catch (error) {
    dashboardEl.innerHTML = `<article class="card"><h2>Error</h2><div class="status">${escapeHtml(error.message)}</div></article>`;
    statusEl.textContent = "Failed to load telemetry.";
  }
}

async function refreshRelay() {
  try {
    const probe = await window.HynousRuntime.probeRelay();
    if (!probe.configured) {
      relayStatusEl.textContent = "No relay configured. This app can still read GitHub directly.";
      relayEventsEl.innerHTML = "<li>Set an API base to expose relay and foundry state.</li>";
      return;
    }

    const capabilities = probe.capabilities || {};
    const adminSummary = await window.HynousRuntime.apiJson("/api/admin/summary", { method: "GET" }).catch(() => null);
    relayStatusEl.textContent = probe.healthy
      ? `Relay healthy. LLM providers: ${capabilities.llm?.configuredCount || 0}. Image relay: ${capabilities.images?.relay?.configured ? "on" : "off"}.`
      : "Relay configured but unhealthy.";

    const lines = [
      `foundry stage: ${capabilities.foundry?.currentStage || "unknown"}`,
      `foundry trace count: ${capabilities.foundry?.traceCount ?? "n/a"}`,
      adminSummary ? `tracked requests: ${adminSummary.totalRequests}` : "admin summary unavailable",
      adminSummary ? `recent errors: ${adminSummary.recentErrors}` : "error summary unavailable"
    ];

    relayEventsEl.innerHTML = lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
  } catch (error) {
    relayStatusEl.textContent = `Relay refresh failed: ${error.message}`;
    relayEventsEl.innerHTML = `<li>${escapeHtml(error.message)}</li>`;
  }
}

function card(title, content) {
  return `<article class="card"><h2>${escapeHtml(title)}</h2>${content}</article>`;
}

function metric(name, value, pct = null) {
  const color = pct === null ? "green" : pct > 70 ? "green" : pct > 30 ? "yellow" : "red";
  return `
    <div class="metric">
      <span>${escapeHtml(name)}</span>
      <span style="display:flex;align-items:center;gap:8px">
        <strong>${escapeHtml(value)}</strong>
        ${pct === null ? "" : `<span class="bar"><span class="fill ${color}" style="width:${Math.min(100, pct)}%"></span></span>`}
      </span>
    </div>
  `;
}

function timeSince(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  const intervals = [[31536000, "y"], [2592000, "mo"], [86400, "d"], [3600, "h"], [60, "m"]];
  for (const [secs, label] of intervals) {
    const count = Math.floor(seconds / secs);
    if (count >= 1) return `${count}${label} ago`;
  }
  return "just now";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

(function initRuntime(global) {
  const API_BASE_KEY = "hynous_api_base";
  const GITHUB_TOKEN_KEY = "gh_token";

  function defaultApiBase() {
    const { origin, hostname } = global.location;
    if (hostname.endsWith("github.io")) return "";
    return origin;
  }

  function getApiBase() {
    return (global.localStorage.getItem(API_BASE_KEY) || defaultApiBase()).replace(/\/$/, "");
  }

  function setApiBase(value) {
    const normalized = String(value || "").trim().replace(/\/$/, "");
    if (normalized) {
      global.localStorage.setItem(API_BASE_KEY, normalized);
      return normalized;
    }
    global.localStorage.removeItem(API_BASE_KEY);
    return defaultApiBase();
  }

  async function fetchJson(url, options) {
    const response = await global.fetch(url, options);
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) throw new Error(data.error || `${response.status} ${response.statusText}`);
    return data;
  }

  async function apiJson(path, options) {
    const base = getApiBase();
    if (!base) throw new Error("API base is not configured");
    return fetchJson(`${base}${path}`, options);
  }

  async function getCapabilities() {
    return apiJson("/api/capabilities", { method: "GET" });
  }

  async function probeRelay() {
    const base = getApiBase();
    if (!base) {
      return { configured: false, healthy: false, capabilities: null };
    }

    const [health, capabilities] = await Promise.all([
      apiJson("/api/health", { method: "GET" }),
      getCapabilities()
    ]);

    return {
      configured: true,
      healthy: Boolean(health.ok),
      capabilities
    };
  }

  function inferRuntimeMode(probe) {
    if (!probe?.configured) {
      return {
        mode: "static-only",
        label: "Static-only mode",
        detail: "No relay configured. Browser fallbacks and public probes only."
      };
    }

    const capabilities = probe.capabilities || {};
    const llmCount = capabilities.llm?.configuredCount || 0;
    const imageRelay = Boolean(capabilities.images?.relay?.configured);
    if (probe.healthy && (llmCount > 0 || imageRelay)) {
      return {
        mode: "full-relay",
        label: "Relay-connected mode",
        detail: `Relay reachable. LLM providers: ${llmCount}. Image relay: ${imageRelay ? "on" : "off"}.`
      };
    }

    return {
      mode: "partial-relay",
      label: "Partial relay mode",
      detail: "Relay configured, but backend capabilities are limited or unavailable."
    };
  }

  function paintRuntimeBanner(probe) {
    const nodes = global.document.querySelectorAll("[data-runtime-banner]");
    if (!nodes.length) return;
    const summary = inferRuntimeMode(probe);
    for (const node of nodes) {
      node.textContent = `${summary.label}. ${summary.detail}`;
      node.dataset.runtimeMode = summary.mode;
    }
  }

  function getGithubToken() {
    return global.localStorage.getItem(GITHUB_TOKEN_KEY) || "";
  }

  function setGithubToken(token) {
    const normalized = String(token || "").trim();
    if (normalized) global.localStorage.setItem(GITHUB_TOKEN_KEY, normalized);
    else global.localStorage.removeItem(GITHUB_TOKEN_KEY);
    return normalized;
  }

  global.HynousRuntime = {
    API_BASE_KEY,
    GITHUB_TOKEN_KEY,
    defaultApiBase,
    getApiBase,
    setApiBase,
    fetchJson,
    apiJson,
    getCapabilities,
    probeRelay,
    inferRuntimeMode,
    paintRuntimeBanner,
    getGithubToken,
    setGithubToken
  };
})(window);

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
    getGithubToken,
    setGithubToken
  };
})(window);

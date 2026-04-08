const API = "https://api.github.com";
const USER = "uprootiny";
const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const API_BASE_KEY = "hynous_api_base";
const POLLINATIONS = "https://image.pollinations.ai/prompt/";

let token = localStorage.getItem("gh_token") || "";
let idleTimer = null;
let apiBase = localStorage.getItem(API_BASE_KEY) || defaultApiBase();
let latestCompiledBundle = null;

const heroInput = document.getElementById("hero-input");
const heroResultState = document.getElementById("hero-result-state");
const heroResultBody = document.getElementById("hero-result-body");
const generateBtn = document.getElementById("generate-btn");

const sandboxInput = document.getElementById("sandbox-input");
const sandboxRun = document.getElementById("sandbox-run");
const sandboxSample = document.getElementById("sandbox-sample");
const sandboxState = document.getElementById("sandbox-state");
const demoOutput = document.getElementById("demo-output");
const demoFocus = document.getElementById("demo-focus");
const demoEnergy = document.getElementById("demo-energy");
const demoResidue = document.getElementById("demo-residue");
const dropzone = document.getElementById("dropzone");

const dashboard = document.getElementById("dashboard");
const updated = document.getElementById("updated");
const tokenInput = document.getElementById("token");
const errorEl = document.getElementById("error");
const setupCopy = document.getElementById("setup-copy");
const connectBtn = document.getElementById("connect-btn");
const refreshBtn = document.getElementById("refresh-btn");
const meshSection = document.getElementById("process");
const apiBaseInput = document.getElementById("api-base");
const providerOrder = document.getElementById("provider-order");
const compileStatus = document.getElementById("compile-status");

const compileBtn = document.getElementById("compile-brief");
const loadFoundrySampleBtn = document.getElementById("load-foundry-sample");
const arcanaDeck = document.getElementById("arcana-deck");
const briefTitle = document.getElementById("brief-title");
const briefSummary = document.getElementById("brief-summary");
const briefArchetypes = document.getElementById("brief-archetypes");
const briefCapabilities = document.getElementById("brief-capabilities");
const briefContract = document.getElementById("brief-contract");
const briefPlan = document.getElementById("brief-plan");
const briefHypotheses = document.getElementById("brief-hypotheses");
const briefUi = document.getElementById("brief-ui");
const briefAgents = document.getElementById("brief-agents");
const briefNotes = document.getElementById("brief-notes");
const briefSchema = document.getElementById("brief-schema");
const briefPromptPack = document.getElementById("brief-prompt-pack");
const briefScaffold = document.getElementById("brief-scaffold");
const toolManifestEl = document.getElementById("tool-manifest");
const toolCommandsEl = document.getElementById("tool-commands");
const downloadBriefJsonBtn = document.getElementById("download-brief-json");
const downloadScaffoldBtn = document.getElementById("download-scaffold");
const downloadToolManifestBtn = document.getElementById("download-tool-manifest");
const galleryEl = document.getElementById("pipeline-gallery");
const rerollGalleryBtn = document.getElementById("reroll-gallery");
const tarotCardSelect = document.getElementById("tarot-card");
const tarotMotifInput = document.getElementById("tarot-motif");
const generateTarotBtn = document.getElementById("generate-tarot");
const tarotImage = document.getElementById("tarot-image");
const tarotStatus = document.getElementById("tarot-status");
const tarotPrompt = document.getElementById("tarot-prompt");

const heroSamples = [
  "I feel the grain of your request. I'll turn the scattered repo notes into a release artifact with risks surfaced, ownership made explicit, and the next pass already staged.",
  "The harness has cut through the loose matter: one artifact, three risks, and a direct path from rough input to reusable operational form.",
  "Raw fragments joined cleanly. Expect a compact answer that preserves traceability, keeps the energy legible, and leaves behind a durable checklist."
];

const sandboxSamples = [
  "Incident notes: alerts came from three systems, ownership was split across ops and product, and no one could tell which runbook was current. Need a stabilization brief and a handoff doc.",
  "Research backlog: twelve interview clips, five issue threads, and a half-complete PRD. Need a synthesis that separates signal from repeated noise before planning.",
  "Deployment prep: staging is green, production metrics are missing, rollback steps are outdated, and docs are split across three repos. Need a go/no-go sheet."
];

const gallerySeeds = [
  {
    title: "Forge + Archive workbench",
    arcana: ["Forge", "Archive", "Lantern"],
    privacy: "consentful persistence",
    autonomy: "medium",
    style: "dense and inspectable",
    contradiction: "Wants high autonomy, but distrusts hidden transformations."
  },
  {
    title: "Veil + Lantern private guide",
    arcana: ["Veil", "Lantern"],
    privacy: "strict local-first boundaries",
    autonomy: "low",
    style: "calm and citation-heavy",
    contradiction: "Wants trustable help, but will reject silent logging."
  },
  {
    title: "Chorus + Forge orchestration shell",
    arcana: ["Chorus", "Forge", "Mirror"],
    privacy: "balanced",
    autonomy: "high",
    style: "plural and branchable",
    contradiction: "Wants many agents, but still needs a single coherent contract."
  },
  {
    title: "Garden + Archive continuity studio",
    arcana: ["Archive", "Mirror"],
    privacy: "durable memory with pruning controls",
    autonomy: "medium",
    style: "slow and reflective",
    contradiction: "Wants continuity, but not clutter or guilt-inducing resurfacing."
  },
  {
    title: "Blade fallback operator",
    arcana: ["Lantern"],
    privacy: "minimal retention",
    autonomy: "low",
    style: "compressed and decisive",
    contradiction: "Claims to want brevity, but still demands enough evidence to trust the cut."
  }
];

if (token) {
  tokenInput.value = token;
  setupCopy.textContent = "Token stored locally. Refresh to pull live GitHub telemetry.";
}

if (apiBaseInput) {
  apiBaseInput.value = apiBase;
}

init();

function init() {
  attachHeroHandlers();
  attachSandboxHandlers();
  attachFoundryHandlers();
  attachDashboardHandlers();
  attachTarotHandlers();
  attachGlobalActivityHandlers();
  updateMeshOpacity();
  setIdleAsh(false);

  document.addEventListener("scroll", updateMeshOpacity, { passive: true });

  if (token) {
    refresh();
  } else {
    renderDashboardPlaceholder("Connect a token to load live quota cards.");
  }

  refreshProviderStatus();
  renderPipelineGallery();
  seedTarotPreview();
}

function attachHeroHandlers() {
  heroInput.addEventListener("focus", () => {
    setGrainProgress(1);
    if (navigator.vibrate) navigator.vibrate(10);
  });

  heroInput.addEventListener("blur", () => {
    if (!heroInput.value.trim()) setGrainProgress(0.18);
  });

  heroInput.addEventListener("input", () => {
    setGrainProgress(heroInput.value.trim() ? 1 : 0.18);
  });

  generateBtn.addEventListener("click", async () => {
    const request = heroInput.value.trim();
    if (!request) return;

    heroResultState.textContent = "Igniting";
    heroResultBody.innerHTML = "<strong>Grain captured.</strong> Cutting a clean line through the request…";
    pulseButton(generateBtn);
    setGrainProgress(1);

    try {
      const result = await callHarnessChat(request);
      heroResultState.textContent = result.provider ? `Settled via ${result.provider}` : "Settled";
      heroResultBody.innerHTML = result.output;
    } catch {
      const answer = await fakeAI(request);
      heroResultState.textContent = "Settled locally";
      heroResultBody.innerHTML = answer;
    }
    touchAsh();
  });
}

function attachSandboxHandlers() {
  ["dragenter", "dragover"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add("is-active");
      sandboxState.textContent = "Drop text to shape it";
    });
  });

  ["dragleave", "dragend"].forEach((eventName) => {
    dropzone.addEventListener(eventName, () => {
      dropzone.classList.remove("is-active");
      sandboxState.textContent = "Ready to shape";
    });
  });

  dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    const text = event.dataTransfer?.getData("text/plain")?.trim();
    if (text) {
      sandboxInput.value = text;
      sandboxState.textContent = "Dropped matter captured";
      demoFocus.textContent = "Dropped source loaded";
      setGrainProgress(1);
    } else {
      sandboxState.textContent = "Drop plain text or pasted notes";
    }
    dropzone.classList.remove("is-active");
  });

  sandboxInput.addEventListener("focus", () => {
    dropzone.classList.add("is-active");
    demoFocus.textContent = "Material engaged";
    sandboxState.textContent = "Tracking grain";
    setGrainProgress(1);
  });

  sandboxInput.addEventListener("blur", () => {
    dropzone.classList.remove("is-active");
    if (!sandboxInput.value.trim()) demoFocus.textContent = "Awaiting input";
  });

  sandboxSample.addEventListener("click", () => {
    sandboxInput.value = sandboxSamples[Math.floor(Math.random() * sandboxSamples.length)];
    sandboxState.textContent = "Alternate matter loaded";
    demoFocus.textContent = "Material refreshed";
    setGrainProgress(1);
  });

  sandboxRun.addEventListener("click", async () => {
    const source = sandboxInput.value.trim();
    if (!source) return;

    sandboxState.textContent = "Cutting and igniting";
    demoEnergy.textContent = "Pulse rising";
    demoResidue.textContent = "Settling";
    pulseButton(sandboxRun);

    await wait(REDUCED_MOTION ? 0 : 520);

    const artifact = buildArtifact(source);
    demoOutput.innerHTML = artifact.html;
    demoFocus.textContent = artifact.focus;
    demoEnergy.textContent = "Ember condensed";
    demoResidue.textContent = "Artifact preserved";
    sandboxState.textContent = "Artifact ready";
    touchAsh();
  });
}

function attachDashboardHandlers() {
  connectBtn.addEventListener("click", saveToken);
  refreshBtn.addEventListener("click", refresh);
}

function attachFoundryHandlers() {
  apiBaseInput.addEventListener("change", persistApiBase);
  apiBaseInput.addEventListener("blur", persistApiBase);

  arcanaDeck.querySelectorAll("[data-card]").forEach((button) => {
    button.addEventListener("click", () => {
      button.classList.toggle("is-selected");
      touchAsh();
    });
  });

  loadFoundrySampleBtn.addEventListener("click", loadFoundrySample);
  compileBtn.addEventListener("click", compileFoundryBrief);
  downloadBriefJsonBtn.addEventListener("click", () => {
    if (!latestCompiledBundle) return;
    downloadTextFile("hynous-brief.json", JSON.stringify(latestCompiledBundle.brief, null, 2), "application/json");
  });
  downloadScaffoldBtn.addEventListener("click", () => {
    if (!latestCompiledBundle) return;
    downloadTextFile("hynous-scaffold.txt", latestCompiledBundle.scaffoldText, "text/plain");
  });
  downloadToolManifestBtn.addEventListener("click", () => {
    if (!latestCompiledBundle) return;
    downloadTextFile("hynous-tool-manifest.json", latestCompiledBundle.toolManifestText, "application/json");
  });
  rerollGalleryBtn.addEventListener("click", () => {
    renderPipelineGallery();
    touchAsh();
  });
}

function attachTarotHandlers() {
  generateTarotBtn.addEventListener("click", generateTarotImage);
}

function attachGlobalActivityHandlers() {
  ["pointerdown", "keydown", "mousemove", "touchstart"].forEach((eventName) => {
    document.addEventListener(eventName, () => touchAsh(), { passive: true });
  });
  touchAsh();
}

function defaultApiBase() {
  const { origin, hostname } = window.location;
  if (hostname.endsWith("github.io")) return "";
  return origin;
}

function persistApiBase() {
  apiBase = apiBaseInput.value.trim().replace(/\/$/, "");
  if (apiBase) {
    localStorage.setItem(API_BASE_KEY, apiBase);
  } else {
    localStorage.removeItem(API_BASE_KEY);
    apiBase = defaultApiBase();
    apiBaseInput.value = apiBase;
  }
  refreshProviderStatus();
}

function setGrainProgress(value) {
  const clamped = Math.max(0, Math.min(1, value));
  document.documentElement.style.setProperty("--grain-progress", clamped.toFixed(3));
}

function pulseButton(button) {
  button.classList.remove("is-pulsing");
  void button.offsetWidth;
  button.classList.add("is-pulsing");

  window.setTimeout(() => {
    button.classList.remove("is-pulsing");
  }, REDUCED_MOTION ? 0 : 820);
}

function touchAsh() {
  setIdleAsh(false);
  window.clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => setIdleAsh(true), 3000);
}

function setIdleAsh(isIdle) {
  document.documentElement.style.setProperty("--ash-opacity", isIdle && !REDUCED_MOTION ? "0.08" : "0");
  document.documentElement.style.setProperty("--ash-drift", isIdle && !REDUCED_MOTION ? "-16px" : "0px");
}

function updateMeshOpacity() {
  const rect = meshSection.getBoundingClientRect();
  const viewport = window.innerHeight || 1;
  const start = viewport * 0.88;
  const end = viewport * 0.18;
  const progress = (start - rect.top) / (start - end);
  const clamped = Math.max(0.08, Math.min(0.3, 0.08 + Math.max(0, progress) * 0.22));
  document.documentElement.style.setProperty("--mesh-opacity", clamped.toFixed(3));
}

async function refreshProviderStatus() {
  if (!apiBase) {
    providerOrder.innerHTML = `<span class="pill">Set an API base URL for GitHub Pages use.</span>`;
    compileStatus.textContent = "No API base configured yet.";
    return;
  }

  providerOrder.innerHTML = `<span class="pill">Checking providers…</span>`;

  try {
    const info = await apiJson("/api/providers", { method: "GET" });
    providerOrder.innerHTML = info.providers
      .map((provider) => `<span class="pill">${escapeHtml(provider.id)}: ${provider.configured ? escapeHtml(provider.model || "configured") : "not configured"}</span>`)
      .join("");
    compileStatus.textContent = `Compiler reachable. Provider order: ${info.providerOrder.join(" → ")}`;
  } catch {
    providerOrder.innerHTML = `<span class="pill">API unavailable</span>`;
    compileStatus.textContent = "Could not reach the VPS API. The foundry can still render locally, but LLM compilation is offline.";
  }
}

async function compileFoundryBrief() {
  compileStatus.textContent = "Compiling personal brief…";
  pulseButton(compileBtn);
  const payload = gatherFoundryPayload();

  try {
    const result = await apiJson("/api/foundry/brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    renderBrief(result.brief);
    const failureCount = Array.isArray(result.failures) ? result.failures.length : 0;
    compileStatus.textContent = `Compiled via ${result.provider}${failureCount ? ` with ${failureCount} fallback event(s)` : ""}.`;
  } catch (error) {
    const emulated = emulateFoundryBrief(payload);
    renderBrief(emulated);
    compileStatus.textContent = `API unavailable. Rendered local emulation instead: ${error.message}`;
  }
}

function gatherFoundryPayload() {
  return {
    practical: {
      devices: valueOf("devices"),
      budget: valueOf("budget"),
      hosting: valueOf("hosting"),
      privacy: valueOf("privacy"),
      primaryDomains: valueOf("primary-domains")
    },
    behavioral: {
      collaborationMode: valueOf("collaboration-mode"),
      ambiguityTolerance: valueOf("ambiguity-tolerance"),
      preferredOutputs: valueOf("preferred-outputs"),
      painPoints: valueOf("pain-points"),
      workingRhythm: valueOf("working-rhythm")
    },
    symbolic: {
      arcana: Array.from(arcanaDeck.querySelectorAll(".arcana-card.is-selected")).map((button) => button.dataset.card),
      tensions: [],
      motifs: valueOf("symbolic-motifs")
    },
    traces: {
      notes: valueOf("trace-notes"),
      logs: valueOf("trace-notes")
    }
  };
}

function renderBrief(brief) {
  latestCompiledBundle = buildCompiledBundle(brief, gatherFoundryPayload());
  briefTitle.textContent = "Compiled PersonalBrief";
  briefSummary.textContent = brief?.portrait?.summary || "No portrait summary returned.";
  briefArchetypes.innerHTML = (brief?.archetypes || ["Awaiting archetypes"])
    .map((item) => `<span class="pill">${escapeHtml(item)}</span>`)
    .join("");
  briefCapabilities.innerHTML = listItems(brief?.capabilities);
  briefContract.innerHTML = listItems(brief?.behavioralContract);
  briefPlan.innerHTML = listItems(brief?.implementationPlan);
  briefHypotheses.innerHTML = listHypotheses(brief?.hypotheses);
  briefUi.innerHTML = listItems(brief?.uiRecommendations);
  briefAgents.innerHTML = listItems(brief?.buildAgents);
  briefNotes.innerHTML = listItems(brief?.notesForReview);
  briefSchema.textContent = latestCompiledBundle.schemaText;
  briefPromptPack.textContent = latestCompiledBundle.promptPackText;
  briefScaffold.textContent = latestCompiledBundle.scaffoldText;
  toolManifestEl.textContent = latestCompiledBundle.toolManifestText;
  toolCommandsEl.textContent = latestCompiledBundle.commandSurfaceText;
}

function emulateFoundryBrief(payload) {
  const arcana = payload.symbolic.arcana.length ? payload.symbolic.arcana : ["Forge", "Lantern"];
  const privacy = payload.practical.privacy || "balanced privacy with explicit consent";
  const mode = payload.behavioral.collaborationMode || "Collaborator with visible structure";
  const ambiguity = payload.behavioral.ambiguityTolerance || "Medium";
  const domains = payload.practical.primaryDomains
    ? payload.practical.primaryDomains.split(",").map((item) => item.trim()).filter(Boolean)
    : ["architecture", "research", "implementation"];

  const wantsPrivacy = /private|local|consent|strict/i.test(privacy);
  const wantsPlurality = arcana.includes("Chorus");
  const wantsDurability = arcana.includes("Archive");
  const wantsVerification = arcana.includes("Lantern");
  const wantsRevision = arcana.includes("Forge") || arcana.includes("Mirror");

  return {
    portrait: {
      summary: `Emulated brief: this user appears to want a ${mode.toLowerCase()} harness with ${privacy.toLowerCase()} and ${ambiguity.toLowerCase()} ambiguity handling.`,
      workstyle: [
        payload.behavioral.workingRhythm || "mixed deep-work and opportunistic capture",
        wantsRevision ? "iterative and revision-tolerant" : "prefers convergent output",
        "expects explicit structure and reusable artifacts"
      ],
      aiRelationship: [
        mode,
        wantsPlurality ? "comfortable with multi-agent plurality if merge is explicit" : "prefers a single coherent interface",
        wantsVerification ? "trust depends on visible evidence and uncertainty" : "accepts best-effort synthesis with later correction"
      ],
      operationalNeeds: [
        payload.practical.hosting || "static frontend plus hosted or local inference backend",
        payload.practical.devices || "desktop-first with mobile fallback",
        wantsPrivacy ? "reviewable persistence and explicit consent gates" : "durable history with configurable retention"
      ]
    },
    archetypes: Array.from(new Set([
      wantsPlurality ? "Switchboard" : "Foundry",
      wantsDurability ? "Conservatory" : "Atelier",
      wantsPrivacy ? "Shrine" : "Observatory"
    ])),
    capabilities: [
      "three-strata intake compiler",
      "editable preference hypotheses",
      wantsPlurality ? "agent compare-and-merge surfaces" : "single-thread structured collaboration",
      wantsDurability ? "durable logs and replay" : "lightweight session persistence",
      wantsVerification ? "evidence and confidence channels" : "fast synthesis with revision hooks",
      ...domains.map((domain) => `${domain} workflow support`)
    ],
    behavioralContract: [
      "keep uncertainty visible",
      wantsPrivacy ? "ask before durable memory writes" : "make memory controls explicit",
      wantsPlurality ? "do not hide agent disagreement" : "do not produce false plurality for its own sake",
      wantsRevision ? "preserve branch history and revision paths" : "prefer concise and direct forward motion"
    ],
    hypotheses: [
      {
        claim: "The user wants symbolic frontstage only if it compiles into explicit tooling behavior.",
        confidence: "high",
        evidence: [payload.symbolic.motifs || "symbolic motifs requested", arcana.join(", ")]
      },
      {
        claim: wantsPrivacy
          ? "Trust depends on reviewable persistence and explicit consent."
          : "Trust depends more on continuity and inspectability than on strict minimal retention.",
        confidence: "medium",
        evidence: [privacy, payload.behavioral.painPoints || "stated pain points"]
      }
    ],
    uiRecommendations: [
      wantsPlurality ? "Use compare-and-merge panes for agent outputs." : "Keep a primary single-thread workbench as default.",
      wantsVerification ? "Expose evidence drawers and confidence markers." : "Prefer direct synthesis with optional drill-down.",
      wantsRevision ? "Preserve branch history and side-by-side iteration diffs." : "Keep the interface concise under overload."
    ],
    implementationPlan: [
      "stabilize the PersonalBrief schema as the core artifact",
      "connect symbolic arcana to explicit parameter bundles",
      "add inference evidence and contradiction review",
      "only then expand to persistent memory and automated build launch"
    ],
    buildAgents: [
      "Interview Interpreter",
      "Personal Ontologist",
      wantsPlurality ? "Multi-Agent Conductor" : "Single-Thread Product Architect",
      "Prompt and Policy Engineer",
      "Systems Builder",
      "Reviewer and Critic"
    ],
    notesForReview: [
      "This local emulation favors coherence over novelty.",
      wantsPrivacy ? "Validate memory policy before trace ingestion." : "Prototype continuity features before adding more symbolism."
    ]
  };
}

function buildCompiledBundle(brief, payload) {
  const toolManifest = {
    tool_name: "hynous-generated-harness",
    mode: payload.behavioral.collaborationMode || "Collaborator with visible structure",
    archetypes: brief?.archetypes || [],
    primary_views: [
      "workbench",
      "brief-inspector",
      "history-ledger",
      "tarot-layer"
    ],
    modules: [
      "intake-compiler",
      "hypothesis-review",
      "task-ledger",
      "prompt-pack",
      "memory-policy",
      "agent-routing"
    ],
    persistence: {
      brief: "durable",
      prompts: "durable",
      task_status: "durable",
      live_conversation_state: "ephemeral"
    },
    policies: brief?.behavioralContract || []
  };

  const schema = {
    user_portrait: {
      summary: brief?.portrait?.summary || "",
      workstyle: brief?.portrait?.workstyle || [],
      ai_relationship: brief?.portrait?.aiRelationship || [],
      operational_needs: brief?.portrait?.operationalNeeds || []
    },
    symbolic_priors: payload.symbolic.arcana,
    behavioral_contract: brief?.behavioralContract || [],
    capabilities: brief?.capabilities || [],
    ui_recommendations: brief?.uiRecommendations || [],
    build_agents: brief?.buildAgents || []
  };

  const promptPack = [
    "SYSTEM PROMPT",
    "You are the primary assistant inside a personal AI harness shaped by Ἑυνοῦς.",
    "",
    "OPERATING CONTRACT",
    ...(brief?.behavioralContract || []).map((item) => `- ${item}`),
    "",
    "WORKSTYLE",
    ...((brief?.portrait?.workstyle || []).map((item) => `- ${item}`)),
    "",
    "CAPABILITIES TO EMPHASIZE",
    ...((brief?.capabilities || []).slice(0, 8).map((item) => `- ${item}`))
  ].join("\n");

  const scaffold = [
    "app/",
    "  index.html            # workbench shell",
    "  src/foundry.js        # intake compiler UI",
    "  src/brief-render.js   # brief and hypothesis rendering",
    "  src/tarot.js          # symbolic card and image flow",
    "  src/workbench.js      # primary operator surface",
    "  src/history-ledger.js # resumable state and branch history",
    "api/",
    "  server.mjs            # provider routing and foundry endpoints",
    "  prompt-pack.json      # exported system and agent contracts",
    "  personal-brief.json   # compiled brief artifact",
    "  tool-manifest.json    # generated tool contract",
    "",
    "Example personal-brief.json excerpt:",
    JSON.stringify(schema, null, 2)
  ].join("\n");

  const commandSurface = [
    "generated CLI surface",
    "---------------------",
    "tool intake          # update intake and traces",
    "tool brief           # inspect compiled PersonalBrief",
    "tool review          # inspect hypotheses and contradictions",
    "tool route           # emit routed work packets",
    "tool tarot           # render symbolic assets",
    "tool resume          # reopen the ledger at the latest checkpoint",
    "",
    "primary workflow",
    "----------------",
    "1. compile intake into brief",
    "2. review hypotheses and contradictions",
    "3. route bounded tasks by agent tier",
    "4. checkpoint outputs into the ledger",
    "5. resume safely under quota pressure"
  ].join("\n");

  return {
    brief,
    schemaText: JSON.stringify(schema, null, 2),
    promptPackText: promptPack,
    scaffoldText: scaffold,
    toolManifestText: JSON.stringify(toolManifest, null, 2),
    commandSurfaceText: commandSurface
  };
}

function renderPipelineGallery() {
  const variants = shuffle([...gallerySeeds]).slice(0, 3).map(emulatePipelineProduct);
  galleryEl.innerHTML = variants.map(renderGalleryCard).join("");
}

function seedTarotPreview() {
  const card = tarotCardSelect.value;
  const motif = tarotMotifInput.value.trim();
  tarotPrompt.textContent = localTarotPrompt(card, motif);
  tarotImage.src = localTarotFallback(card, motif);
  tarotStatus.textContent = "Ready. Generate to use the relay or free fallback image path.";
}

async function generateTarotImage() {
  const card = tarotCardSelect.value;
  const motif = tarotMotifInput.value.trim();
  const prompt = localTarotPrompt(card, motif);
  tarotStatus.textContent = "Generating tarot image…";
  tarotPrompt.textContent = prompt;
  pulseButton(generateTarotBtn);

  try {
    const result = await apiJson("/api/tarot-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ card, motif })
    });
    tarotImage.src = result.imageDataUrl;
    tarotPrompt.textContent = result.prompt || prompt;
    tarotStatus.textContent = `Generated via ${result.provider}${result.warnings?.length ? " with fallback note" : ""}.`;
  } catch (error) {
    try {
      tarotStatus.textContent = "API unavailable. Falling back to Pollinations.ai…";
      const pollinationsUrl = pollinationsTarotUrl(prompt);
      await preloadImage(pollinationsUrl, 45000);
      tarotImage.src = pollinationsUrl;
      tarotPrompt.textContent = prompt;
      tarotStatus.textContent = "Generated via Pollinations.ai (free, unauthenticated fallback).";
    } catch (fallbackError) {
      tarotImage.src = localTarotFallback(card, motif);
      tarotPrompt.textContent = prompt;
      tarotStatus.textContent = `All remote image paths failed. Rendered local fallback instead: ${fallbackError.message}`;
    }
  }
}

function pollinationsTarotUrl(prompt) {
  return `${POLLINATIONS}${encodeURIComponent(prompt)}?width=512&height=768&nologo=true&seed=${Math.floor(Math.random() * 99999)}`;
}

function preloadImage(src, timeoutMs) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("timeout"));
    }, timeoutMs);

    img.onload = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(true);
    };

    img.onerror = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      reject(new Error("image failed"));
    };

    img.crossOrigin = "anonymous";
    img.src = src;
  });
}

function emulatePipelineProduct(seed) {
  const contract = [
    "keep uncertainty visible",
    seed.privacy.includes("strict") ? "ask before persistence" : "preserve explicit provenance",
    seed.autonomy === "high" ? "allow branching agents but require merge checkpoints" : "keep execution close to user confirmation"
  ];

  const selfCorrection = seed.autonomy === "high"
    ? "Initial draft over-indexed on autonomy. Corrected by introducing merge gates and explicit review surfaces."
    : "Initial draft was too cautious. Corrected by allowing best-effort synthesis before asking clarifiers.";

  const ui = seed.style === "dense and inspectable"
    ? "workbench panels, branch history, evidence drawers"
    : seed.style === "plural and branchable"
      ? "compare-and-merge views, role panes, routing graph"
      : seed.style === "compressed and decisive"
        ? "minimal dashboard, hard scope controls, terse outputs"
        : "calm split view, evidence rails, memory controls";

  const output = {
    title: seed.title,
    arcana: seed.arcana,
    posture: `${seed.style}; privacy: ${seed.privacy}; autonomy: ${seed.autonomy}`,
    summary: `Compiled brief centers a ${seed.style} harness shaped by ${seed.arcana.join(" + ")}. The system privileges ${ui} and treats the first artifact as a revisable PersonalBrief, not a finished bespoke operating system.`,
    hypotheses: [
      `User likely values ${seed.style} collaboration more than generic chat polish.`,
      `User likely needs ${seed.privacy} because trust depends on inspectable boundaries.`
    ],
    contract,
    selfCorrection,
    contradiction: seed.contradiction
  };

  return output;
}

function localTarotPrompt(card, motif) {
  return `${card}, tarot card illustration, ${motif}, ornate vertical composition, symbolic archetype, warm bark and ash palette, woodgrain textures, subtle ember light, high detail, no text, no watermark, no logo`;
}

function localTarotFallback(card, motif) {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="768" height="1152" viewBox="0 0 768 1152">
    <defs>
      <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="#233d32"/>
        <stop offset="52%" stop-color="#4b2e2a"/>
        <stop offset="100%" stop-color="#8a5a44"/>
      </linearGradient>
      <radialGradient id="ember" cx="50%" cy="42%" r="26%">
        <stop offset="0%" stop-color="#fff4e2"/>
        <stop offset="30%" stop-color="#ffc15c"/>
        <stop offset="65%" stop-color="#ff8740"/>
        <stop offset="100%" stop-color="rgba(179,63,43,0)"/>
      </radialGradient>
    </defs>
    <rect width="768" height="1152" rx="40" fill="url(#bg)"/>
    <rect x="28" y="28" width="712" height="1096" rx="30" fill="none" stroke="#f5e9d3" stroke-opacity="0.52" stroke-width="2"/>
    <circle cx="384" cy="396" r="150" fill="rgba(255,244,226,0.05)" stroke="#f5e9d3" stroke-opacity="0.14"/>
    <circle cx="384" cy="396" r="102" fill="url(#ember)"/>
    <path d="M150 618 C250 548 316 716 384 628 C446 548 524 704 622 620" fill="none" stroke="#f5e9d3" stroke-opacity="0.48" stroke-width="4" stroke-linecap="round"/>
    <path d="M174 696 C262 638 324 780 384 712 C446 640 508 772 596 704" fill="none" stroke="#f5e9d3" stroke-opacity="0.28" stroke-width="2.5" stroke-linecap="round"/>
    <text x="384" y="136" text-anchor="middle" font-family="Georgia, serif" font-size="54" fill="#fff4e2">${escapeXml(card)}</text>
    <text x="384" y="980" text-anchor="middle" font-family="Georgia, serif" font-size="22" fill="#f5e9d3" opacity="0.82">${escapeXml(motif)}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

function renderGalleryCard(product) {
  return `
    <article class="panel-card gallery-card">
      <span class="value-chip">Emulated product</span>
      <div class="gallery-card__meta">
        <strong>${escapeHtml(product.title)}</strong>
        <span>${escapeHtml(product.arcana.join(" · "))}</span>
      </div>
      <p class="gallery-card__quote">${escapeHtml(product.summary)}</p>
      <div class="pill-row">
        ${product.arcana.map((item) => `<span class="pill">${escapeHtml(item)}</span>`).join("")}
      </div>
      <div class="gallery-card__small"><strong>Posture:</strong> ${escapeHtml(product.posture)}</div>
      <div class="gallery-card__small"><strong>Contradiction surfaced:</strong> ${escapeHtml(product.contradiction)}</div>
      <div class="gallery-card__small"><strong>Self-correction:</strong> ${escapeHtml(product.selfCorrection)}</div>
      <div>
        <strong>Behavioral contract</strong>
        <ul class="brief-list">
          ${product.contract.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </div>
    </article>
  `;
}

function listItems(items) {
  const source = Array.isArray(items) && items.length ? items : ["No items returned."];
  return source.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function listHypotheses(items) {
  const source = Array.isArray(items) && items.length
    ? items
    : [{ claim: "No hypotheses yet.", confidence: "low", evidence: [] }];
  return source.map((item) => {
    const evidenceText = Array.isArray(item.evidence) && item.evidence.length
      ? ` Evidence: ${item.evidence.join("; ")}`
      : "";
    return `<li><strong>${escapeHtml(item.claim)}</strong> <span style="color:var(--color-charcoal)">(${escapeHtml(item.confidence || "unknown")})</span>${escapeHtml(evidenceText)}</li>`;
  }).join("");
}

function loadFoundrySample() {
  document.getElementById("devices").value = "Desktop, laptop, iPhone";
  document.getElementById("budget").value = "Will pay for strong reasoning if retries and fallback are explicit";
  document.getElementById("hosting").value = "Hybrid: GitHub Pages frontend, VPS API, optional local Ollama";
  document.getElementById("privacy").value = "Strict consent around memory; private traces by default";
  document.getElementById("primary-domains").value = "architecture design, orchestration, research synthesis, literary and language work";
  document.getElementById("collaboration-mode").value = "Orchestra conductor";
  document.getElementById("ambiguity-tolerance").value = "High: explore multiple interpretations freely";
  document.getElementById("preferred-outputs").value = "Dense workbench outputs, ontology graphs, nested briefs, compare and merge views, implementation roadmaps.";
  document.getElementById("pain-points").value = "Brittle assistants, missing continuity, low observability, shallow summaries, weak deployment paths.";
  document.getElementById("working-rhythm").value = "Long architecture sessions punctuated by quick captures. Wants the system to preserve momentum across interruptions.";
  document.getElementById("symbolic-motifs").value = "Foundry, archive, lantern, workshop, route maps, branch histories, rituals that still compile into hard parameters.";
  document.getElementById("trace-notes").value = "Repeatedly requests stronger structure, resilience, branching, observability, multilingual support, and non-generic interface language.";

  arcanaDeck.querySelectorAll(".arcana-card").forEach((button) => {
    button.classList.toggle("is-selected", ["Forge", "Lantern", "Archive", "Chorus"].includes(button.dataset.card));
  });

  compileStatus.textContent = "Foundry sample loaded.";
}

async function callHarnessChat(prompt) {
  const result = await apiJson("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      system: "You are Ἑυνοῦς, an AI harness foundry assistant. Respond with grounded, high-signal prose that reflects craft, continuity, and inspectability."
    })
  });

  return {
    provider: result.provider,
    output: result.output || "No output returned."
  };
}

async function apiJson(path, options) {
  const base = (apiBase || defaultApiBase()).replace(/\/$/, "");
  if (!base) throw new Error("API base is not configured");
  const response = await fetch(`${base}${path}`, options);
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(data.error || `${response.status} ${response.statusText}`);
  return data;
}

function valueOf(id) {
  return document.getElementById(id)?.value?.trim() || "";
}

function saveToken() {
  token = tokenInput.value.trim();
  if (!token) return showError("Token required");

  localStorage.setItem("gh_token", token);
  showError("");
  setupCopy.textContent = "Token stored locally. Refresh to pull live GitHub telemetry.";
  refresh();
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.style.display = message ? "block" : "none";
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
    renderDashboardPlaceholder("No token stored. Connect GitHub to load live telemetry.");
    updated.textContent = "Last updated: not yet loaded";
    return;
  }

  renderDashboardPlaceholder("Loading live GitHub telemetry…");
  setupCopy.textContent = "Reading API, Actions, repository, and storage state from GitHub.";
  showError("");

  try {
    const [rateLimit, user, repos, actions] = await Promise.all([
      gh("/rate_limit"),
      gh("/user"),
      gh(`/users/${USER}/repos?per_page=5&sort=updated`),
      fetchActionsUsage()
    ]);

    const cards = [];
    const resources = rateLimit.resources;
    const rateLimitMetrics = ["core", "search", "graphql", "code_search"]
      .map((key) => {
        const resource = resources[key];
        if (!resource) return null;
        const pct = resource.limit > 0 ? (resource.remaining / resource.limit) * 100 : 100;
        const resetTime = new Date(resource.reset * 1000).toLocaleTimeString();
        return metric(key, `${resource.remaining} / ${resource.limit}`, pct, `resets ${resetTime}`);
      })
      .filter(Boolean);

    cards.push(card("API Rate Limits", rateLimitMetrics));

    const plan = user.plan || {};
    const diskMB = ((user.disk_usage || 0) / 1024).toFixed(1);
    cards.push(card("Account", [
      metric("Plan", plan.name || "free", 100),
      metric("Public repos", `${user.public_repos}`, null),
      metric(
        "Private repos",
        `${user.total_private_repos || 0} / ${plan.private_repos || "∞"}`,
        plan.private_repos ? (user.total_private_repos / plan.private_repos) * 100 : 100
      ),
      metric("Disk usage", `${diskMB} MB`, null),
      metric("Collaborators", `${plan.collaborators || 0}`, null)
    ]));

    if (actions) {
      cards.push(card("Actions Minutes", [
        metric(
          "Total used",
          `${actions.total_minutes_used} min`,
          actions.included_minutes > 0 ? (actions.total_minutes_used / actions.included_minutes) * 100 : null
        ),
        metric("Included", `${actions.included_minutes} min`, 100),
        metric("Paid overage", `$${actions.total_paid_minutes_used || 0}`, null),
        ...Object.entries(actions.minutes_used_breakdown || {}).map(([os, mins]) =>
          metric(os, `${mins} min`, null)
        )
      ]));
    }

    cards.push(card("Storage", [
      metric(
        "Actions artifacts",
        actions ? `${(actions.total_paid_storage_used || 0).toFixed(1)} GB paid` : "N/A",
        null
      ),
      metric("Repo disk", `${diskMB} MB`, null)
    ]));

    const repoMetrics = repos.map((repo) => metric(repo.name, `pushed ${timeSince(new Date(repo.pushed_at))}`, null));
    cards.push(card("Recent Repos", repoMetrics));

    dashboard.innerHTML = cards.join("");
    updated.textContent = `Last updated: ${new Date().toLocaleString()}`;
  } catch (error) {
    renderDashboardPlaceholder("Failed to load live telemetry. Check the token and try again.");
    showError(`Failed: ${error.message}`);
    setupCopy.textContent = "The harness could not read GitHub telemetry with the current token.";
    updated.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
  }
}

async function fetchActionsUsage() {
  try {
    return await gh(`/users/${USER}/settings/billing/actions`);
  } catch {
    try {
      return await gh(`/orgs/${USER}/settings/billing/actions`);
    } catch {
      return null;
    }
  }
}

function renderDashboardPlaceholder(message) {
  dashboard.innerHTML = `<article class="card"><h2>Tooling pulse</h2><p class="status-line">${escapeHtml(message)}</p></article>`;
}

function metric(name, value, pct, subtitle) {
  const barColor = pct === null ? "" : pct > 70 ? "green" : pct > 30 ? "yellow" : "red";
  const statusClass = pct === null ? "" : pct > 70 ? "ok" : pct > 30 ? "warn" : "crit";

  return `
    <div class="metric">
      <span class="metric-name">
        ${escapeHtml(name)}
        ${subtitle ? `<br><span style="color:var(--color-charcoal);font-size:0.76rem">${escapeHtml(subtitle)}</span>` : ""}
      </span>
      <div class="metric-right">
        <span class="metric-value">${escapeHtml(value)}</span>
        ${pct !== null ? `
          <div class="bar-container">
            <div class="bar-fill ${barColor}" style="width:${Math.min(100, pct).toFixed(1)}%"></div>
          </div>
          <span class="status ${statusClass}"></span>
        ` : ""}
      </div>
    </div>
  `;
}

function card(title, metrics) {
  return `<article class="card"><h2>${escapeHtml(title)}</h2>${metrics.join("")}</article>`;
}

function timeSince(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  const intervals = [
    [31536000, "y"],
    [2592000, "mo"],
    [86400, "d"],
    [3600, "h"],
    [60, "m"]
  ];

  for (const [secs, label] of intervals) {
    const count = Math.floor(seconds / secs);
    if (count >= 1) return `${count}${label} ago`;
  }

  return "just now";
}

function buildArtifact(source) {
  const fragments = source
    .split(/[\n.;]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const focus = fragments[0] || "Unstructured input";
  const risks = fragments
    .filter((item) => /risk|flaky|unclear|missing|outdated|half|no /i.test(item))
    .slice(0, 3);

  const priorities = fragments.slice(0, 3).map((item) => item.replace(/\s+/g, " "));
  const nextAction = risks[0] || priorities[1] || "Assign an owner and close the most visible uncertainty first.";

  return {
    focus,
    html: `
      <strong>Refined focus:</strong> ${escapeHtml(focus)}<br><br>
      <strong>Immediate shape:</strong> ${escapeHtml(priorities.join("; ") || source.slice(0, 180))}.<br><br>
      <strong>First cut:</strong> ${escapeHtml(nextAction)}<br><br>
      <strong>Residue worth keeping:</strong> one reusable artifact, one explicit owner map, and one next-pass checklist.
    `
  };
}

async function fakeAI(input) {
  await wait(REDUCED_MOTION ? 0 : 800);
  const response = heroSamples[Math.floor(Math.random() * heroSamples.length)];
  return `${response}<br><br><strong>Input grain:</strong> ${escapeHtml(input.slice(0, 140))}${input.length > 140 ? "…" : ""}`;
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}

function downloadTextFile(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

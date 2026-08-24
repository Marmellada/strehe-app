import fs from "node:fs";
import path from "node:path";
import { readEnv } from "../env.mjs";

export const ROUTER_CONFIG_FILENAMES = Object.freeze({
  models: "router.models.json",
  budget: "router.budget.json",
  ratecard: "router.ratecard.json",
});

export const DEFAULT_MODEL_CONFIG = Object.freeze({
  providers: {
    opencode: { base_url: "https://opencode.ai/zen/go/v1", enabled: true },
    codex: { cli: "codex", sandbox: "workspace-write", enabled: true },
    ollama: { enabled: false, note: "local inference is opt-in" },
  },
  models: {
    "opencode/kimi-k3": {
      tier: "escalation", max_ctx: 256000, enabled: true,
      protocol: "openai_chat_completions",
    },
    "opencode/kimi-k2.7-code": {
      tier: "coding", max_ctx: 128000, enabled: true,
      protocol: "openai_chat_completions",
    },
    "opencode/qwen3.7-plus": {
      tier: "routine", max_ctx: 128000, enabled: true,
      protocol: "anthropic_messages",
    },
    "opencode/minimax-m3": {
      tier: "routine", max_ctx: 128000, enabled: true,
      protocol: "anthropic_messages",
    },
    "opencode/deepseek-v4-pro": {
      tier: "coding", enabled: false,
      protocol: "openai_chat_completions",
      reason: "China-hosted models are intentionally disabled",
    },
    codex: { tier: "implementation", enabled: true, protocol: "codex_cli" },
  },
});

export const DEFAULT_BUDGET_CONFIG = Object.freeze({
  // Internal operator planning/safety ceilings only—not authoritative OpenCode provider limits.
  // USD safety ceilings are not provider-limit truth; token ceilings are separate, not dollar-equivalent.
  opencode: {
    rolling_5h: { max_tokens: 3000000, max_usd_estimate: 5.0 },
    rolling_7d: { max_tokens: 12000000, max_usd_estimate: 20.0 },
    rolling_30d: { max_tokens: 40000000, max_usd_estimate: 60.0 },
  },
  codex: {
    rolling_5h: { max_runs: 20 },
    rolling_7d: { max_runs: 80 },
    rolling_30d: { max_runs: 240 },
  },
  soft_threshold_pct: 80,
  hard_threshold_pct: 100,
});

export const DEFAULT_RATECARD_CONFIG = Object.freeze({
  currency: "USD",
  per_million_tokens: {
    "opencode/kimi-k3": { input: 0, output: 0 },
    "opencode/kimi-k2.7-code": { input: 0, output: 0 },
    "opencode/qwen3.7-plus": { input: 0, output: 0 },
    "opencode/minimax-m3": { input: 0, output: 0 },
  },
});

const SUPPORTED_PROTOCOLS = new Set([
  "openai_chat_completions",
  "anthropic_messages",
  "codex_cli",
  "ollama_chat",
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeObject(base, override) {
  if (!override || typeof override !== "object" || Array.isArray(override)) return clone(base);
  const result = clone(base);
  for (const [key, value] of Object.entries(override)) {
    if (value && typeof value === "object" && !Array.isArray(value)
      && result[key] && typeof result[key] === "object" && !Array.isArray(result[key])) {
      result[key] = mergeObject(result[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function readJsonIfPresent(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`invalid router config ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function validateModelConfig(config) {
  if (!config?.providers || !config?.models) throw new Error("router model config requires providers and models");
  for (const [handle, model] of Object.entries(config.models)) {
    if (!model || typeof model.enabled !== "boolean") throw new Error(`model ${handle} requires enabled:boolean`);
    if (!SUPPORTED_PROTOCOLS.has(model.protocol)) throw new Error(`model ${handle} has unsupported protocol: ${model.protocol}`);
    const provider = handle.includes("/") ? handle.split("/", 1)[0] : handle;
    if (!config.providers[provider]) throw new Error(`model ${handle} references unknown provider ${provider}`);
  }
  const deepseek = config.models["opencode/deepseek-v4-pro"];
  if (!deepseek || deepseek.enabled !== false) {
    throw new Error("opencode/deepseek-v4-pro must remain disabled");
  }
  return config;
}

export function validateBudgetConfig(config) {
  const windows = config?.opencode;
  for (const key of ["rolling_5h", "rolling_7d", "rolling_30d"]) {
    if (!windows?.[key] || !Number.isFinite(Number(windows[key].max_tokens))) {
      throw new Error(`router budget config requires opencode.${key}.max_tokens`);
    }
  }
  if (Object.hasOwn(windows, "rolling_24h")) {
    throw new Error("OpenCode budget uses rolling_5h, not rolling_24h");
  }
  return config;
}

export function loadRouterConfig(runtimeRoot, { configDir = path.join(runtimeRoot, "config") } = {}) {
  const models = mergeObject(
    DEFAULT_MODEL_CONFIG,
    readJsonIfPresent(path.join(configDir, ROUTER_CONFIG_FILENAMES.models)),
  );
  const budget = mergeObject(
    DEFAULT_BUDGET_CONFIG,
    readJsonIfPresent(path.join(configDir, ROUTER_CONFIG_FILENAMES.budget)),
  );
  const ratecard = mergeObject(
    DEFAULT_RATECARD_CONFIG,
    readJsonIfPresent(path.join(configDir, ROUTER_CONFIG_FILENAMES.ratecard)),
  );
  return {
    models: validateModelConfig(models),
    budget: validateBudgetConfig(budget),
    ratecard,
    configDir,
  };
}

export function loadRouterEnvironment(runtimeRoot, envFile) {
  const values = readEnv(envFile || path.join(runtimeRoot, ".env.gmk-router.local"));
  return {
    get(key) {
      return values.get(key) ?? process.env[key];
    },
  };
}

export function resolveModelConfig(config, handle) {
  const model = config?.models?.[handle];
  if (!model) throw new Error(`unknown model handle: ${handle}`);
  const providerName = handle.includes("/") ? handle.split("/", 1)[0] : handle;
  const provider = config.providers[providerName];
  if (!provider || provider.enabled !== true) throw new Error(`provider disabled: ${providerName}`);
  if (model.enabled !== true) throw new Error(`model disabled: ${handle}`);
  return { handle, providerName, provider, model };
}

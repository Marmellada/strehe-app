import { recordCoordinatorEvent } from "../ledger.mjs";

export const ROUTE_MATRIX = Object.freeze({
  "engineering.synthetic": ["opencode/minimax-m3", "opencode/qwen3.7-plus", "opencode/kimi-k2.7-code"],
  "inbox.triage": ["opencode/qwen3.7-plus", "opencode/minimax-m3", "opencode/kimi-k2.7-code"],
  "inbox.draft": ["opencode/kimi-k2.7-code", "opencode/kimi-k3"],
  "engineering.proactive": ["opencode/kimi-k2.7-code", "opencode/qwen3.7-plus", "opencode/kimi-k3"],
  "engineering.review": ["opencode/kimi-k2.7-code", "opencode/kimi-k3", "codex"],
  implementation: ["codex", "opencode/kimi-k2.7-code", "opencode/kimi-k3"],
  debugging: ["codex", "opencode/kimi-k3"],
  architecture: ["opencode/kimi-k3", "codex"],
});

function isEnabled(config, handle) {
  const model = config.models?.[handle];
  const providerName = handle.includes("/") ? handle.split("/", 1)[0] : handle;
  return model?.enabled === true && config.providers?.[providerName]?.enabled === true;
}

export function selectFirstEnabled(config, chain, { db } = {}) {
  for (const [index, handle] of chain.entries()) {
    if (isEnabled(config, handle)) {
      if (index > 0 && db) {
        recordCoordinatorEvent(db, "model_disabled_fallback", {
          disabled_models: chain.slice(0, index),
          selected_model: handle,
        });
      }
      return { handle, fallbackIndex: index, chain: [...chain] };
    }
  }
  const error = new Error(`no enabled model in route: ${chain.join(" -> ")}`);
  error.code = "no_enabled_route";
  throw error;
}

function routeKey(job, classification) {
  const payload = job?.payload && typeof job.payload === "object" ? job.payload : {};
  const text = `${payload.type || ""} ${payload.kind || ""} ${payload.task || ""}`.toLowerCase();
  if (classification.needsIndependentReview) {
    return payload.work_provider === "codex" ? "architecture" : "implementation";
  }
  if (classification.writesCode) return "implementation";
  if (/architect|root cause|escalat|ambiguous/.test(text)) return "architecture";
  if (/debug|refactor/.test(text) || classification.fileCount > 10 || classification.moduleCount >= 3) return "debugging";
  return String(job?.job_type || payload.type || "");
}

export function routeJob(job, classification, config, { db } = {}) {
  const payload = job?.payload && typeof job.payload === "object" ? job.payload : {};
  let chain;
  if (payload.route_hint === "opencode/deepseek-v4-pro") {
    chain = ["opencode/deepseek-v4-pro", "opencode/kimi-k2.7-code", "opencode/kimi-k3"];
  } else if (payload.route_hint === "codex") {
    chain = ["codex", "opencode/kimi-k2.7-code", "opencode/kimi-k3"];
  } else {
    const key = routeKey(job, classification);
    chain = ROUTE_MATRIX[key];
    if (!chain) {
      const error = new Error(`no route for job type: ${key || "unknown"}`);
      error.code = "unknown_route";
      throw error;
    }
  }

  if (classification.priorFailures >= 2 && chain[0]?.startsWith("opencode/")) {
    const floor = chain.indexOf("opencode/kimi-k2.7-code");
    if (floor > 0) chain = chain.slice(floor);
  }
  const selected = selectFirstEnabled(config, chain, { db });
  return {
    ...selected,
    taskType: classification.taskType,
    complexity: classification.complexity,
    riskClass: classification.riskClass,
    scopeFingerprint: classification.scopeFingerprint,
  };
}

const normalize = (file) => String(file || "").replace(/\\/g, "/").replace(/^\.\//, "");

export const EXECUTION_CLASS = Object.freeze({
  SAFE_READ_ONLY: "SAFE_READ_ONLY",
  LOCAL_INTEGRATION: "LOCAL_INTEGRATION",
  LIVE_INTEGRATION: "LIVE_INTEGRATION",
});

// Script execution authority is explicit. Baseline discovery must not infer
// safety from a filename such as test-* or verify-*.
export const SCRIPT_EXECUTION_REGISTRY = Object.freeze({
  "scripts/gmk-agent-worker/test-baseline-hardening.mjs": {
    executionClass: EXECUTION_CLASS.SAFE_READ_ONLY,
    reason: "Temporary SQLite and deterministic source-contract tests only.",
  },
  "scripts/gmk-agent-worker/test-go-ready.mjs": {
    executionClass: EXECUTION_CLASS.SAFE_READ_ONLY,
    reason: "Temporary/local readiness fixtures; no real job submission.",
  },
  "scripts/gmk-agent-worker/test-proactive.mjs": {
    executionClass: EXECUTION_CLASS.SAFE_READ_ONLY,
    reason: "Temporary SQLite and fake control-plane tests only.",
  },
  "scripts/gmk-agent-worker/test-review-reconciliation.mjs": {
    executionClass: EXECUTION_CLASS.SAFE_READ_ONLY,
    reason: "Temporary SQLite and fake reviewed-job reconciliation tests only.",
  },
  "scripts/gmk-agent-worker/test-router.mjs": {
    executionClass: EXECUTION_CLASS.SAFE_READ_ONLY,
    reason: "Pure routing and authority tests.",
  },
  "scripts/gmk-agent-worker/test-router-p3.mjs": {
    executionClass: EXECUTION_CLASS.SAFE_READ_ONLY,
    reason: "Temporary SQLite scheduling and budget tests.",
  },
  "scripts/gmk-agent-worker/test-router-p4.mjs": {
    executionClass: EXECUTION_CLASS.SAFE_READ_ONLY,
    reason: "Isolated fake Codex runner tests.",
  },
  "scripts/gmk-agent-worker/test-router-p5.mjs": {
    executionClass: EXECUTION_CLASS.SAFE_READ_ONLY,
    reason: "Local process-containment tests with fake children.",
  },
  "scripts/gmk-agent-worker/test-router-p6.mjs": {
    executionClass: EXECUTION_CLASS.SAFE_READ_ONLY,
    reason: "Temporary SQLite overnight-governance tests.",
  },
  "scripts/gmk-agent-worker/verify-change-aware.mjs": {
    executionClass: EXECUTION_CLASS.SAFE_READ_ONLY,
    reason: "Pure module-impact verification; no I/O beyond source imports.",
  },
  "scripts/verify-founding-funnel-local.mjs": {
    executionClass: EXECUTION_CLASS.LOCAL_INTEGRATION,
    reason: "Mutates reserved test rows in the local Supabase Docker database.",
  },
  "scripts/gmk-agent-worker/verify-agent-flow.mjs": {
    executionClass: EXECUTION_CLASS.LIVE_INTEGRATION,
    reason: "Reads service-role credentials, inserts agent_jobs, and spawns the real worker.",
  },
  "scripts/gmk-agent-worker/verify-resumability.mjs": {
    executionClass: EXECUTION_CLASS.LIVE_INTEGRATION,
    reason: "Uses service-role Supabase, writes the live runtime SQLite database, and spawns workers.",
  },
  "scripts/capture-manual-screenshots.mjs": {
    executionClass: EXECUTION_CLASS.LIVE_INTEGRATION,
    reason: "Reads .env.local service-role credentials and creates authenticated sessions against configured Supabase.",
  },
  "scripts/run-bathroom-base-shot-engine.mjs": {
    executionClass: EXECUTION_CLASS.LIVE_INTEGRATION,
    reason: "Operational artifact writer with an optional OpenAI vision call when credentials exist.",
  },
});

export function getScriptExecutionMetadata(file) {
  return SCRIPT_EXECUTION_REGISTRY[normalize(file)] || null;
}

export function requireScriptExecutionMetadata(file) {
  const normalized = normalize(file);
  const metadata = getScriptExecutionMetadata(normalized);
  if (!metadata) throw new Error(`script execution classification missing: ${normalized}`);
  return { file: normalized, ...metadata };
}

export function isSafeReadOnlyScript(file) {
  return requireScriptExecutionMetadata(file).executionClass === EXECUTION_CLASS.SAFE_READ_ONLY;
}

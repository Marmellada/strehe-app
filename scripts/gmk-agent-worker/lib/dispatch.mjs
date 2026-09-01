import { routeJob } from "./router/route.mjs";
import { recordCoordinatorEvent, recordJobLifecycle } from "./ledger.mjs";

export const DISPATCH_KIND = Object.freeze({
  MODEL: "model",
  DETERMINISTIC: "deterministic",
});

export const FINDING_LIFECYCLE_JOB_TYPE = "engineering.finding.lifecycle";

const FINDING_LIFECYCLES = new Set(["OPEN", "ACKNOWLEDGED", "DEFERRED", "RESOLVED"]);

export function assertFindingLifecyclePayload(job) {
  const payload = job?.payload && typeof job.payload === "object" ? job.payload : {};
  const findingId = Number(payload.finding_id);
  const lifecycle = String(payload.lifecycle || "").toUpperCase();
  if (!Number.isSafeInteger(findingId) || findingId <= 0) {
    const error = new Error("invalid finding lifecycle target");
    error.code = "invalid_finding_lifecycle_target";
    throw error;
  }
  if (!FINDING_LIFECYCLES.has(lifecycle)) {
    const error = new Error("invalid finding lifecycle");
    error.code = "invalid_finding_lifecycle";
    throw error;
  }
  return { findingId, lifecycle };
}

export function createDispatchPlan(job, classification, modelConfig, { db, routeJobImpl = routeJob } = {}) {
  if (job?.job_type === FINDING_LIFECYCLE_JOB_TYPE) {
    assertFindingLifecyclePayload(job);
    return {
      kind: DISPATCH_KIND.DETERMINISTIC,
      handle: null,
      provider: "deterministic",
      resourceClass: "light",
      processKind: "worker",
      wallClockMs: 5 * 60 * 1000,
      llmCallCeiling: 0,
      taskType: classification.taskType,
      complexity: "low",
      riskClass: classification.riskClass,
      scopeFingerprint: classification.scopeFingerprint,
    };
  }
  return {
    kind: DISPATCH_KIND.MODEL,
    ...routeJobImpl(job, classification, modelConfig, { db }),
  };
}

export function recordDispatchSelection(db, job, plan) {
  if (plan.kind === DISPATCH_KIND.DETERMINISTIC) {
    recordJobLifecycle(db, { jobId: job.id, state: "deterministic_dispatch_selected", modelHandle: null });
    recordCoordinatorEvent(db, "deterministic_dispatch_selected", {
      job_id: job.id,
      job_type: job.job_type,
      dispatch_kind: plan.kind,
      complexity: plan.complexity,
      risk_class: plan.riskClass,
    });
    return;
  }
  recordJobLifecycle(db, { jobId: job.id, state: "routed", modelHandle: plan.handle });
  recordCoordinatorEvent(db, "job_routed", {
    job_id: job.id,
    job_type: job.job_type,
    model_handle: plan.handle,
    complexity: plan.complexity,
    risk_class: plan.riskClass,
  });
}

export function assertDispatchMatchesJob(dispatchKind, job) {
  const deterministic = dispatchKind === DISPATCH_KIND.DETERMINISTIC;
  const lifecycle = job?.job_type === FINDING_LIFECYCLE_JOB_TYPE;
  if (deterministic !== lifecycle) {
    const error = new Error("dispatch kind does not match claimed job type");
    error.code = "dispatch_job_type_mismatch";
    throw error;
  }
  if (lifecycle) assertFindingLifecyclePayload(job);
  return true;
}

export function createDeterministicLlm() {
  return Object.freeze({
    provider: "deterministic",
    model: "none",
    protocol: "none",
    isExternal: false,
    setContext() {},
    async chat() {
      const error = new Error("LLM calls are forbidden for deterministic dispatch");
      error.code = "deterministic_llm_forbidden";
      throw error;
    },
  });
}

export function createWorkerLlm(dispatchKind, createModelLlm) {
  if (dispatchKind === DISPATCH_KIND.DETERMINISTIC) return createDeterministicLlm();
  if (dispatchKind !== DISPATCH_KIND.MODEL) throw new Error(`unknown dispatch kind: ${dispatchKind}`);
  if (typeof createModelLlm !== "function") throw new Error("model dispatch requires an LLM factory");
  return createModelLlm();
}

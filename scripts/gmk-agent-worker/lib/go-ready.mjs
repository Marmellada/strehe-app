import fs from "node:fs";
import path from "node:path";

import { readBudgetWindows, budgetMeteringHoldStateKey, budgetPauseStateKey } from "./budget.mjs";
import { assertSyntheticInboxFixture } from "./inbox/contract.mjs";
import { classifyJob } from "./router/classify.mjs";
import { routeJob } from "./router/route.mjs";

export const GO_RESET_ROUTE = "opencode/kimi-k2.7-code";
export const GO_RESET_TASK_NAME = "STREHE Engineering Agent";
export const GO_RESET_JOB_ID = /^go-reset-inbox-draft-[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function assertOperatorPauseState(value) {
  if (value !== "unpaused") {
    const error = new Error(value === "paused"
      ? "operator_paused"
      : "operator_pause_state_unreadable (pass --operator-pause-state unpaused only after operator confirmation)");
    error.code = value === "paused" ? "operator_paused" : "operator_pause_state_unreadable";
    throw error;
  }
  return { readable: true, paused: false, source: "explicit_operator_attestation" };
}

export function controlledInboxJob(fixture, jobId = "go-reset-inbox-draft-deterministic") {
  return {
    id: jobId,
    job_type: "inbox.draft",
    workspace_type: "system",
    priority: 100,
    attempt_count: 0,
    requires_review: true,
    payload: { conversation_fixture: assertSyntheticInboxFixture(fixture) },
  };
}

export function inspectGoRoute(db, routerConfig, fixture) {
  const job = controlledInboxJob(fixture);
  const classification = classifyJob(job, { db });
  const route = routeJob(job, classification, routerConfig.models, { db });
  if (route.handle !== GO_RESET_ROUTE) {
    const error = new Error(`unexpected_go_route (${route.handle})`);
    error.code = "unexpected_go_route";
    throw error;
  }
  return { job, classification, route };
}

export function inspectOpenCodeBudget(db, budgetConfig, now = new Date()) {
  const windows = readBudgetWindows(db, "opencode", budgetConfig.opencode, now);
  const meteringHold = db.prepare("SELECT value FROM runtime_state WHERE key = ?")
    .get(budgetMeteringHoldStateKey("opencode"))?.value ?? null;
  const budgetPause = db.prepare("SELECT value FROM runtime_state WHERE key = ?")
    .get(budgetPauseStateKey("opencode"))?.value ?? null;
  if (meteringHold) {
    const error = new Error("opencode_metering_hold_active");
    error.code = "opencode_metering_hold_active";
    throw error;
  }
  if (budgetPause) {
    const error = new Error(`opencode_budget_pause_active (${budgetPause})`);
    error.code = "opencode_budget_pause_active";
    throw error;
  }
  if (Object.values(windows).some((window) => window.unknown_unmetered_calls > 0)) {
    const error = new Error("opencode_unmetered_usage_detected");
    error.code = "opencode_unmetered_usage_detected";
    throw error;
  }
  const hardThreshold = Number(budgetConfig.hard_threshold_pct);
  if (!Number.isFinite(hardThreshold)
    || Object.values(windows).some((window) => window.percent >= hardThreshold)) {
    const error = new Error("opencode_budget_hard_threshold");
    error.code = "opencode_budget_hard_threshold";
    throw error;
  }
  return { windows, metering_hold: false, budget_pause: false };
}

export function assertNoActiveRuntimeWork(db) {
  const reservations = db.prepare("SELECT COUNT(*) AS count FROM coordinator_reservations").get().count;
  const sessions = db.prepare("SELECT COUNT(*) AS count FROM overnight_sessions WHERE final_status IS NULL").get().count;
  if (Number(reservations) > 0) {
    const error = new Error(`active_execution_reservations (${reservations})`);
    error.code = "active_execution_reservations";
    throw error;
  }
  if (Number(sessions) > 0) {
    const error = new Error(`active_overnight_sessions (${sessions})`);
    error.code = "active_overnight_sessions";
    throw error;
  }
  return { reservations: 0, sessions: 0 };
}

export function assertControlledHarnessSource(worktreePath) {
  const file = path.join(worktreePath, "scripts", "gmk-agent-worker", "go-reset-inbox-draft.mjs");
  const source = fs.readFileSync(file, "utf8");
  for (const forbidden of [
    /@supabase\/supabase-js/,
    /createClient\s*\(/,
    /agent_jobs/,
    /sendMetaMessage/,
    /lib\/messaging\/send/,
    /sendReply\s*\(/,
  ]) {
    if (forbidden.test(source)) {
      const error = new Error(`controlled_harness_exposes_forbidden_capability (${forbidden})`);
      error.code = "controlled_harness_exposes_forbidden_capability";
      throw error;
    }
  }
  return { production_access: false, outbound_send: false };
}

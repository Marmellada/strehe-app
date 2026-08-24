import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { classifyJob } from "./router/classify.mjs";
import { routeJob } from "./router/route.mjs";
import { assertJobAuthority } from "./router/authority.mjs";
import { evaluateHealth } from "./health.mjs";
import { evaluateBudget } from "./budget.mjs";
import {
  probeProcessTreeLiveness,
  reconcileExecutionReservations,
  releaseExecution,
  reserveExecution,
} from "./scheduler.mjs";
import { recordCoordinatorEvent } from "./ledger.mjs";
import { redactSensitiveText } from "./redact.mjs";

export const OVERNIGHT_MODE_VERSION = "strehe-router-v1-p6";
export const DEFAULT_OVERNIGHT_LIMITS = Object.freeze({
  wallClockMs: 8 * 60 * 60 * 1000,
  cadenceMs: 60 * 1000,
  maxJobs: 40,
  identicalFailureLimit: 3,
});
export const OVERNIGHT_LIMIT_BOUNDS = Object.freeze({
  wallClockMs: { min: 60 * 1000, max: 8 * 60 * 60 * 1000 },
  cadenceMs: { min: 1000, max: 15 * 60 * 1000 },
  maxJobs: { min: 1, max: 100 },
  identicalFailureLimit: { min: 1, max: 3 },
});

const SESSION_BLOCKING_FAILURES = new Set([
  "authority_blocked", "budget_hard", "budget_paused", "budget_metering_fault",
  "budget_state_unavailable", "health_sampling_error", "health_low_disk",
  "health_low_memory", "health_high_cpu", "health_ollama_active",
  "concurrency_state_unavailable", "reservation_liveness_unknown",
  "reservation_process_unresolved", "watchdog_termination_unconfirmed",
  "worktree_dirty", "worktree_commit_changed", "push_protection_missing",
  "operator_paused", "operator_control_unavailable", "live_inbox_enabled",
  "outbound_messaging_enabled", "production_deploy_enabled",
]);

const SESSION_COLUMNS = new Set([
  "heartbeat_at", "ended_at", "current_commit", "operator_paused",
  "jobs_attempted", "jobs_succeeded", "jobs_blocked", "jobs_failed",
  "retry_count", "provider_usage_json", "codex_runs", "health_blocks",
  "budget_blocks", "last_completed_job", "current_job", "stop_reason",
  "final_status", "blocked_artifact", "summary_artifact", "owner_pid",
  "last_failure_signature", "identical_failure_count",
]);

function fail(code, message, detail = null) {
  const error = new Error(message);
  error.code = code;
  error.detail = detail;
  return error;
}

function boundedInteger(value, name, bounds, fallback) {
  const number = value == null ? fallback : Number(value);
  if (!Number.isInteger(number) || number < bounds.min || number > bounds.max) {
    throw fail("overnight_config_invalid", `${name} must be an integer from ${bounds.min} to ${bounds.max}`);
  }
  return number;
}

export function validateOvernightLimits(input = {}) {
  return {
    wallClockMs: boundedInteger(input.wallClockMs, "wallClockMs", OVERNIGHT_LIMIT_BOUNDS.wallClockMs, DEFAULT_OVERNIGHT_LIMITS.wallClockMs),
    cadenceMs: boundedInteger(input.cadenceMs, "cadenceMs", OVERNIGHT_LIMIT_BOUNDS.cadenceMs, DEFAULT_OVERNIGHT_LIMITS.cadenceMs),
    maxJobs: boundedInteger(input.maxJobs, "maxJobs", OVERNIGHT_LIMIT_BOUNDS.maxJobs, DEFAULT_OVERNIGHT_LIMITS.maxJobs),
    identicalFailureLimit: boundedInteger(
      input.identicalFailureLimit,
      "identicalFailureLimit",
      OVERNIGHT_LIMIT_BOUNDS.identicalFailureLimit,
      DEFAULT_OVERNIGHT_LIMITS.identicalFailureLimit,
    ),
  };
}

export function acquireOvernightSession(db, {
  startingCommit,
  ownerPid = process.pid,
  now = new Date(),
  sessionId = randomUUID(),
  probeLiveness = (pid) => probeProcessTreeLiveness(pid),
} = {}) {
  if (!startingCommit || !Number.isInteger(Number(ownerPid)) || Number(ownerPid) <= 0) {
    throw fail("overnight_session_invalid", "overnight session requires a starting commit and valid PID");
  }
  db.exec("BEGIN IMMEDIATE");
  try {
    const active = db.prepare("SELECT * FROM overnight_sessions WHERE final_status IS NULL").get();
    if (active) {
      const liveness = probeLiveness(active.owner_pid);
      if (liveness === "alive") throw fail("overnight_session_active", "another overnight coordinator is still alive");
      if (liveness !== "dead") throw fail("overnight_session_liveness_unknown", "previous overnight coordinator liveness is unknown");
      db.prepare(
        `UPDATE overnight_sessions
         SET owner_pid = ?, heartbeat_at = ?, current_commit = ?
         WHERE session_id = ? AND final_status IS NULL`,
      ).run(Number(ownerPid), now.toISOString(), String(startingCommit), active.session_id);
      db.exec("COMMIT");
      return { ...active, owner_pid: Number(ownerPid), heartbeat_at: now.toISOString(), recovered: true };
    }
    db.prepare(
      `INSERT INTO overnight_sessions
        (session_id, mode_version, owner_pid, started_at, heartbeat_at,
         starting_commit, current_commit)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      String(sessionId), OVERNIGHT_MODE_VERSION, Number(ownerPid), now.toISOString(),
      now.toISOString(), String(startingCommit), String(startingCommit),
    );
    db.exec("COMMIT");
    return db.prepare("SELECT * FROM overnight_sessions WHERE session_id = ?").get(String(sessionId));
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch {}
    throw error;
  }
}

export function updateOvernightSession(db, sessionId, changes) {
  const entries = Object.entries(changes || {}).filter(([key]) => SESSION_COLUMNS.has(key));
  if (!entries.length) return readOvernightSession(db, sessionId);
  const assignments = entries.map(([key]) => `${key} = ?`).join(", ");
  const values = entries.map(([, value]) => value == null ? null : value);
  const info = db.prepare(`UPDATE overnight_sessions SET ${assignments} WHERE session_id = ?`)
    .run(...values, String(sessionId));
  if (Number(info.changes) !== 1) throw fail("overnight_state_persist_failed", `overnight session not found: ${sessionId}`);
  return readOvernightSession(db, sessionId);
}

export function readOvernightSession(db, sessionId) {
  return db.prepare("SELECT * FROM overnight_sessions WHERE session_id = ?").get(String(sessionId)) || null;
}

function git(worktreePath, args, execImpl = execFileSync) {
  return String(execImpl("git", args, {
    cwd: worktreePath,
    encoding: "utf8",
    timeout: 30_000,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  }) || "").trim();
}

export function inspectWorktree(worktreePath, {
  expectedWorktree = worktreePath,
  expectedCommit = null,
  execImpl = execFileSync,
} = {}) {
  try {
    const expected = path.resolve(expectedWorktree);
    const top = path.resolve(git(worktreePath, ["rev-parse", "--show-toplevel"], execImpl));
    if (top.toLowerCase() !== expected.toLowerCase()) {
      return { allowed: false, reason: "worktree_identity_mismatch", expected, actual: top };
    }
    const commit = git(worktreePath, ["rev-parse", "HEAD"], execImpl);
    if (expectedCommit && commit !== expectedCommit) {
      return { allowed: false, reason: "worktree_commit_changed", expected_commit: expectedCommit, actual_commit: commit };
    }
    const status = git(worktreePath, ["status", "--porcelain", "--untracked-files=all"], execImpl);
    if (status) return { allowed: false, reason: "worktree_dirty" };
    let pushUrl = "";
    try { pushUrl = git(worktreePath, ["config", "--get", "remote.origin.pushurl"], execImpl); } catch {}
    if (!/^no-push:\/\/disabled-by-/i.test(pushUrl)) {
      return { allowed: false, reason: "push_protection_missing", push_url_configured: Boolean(pushUrl) };
    }
    return { allowed: true, reason: "worktree_safe", commit, push_protected: true };
  } catch (error) {
    return { allowed: false, reason: "worktree_state_unavailable", error: String(error?.message || error).slice(0, 500) };
  }
}

export function inspectCapabilityState(env = process.env, { inboxTools = [], inboxJobTypes = ["inbox.triage", "inbox.draft"] } = {}) {
  const enabled = (name) => /^(1|true|yes|enabled)$/i.test(String(env[name] || ""));
  if (enabled("GMK_INBOX_LIVE_ENABLED")) return { allowed: false, reason: "live_inbox_enabled" };
  if (enabled("GMK_OUTBOUND_MESSAGING_ENABLED")) return { allowed: false, reason: "outbound_messaging_enabled" };
  if (enabled("GMK_PRODUCTION_DEPLOY_ENABLED")) return { allowed: false, reason: "production_deploy_enabled" };
  if (!Array.isArray(inboxTools) || inboxTools.length !== 0) return { allowed: false, reason: "outbound_capability_exposed" };
  if (!Array.isArray(inboxJobTypes)
    || inboxJobTypes.some((jobType) => !["inbox.triage", "inbox.draft"].includes(jobType))) {
    return { allowed: false, reason: "live_inbox_capability_exposed" };
  }
  return { allowed: true, reason: "unattended_capabilities_safe", liveInbox: false, outboundMessaging: false };
}

const OVERNIGHT_ENGINEERING_JOB_TYPES = new Set([
  "engineering.review", "engineering.baseline", "engineering.proactive",
  "engineering.finding.lifecycle", "engineering.synthetic",
]);

export function assertOvernightJobAuthority(job) {
  const jobType = String(job?.job_type || "");
  if (jobType.startsWith("engineering.") && !OVERNIGHT_ENGINEERING_JOB_TYPES.has(jobType)) {
    throw fail("authority_blocked", `engineering job type is not reviewed for V1 overnight use: ${jobType}`);
  }
  if (!jobType.startsWith("engineering.") && !["inbox.triage", "inbox.draft"].includes(jobType)) {
    throw fail("authority_blocked", `agent job type is not authorized for V1 overnight use: ${jobType}`);
  }
  return assertJobAuthority(job);
}

function assertGate(gate) {
  if (gate?.allowed === true) return gate;
  throw fail(gate?.reason || "overnight_preflight_failed", gate?.reason || "overnight preflight failed", gate);
}

export async function runSyntheticCanary({
  db,
  runtimeRoot,
  routerConfig,
  sessionId,
  fakeWorker = async () => ({ ok: true, kind: "deterministic_fake" }),
  now = new Date(),
} = {}) {
  const job = {
    id: `overnight-canary-${sessionId}`,
    job_type: "engineering.synthetic",
    priority: 100,
    requires_review: false,
    workspace_type: "system",
    attempt_count: 0,
    payload: { type: "engineering.synthetic", synthetic: true },
  };
  const classification = classifyJob(job, { db });
  const route = routeJob(job, classification, routerConfig.models, { db });
  if (route.handle !== "opencode/minimax-m3") {
    throw fail("canary_route_invalid", `local canary resolved unexpected route ${route.handle}`);
  }
  assertOvernightJobAuthority(job);
  const reservation = reserveExecution(db, {
    jobId: job.id,
    resourceClass: "light",
    provider: "synthetic",
    processKind: "synthetic_fake",
    deadlineAt: new Date(now.getTime() + 60_000).toISOString(),
    now,
  });
  assertGate(reservation);
  let result;
  try {
    result = await fakeWorker({ job, classification, route });
    if (result?.ok !== true) throw fail("canary_fake_worker_failed", "deterministic fake worker did not succeed");
  } finally {
    if (!releaseExecution(db, job.id, { allowUnbound: true })) {
      throw fail("canary_reservation_release_failed", "synthetic canary capacity could not be released");
    }
  }
  const artifactDir = path.join(runtimeRoot, "state", "artifacts");
  fs.mkdirSync(artifactDir, { recursive: true });
  const artifact = path.join(artifactDir, `overnight-canary-${sessionId}.json`);
  fs.writeFileSync(artifact, `${JSON.stringify({
    schema_version: 1,
    session_id: sessionId,
    synthetic: true,
    cloud_calls: 0,
    production_access: false,
    route: route.handle,
    authority: "passed",
    reservation: "reserved_and_released",
    worker: result.kind || "deterministic_fake",
    completed_at: now.toISOString(),
  }, null, 2)}\n`, "utf8");
  return { allowed: true, reason: "synthetic_canary_passed", artifact, cloudCalls: 0, route: route.handle };
}

export async function runOvernightPreflight({
  db,
  runtimeRoot,
  worktreePath,
  expectedWorktree = worktreePath,
  expectedCommit,
  routerConfig,
  sessionId,
  requiredConfigFiles = [],
  credentialsPresent = () => true,
  readOperatorControl,
  reconcileCodex = async () => [],
  inspectCurrentJob = async () => ({ allowed: true, reason: "no_active_job" }),
  healthEvaluator = evaluateHealth,
  budgetEvaluator = evaluateBudget,
  reservationReconciler = reconcileExecutionReservations,
  capabilityInspector = inspectCapabilityState,
  worktreeInspector = inspectWorktree,
  runCanary = true,
  canaryWorker,
  now = new Date(),
} = {}) {
  const evidence = {};
  evidence.worktree = assertGate(worktreeInspector(worktreePath, { expectedWorktree, expectedCommit }));
  for (const relative of ["state", path.join("state", "artifacts"), "worktree"]) {
    const target = path.join(runtimeRoot, relative);
    if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
      throw fail("runtime_directory_missing", `required runtime directory is missing: ${relative}`);
    }
  }
  const quickCheck = db.prepare("PRAGMA quick_check").get();
  if (quickCheck?.quick_check !== "ok") throw fail("database_corrupt", "SQLite quick_check did not pass");
  evidence.database = { quick_check: "ok" };
  for (const fileName of requiredConfigFiles) {
    const target = path.join(routerConfig.configDir, fileName);
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
      throw fail("router_config_missing", `required router configuration is missing: ${fileName}`);
    }
  }
  if (credentialsPresent() !== true) throw fail("provider_credentials_missing", "required provider credentials are unavailable");
  evidence.configuration = { valid: true, credentials_present: true };
  evidence.capabilities = assertGate(capabilityInspector());
  evidence.health = assertGate(await healthEvaluator({ runtimeRoot, resourceClass: "heavy", rejectLocalInference: true }));
  evidence.budgets = {};
  for (const [provider, providerConfig] of Object.entries(routerConfig.models.providers)) {
    if (providerConfig.enabled !== true || !routerConfig.budget[provider]) continue;
    const budget = budgetEvaluator({
      db, provider, budgetConfig: routerConfig.budget,
      job: { id: `preflight-${sessionId}`, priority: 400 }, route: { handle: provider }, now,
    });
    if (budget.reason === "budget_soft" || budget.reason === "budget_soft_low_priority") {
      throw fail("budget_soft_preflight", `provider ${provider} is at the soft budget threshold`, budget);
    }
    evidence.budgets[provider] = assertGate(budget);
  }
  const orphanEvidence = await reconcileCodex();
  if (orphanEvidence.some((entry) => entry.action !== "released")) {
    throw fail("codex_orphan_unresolved", "Codex orphan state is unresolved", orphanEvidence);
  }
  evidence.reservations = assertGate(reservationReconciler(db, { now }));
  evidence.currentJob = assertGate(await inspectCurrentJob());
  const control = await readOperatorControl?.();
  if (!control || control.control_available !== true) throw fail("operator_control_unavailable", "operator control state cannot be read");
  if (control.paused === true) throw fail("operator_paused", "operator pause is active");
  evidence.operator = { readable: true, paused: false };
  if (runCanary) {
    evidence.canary = await runSyntheticCanary({
      db, runtimeRoot, routerConfig, sessionId, fakeWorker: canaryWorker, now,
    });
  }
  recordCoordinatorEvent(db, "overnight_preflight_passed", {
    session_id: sessionId,
    commit: evidence.worktree.commit,
    canary: evidence.canary?.reason || "not_run",
  });
  return { allowed: true, reason: "overnight_preflight_passed", evidence };
}

export async function dispatchOvernightChild({ readOperatorControl, spawnChild } = {}) {
  let control;
  try {
    control = await readOperatorControl?.();
  } catch {
    throw fail("operator_control_unavailable", "operator control state cannot be read immediately before dispatch");
  }
  if (!control || control.control_available !== true) {
    throw fail("operator_control_unavailable", "operator control state cannot be read immediately before dispatch");
  }
  if (control.paused === true) throw fail("operator_paused", "operator pause is active immediately before dispatch");
  return spawnChild();
}

function sessionArtifactPath(runtimeRoot, session, kind) {
  const day = String(session.started_at).slice(0, 10);
  const shortId = String(session.session_id).replace(/[^a-z0-9-]/gi, "").slice(0, 12);
  const name = kind === "blocked" ? `BLOCKED-${day}-${shortId}.md` : `OVERNIGHT-SUMMARY-${day}-${shortId}.md`;
  return path.join(runtimeRoot, "state", "artifacts", name);
}

export function writeOvernightArtifact(runtimeRoot, session, {
  kind,
  health = null,
  budget = null,
  reservation = null,
  processMayBeAlive = false,
  operatorAction = "Inspect local state before explicitly starting a new overnight session.",
  currentCommit = null,
  now = new Date(),
} = {}) {
  if (!['blocked', 'summary'].includes(kind)) throw fail("overnight_artifact_invalid", `invalid artifact kind: ${kind}`);
  const filePath = sessionArtifactPath(runtimeRoot, session, kind);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const durationMs = Math.max(0, now.getTime() - new Date(session.started_at).getTime());
  const lines = kind === "blocked" ? [
    "# STREHE Overnight Session BLOCKED", "",
    `- Session: ${redactSensitiveText(session.session_id)}`,
    `- Stop time: ${now.toISOString()}`,
    `- Stop reason / safety gate: ${redactSensitiveText(String(session.stop_reason || "unknown").split(":", 1)[0])}`,
    `- Current job: ${redactSensitiveText(session.current_job || "none")}`,
    `- Last completed job: ${redactSensitiveText(session.last_completed_job || "none")}`,
    `- Relevant model/provider usage: ${redactSensitiveText(session.provider_usage_json)}`,
    `- Health summary: ${redactSensitiveText(health ? JSON.stringify(health) : "not available")}`,
    `- Budget summary: ${redactSensitiveText(budget ? JSON.stringify(budget) : session.provider_usage_json)}`,
    `- Reservation/process status: ${redactSensitiveText(reservation ? JSON.stringify(reservation) : "not available")}`,
    `- Process may still be alive: ${processMayBeAlive ? "YES - do not duplicate dispatch" : "no process is known alive"}`,
    `- Operator action required: ${redactSensitiveText(operatorAction)}`,
    "- Not performed: no push, deployment, production migration, secret rotation, billing mutation, live Inbox read, or outbound message.",
    "", "Suggested inspection:", "```powershell",
    "node scripts/gmk-agent-worker/scripts/router-usage-report.mjs", "```", "",
  ] : [
    "# STREHE Overnight Session Summary", "",
    `- Session: ${redactSensitiveText(session.session_id)}`,
    `- Duration: ${Math.round(durationMs / 1000)} seconds`,
    `- Jobs attempted / succeeded / failed / blocked: ${session.jobs_attempted} / ${session.jobs_succeeded} / ${session.jobs_failed} / ${session.jobs_blocked}`,
    `- Models/providers used: ${redactSensitiveText(session.provider_usage_json)}`,
    `- Codex runs: ${session.codex_runs}`,
    `- Retry count: ${session.retry_count}`,
    `- Budget/usage summary: ${redactSensitiveText(session.provider_usage_json)}`,
    `- Starting/current commit: ${redactSensitiveText(session.starting_commit)} / ${redactSensitiveText(currentCommit || session.current_commit || "unknown")}`,
    `- Stop reason: ${redactSensitiveText(String(session.stop_reason || "unknown").split(":", 1)[0])}`,
    `- Last completed job: ${redactSensitiveText(session.last_completed_job || "none")}`,
    "- Awaiting human review: all completed work remains subject to the existing job review contract; nothing was pushed or deployed.",
    "- Important artifacts: local coordinator events, job lifecycle rows, and this summary.", "",
  ];
  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
  return filePath;
}

export async function runOvernightLoop({
  db,
  runtimeRoot,
  session,
  preflight,
  selectJob,
  dispatchJob,
  limits: inputLimits,
  now = () => new Date(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  shouldStop = () => false,
} = {}) {
  const limits = validateOvernightLimits(inputLimits);
  const startedMs = new Date(session.started_at).getTime();
  let state = readOvernightSession(db, session.session_id);
  let lastFailureSignature = state?.last_failure_signature ?? null;
  let identicalFailures = Number(state?.identical_failure_count ?? 0);
  let lastPreflight = null;
  const usage = JSON.parse(state.provider_usage_json || "{}");
  const persist = (changes) => {
    state = updateOvernightSession(db, state.session_id, { heartbeat_at: now().toISOString(), ...changes });
    return state;
  };
  const block = (error, detail = {}) => {
    const failureCode = String(error?.code || "overnight_invariant_failure");
    const mayStillBeAlive = detail.processMayBeAlive === true
      || ["watchdog_termination_unconfirmed", "reservation_liveness_unknown",
        "reservation_process_unresolved", "active_job_may_still_run",
        "codex_orphan_unresolved"].includes(failureCode);
    const reason = `${error?.code || "overnight_invariant_failure"}: session stopped at a fail-closed safety boundary`;
    persist({
      ended_at: now().toISOString(), stop_reason: reason, final_status: "BLOCKED",
      jobs_blocked: state.jobs_blocked + 1, current_job: state.current_job,
      operator_paused: error?.code === "operator_paused" ? 1 : state.operator_paused,
      health_blocks: String(error?.code || "").startsWith("health_") ? state.health_blocks + 1 : state.health_blocks,
      budget_blocks: String(error?.code || "").startsWith("budget_") ? state.budget_blocks + 1 : state.budget_blocks,
    });
    const artifact = writeOvernightArtifact(runtimeRoot, state, {
      kind: "blocked",
      health: detail.health || lastPreflight?.evidence?.health
        || (String(error?.code || "").startsWith("health_") ? error?.detail : null),
      budget: detail.budget || lastPreflight?.evidence?.budgets
        || (String(error?.code || "").startsWith("budget_") ? error?.detail : null),
      reservation: detail.reservation || lastPreflight?.evidence?.reservations
        || (failureCode.includes("reservation") || failureCode.includes("process") || failureCode.includes("orphan")
          ? error?.detail : null),
      processMayBeAlive: mayStillBeAlive,
      operatorAction: detail.operatorAction,
      now: now(),
    });
    persist({ blocked_artifact: artifact, owner_pid: null });
    recordCoordinatorEvent(db, "overnight_blocked", { session_id: state.session_id, reason: error?.code || "overnight_invariant_failure", artifact });
    return { status: "BLOCKED", session: state, artifact };
  };
  try {
    const validEmptyStreak = lastFailureSignature == null && identicalFailures === 0;
    const validActiveStreak = typeof lastFailureSignature === "string"
      && /^[a-z][a-z0-9_]{0,119}$/.test(lastFailureSignature)
      && Number.isInteger(identicalFailures) && identicalFailures > 0;
    if (!state || (!validEmptyStreak && !validActiveStreak)) {
      return block(fail("overnight_failure_state_invalid", "durable identical-failure state is unreadable or corrupt"));
    }
    if (identicalFailures >= limits.identicalFailureLimit) {
      return block(fail("identical_failure_limit", `${lastFailureSignature} reached ${identicalFailures} consecutive failures`));
    }
    lastPreflight = await preflight();
    while (true) {
      const currentNow = now();
      if (shouldStop()) throw fail("operator_stop", "explicit coordinator stop requested");
      if (currentNow.getTime() - startedMs >= limits.wallClockMs) {
        persist({ ended_at: currentNow.toISOString(), stop_reason: "wall_clock_limit", final_status: "COMPLETED", current_job: null, owner_pid: null });
        break;
      }
      if (state.jobs_attempted >= limits.maxJobs) {
        persist({ ended_at: currentNow.toISOString(), stop_reason: "job_count_limit", final_status: "COMPLETED", current_job: null, owner_pid: null });
        break;
      }
      lastPreflight = await preflight();
      const job = await selectJob();
      if (!job) {
        recordCoordinatorEvent(db, "overnight_idle_sleep", { session_id: state.session_id, cadence_ms: limits.cadenceMs });
        await sleep(limits.cadenceMs);
        continue;
      }
      persist({ current_job: String(job.id), jobs_attempted: state.jobs_attempted + 1 });
      let result;
      try {
        result = await dispatchJob(job);
      } catch (error) {
        result = SESSION_BLOCKING_FAILURES.has(error?.code)
          ? { status: "session_blocked", failureClass: error.code, detail: error.detail }
          : { status: "retryable_failure", failureClass: error?.code || "dispatch_failed", message: error?.message || String(error) };
      }
      if (result?.status === "succeeded") {
        const provider = String(result.provider || "unknown");
        const model = String(result.model || "unknown");
        usage[`${provider}/${model}`] = Number(usage[`${provider}/${model}`] || 0) + 1;
        persist({
          jobs_succeeded: state.jobs_succeeded + 1,
          last_completed_job: String(job.id), current_job: null,
          provider_usage_json: JSON.stringify(usage),
          codex_runs: state.codex_runs + (provider === "codex" ? 1 : 0),
          last_failure_signature: null, identical_failure_count: 0,
        });
        lastFailureSignature = null;
        identicalFailures = 0;
        continue;
      }
      if (result?.status === "session_blocked") {
        return block(fail(result.failureClass || "session_safety_failure", result.message || "session safety failure", result.detail), result);
      }
      const signature = String(result?.failureClass || "retryable_failure");
      if (!/^[a-z][a-z0-9_]{0,119}$/.test(signature)) {
        return block(fail("overnight_failure_state_invalid", "retryable failure class is not a bounded machine code"));
      }
      identicalFailures = signature === lastFailureSignature ? identicalFailures + 1 : 1;
      lastFailureSignature = signature;
      persist({
        jobs_failed: state.jobs_failed + 1, retry_count: state.retry_count + 1, current_job: null,
        last_failure_signature: lastFailureSignature, identical_failure_count: identicalFailures,
      });
      if (identicalFailures >= limits.identicalFailureLimit) {
        return block(fail("identical_failure_limit", `${signature} reached ${identicalFailures} consecutive failures`));
      }
    }
    const artifact = writeOvernightArtifact(runtimeRoot, state, { kind: "summary", now: now() });
    persist({ summary_artifact: artifact });
    recordCoordinatorEvent(db, "overnight_completed", { session_id: state.session_id, stop_reason: state.stop_reason, artifact });
    return { status: "COMPLETED", session: state, artifact };
  } catch (error) {
    return block(error);
  }
}

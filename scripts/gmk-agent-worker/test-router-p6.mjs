import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import inboxSpec from "./agents/inbox.spec.mjs";
import { recordLlmUsage, recordRoutingOutcome } from "./lib/ledger.mjs";
import { processNextJob } from "./lib/claim-loop.mjs";
import { assessHealthSample, shouldRejectLocalInference } from "./lib/health.mjs";
import {
  acquireOvernightSession,
  assertOvernightJobAuthority,
  dispatchOvernightChild,
  inspectCapabilityState,
  inspectWorktree,
  readOvernightSession,
  runOvernightLoop,
  runOvernightPreflight,
  runSyntheticCanary,
  updateOvernightSession,
  validateOvernightLimits,
  writeOvernightArtifact,
} from "./lib/overnight.mjs";
import { countRecentFailures, scopeFingerprint } from "./lib/router/classify.mjs";
import { DEFAULT_BUDGET_CONFIG, DEFAULT_MODEL_CONFIG } from "./lib/router/config.mjs";
import { reserveExecution } from "./lib/scheduler.mjs";
import { openDatabase } from "./lib/sqlite.mjs";

function tempRuntime(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "strehe-router-p6-test-"));
  const opened = openDatabase(root);
  t.after(() => {
    try { opened.db.close(); } catch {}
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  });
  return { root, ...opened };
}

function routerConfig(root) {
  return {
    models: JSON.parse(JSON.stringify(DEFAULT_MODEL_CONFIG)),
    budget: JSON.parse(JSON.stringify(DEFAULT_BUDGET_CONFIG)),
    ratecard: {},
    configDir: path.join(root, "config"),
  };
}

function preflightOptions(runtime, overrides = {}) {
  return {
    db: runtime.db,
    runtimeRoot: runtime.root,
    worktreePath: path.join(runtime.root, "worktree"),
    expectedCommit: "a".repeat(40),
    routerConfig: routerConfig(runtime.root),
    sessionId: overrides.sessionId || "session-p6",
    requiredConfigFiles: [],
    credentialsPresent: () => true,
    readOperatorControl: async () => ({ control_available: true, paused: false }),
    healthEvaluator: async () => ({ allowed: true, reason: "healthy", evidence: { synthetic: true } }),
    worktreeInspector: () => ({ allowed: true, reason: "worktree_safe", commit: "a".repeat(40) }),
    capabilityInspector: () => ({ allowed: true, reason: "safe" }),
    reservationReconciler: () => ({ allowed: true, reason: "reservations_reconciled", reservations: [] }),
    reconcileCodex: async () => [],
    inspectCurrentJob: async () => ({ allowed: true, reason: "no_active_job" }),
    ...overrides,
  };
}

function session(runtime, options = {}) {
  return acquireOvernightSession(runtime.db, {
    startingCommit: "a".repeat(40),
    ownerPid: options.ownerPid || 101,
    sessionId: options.sessionId || "session-p6",
    now: options.now || new Date("2026-08-24T20:00:00Z"),
    probeLiveness: options.probeLiveness || (() => "dead"),
  });
}

function queryResult(data, error = null) {
  const chain = {
    select: () => chain, eq: () => chain, lte: () => chain, gt: () => chain,
    order: () => chain, limit: () => chain,
    then: (resolve, reject) => Promise.resolve({ data, error }).then(resolve, reject),
  };
  return chain;
}

test("A. coordinator requires explicit --once or --overnight activation", () => {
  const result = spawnSync(process.execPath, [path.resolve("scripts/gmk-agent-worker/coordinator.mjs")], {
    cwd: process.cwd(), encoding: "utf8", windowsHide: true, timeout: 10_000,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /requires explicit --once or --overnight activation/);
  const source = fs.readFileSync(path.resolve("scripts/gmk-agent-worker/coordinator.mjs"), "utf8");
  assert.doesNotMatch(source, /schtasks|Task Scheduler|crontab|daemon install/i);
});

test("B-D. durable session lock is exclusive, recovers only dead owners, and rejects unknown liveness", (t) => {
  const runtime = tempRuntime(t);
  const first = session(runtime, { ownerPid: 101 });
  assert.equal(first.session_id, "session-p6");
  assert.throws(() => acquireOvernightSession(runtime.db, {
    startingCommit: "a".repeat(40), ownerPid: 202, probeLiveness: () => "alive",
  }), (error) => error.code === "overnight_session_active");
  assert.throws(() => acquireOvernightSession(runtime.db, {
    startingCommit: "a".repeat(40), ownerPid: 202, probeLiveness: () => "unknown",
  }), (error) => error.code === "overnight_session_liveness_unknown");
  const recovered = acquireOvernightSession(runtime.db, {
    startingCommit: "a".repeat(40), ownerPid: 202, probeLiveness: () => "dead",
  });
  assert.equal(recovered.session_id, first.session_id);
  assert.equal(recovered.owner_pid, 202);
  assert.equal(recovered.recovered, true);
});

test("E. clean deterministic preflight passes and persists a local no-cloud canary", async (t) => {
  const runtime = tempRuntime(t);
  const result = await runOvernightPreflight(preflightOptions(runtime));
  assert.equal(result.allowed, true);
  assert.equal(result.evidence.canary.cloudCalls, 0);
  assert.ok(fs.existsSync(result.evidence.canary.artifact));
});

test("F-G. actual git inspection rejects dirty worktrees and missing push protection", (t) => {
  const runtime = tempRuntime(t);
  const repo = path.join(runtime.root, "repo");
  fs.mkdirSync(repo);
  const runGit = (args) => execFileSync("git", args, { cwd: repo, stdio: "ignore", windowsHide: true });
  runGit(["init"]);
  runGit(["config", "user.email", "p6@example.invalid"]);
  runGit(["config", "user.name", "P6 Test"]);
  fs.writeFileSync(path.join(repo, "tracked.txt"), "clean\n");
  runGit(["add", "tracked.txt"]);
  runGit(["commit", "-m", "fixture"]);
  runGit(["remote", "add", "origin", "https://example.invalid/strehe.git"]);
  let gate = inspectWorktree(repo);
  assert.equal(gate.allowed, false);
  assert.equal(gate.reason, "push_protection_missing");
  runGit(["config", "remote.origin.pushurl", "no-push://disabled-by-p6-test"]);
  assert.equal(inspectWorktree(repo).allowed, true);
  fs.appendFileSync(path.join(repo, "tracked.txt"), "dirty\n");
  gate = inspectWorktree(repo);
  assert.equal(gate.allowed, false);
  assert.equal(gate.reason, "worktree_dirty");
});

test("H-I. health rejection and health sampling failure block preflight", async (t) => {
  const runtime = tempRuntime(t);
  for (const reason of ["health_low_memory", "health_sampling_error"]) {
    await assert.rejects(
      () => runOvernightPreflight(preflightOptions(runtime, {
        runCanary: false,
        healthEvaluator: async () => ({ allowed: false, reason }),
      })),
      (error) => error.code === reason,
    );
  }
});

test("J-K. hard budget and metering hold block before dispatch", async (t) => {
  const runtime = tempRuntime(t);
  recordLlmUsage(runtime.db, { provider: "opencode", model: "minimax-m3", inputTokens: 40_000_000, outputTokens: 0 });
  await assert.rejects(
    () => runOvernightPreflight(preflightOptions(runtime, { runCanary: false })),
    (error) => error.code === "budget_hard",
  );
  runtime.db.exec("DELETE FROM llm_usage_ledger; DELETE FROM runtime_state");
  recordLlmUsage(runtime.db, { provider: "opencode", model: "minimax-m3", costStatus: "unknown" });
  await assert.rejects(
    () => runOvernightPreflight(preflightOptions(runtime, { runCanary: false })),
    (error) => error.code === "budget_metering_fault",
  );
});

test("L-M. operator pause and unreadable operator controls fail closed", async (t) => {
  const runtime = tempRuntime(t);
  await assert.rejects(
    () => runOvernightPreflight(preflightOptions(runtime, {
      runCanary: false,
      readOperatorControl: async () => ({ control_available: true, paused: true }),
    })),
    (error) => error.code === "operator_paused",
  );
  await assert.rejects(
    () => runOvernightPreflight(preflightOptions(runtime, {
      runCanary: false,
      readOperatorControl: async () => ({ control_available: false, paused: false }),
    })),
    (error) => error.code === "operator_control_unavailable",
  );
});

test("dispatch-time operator recheck prevents spawn on a late pause or read failure and permits unpaused dispatch", async () => {
  let spawned = 0;
  const spawnChild = async () => { spawned += 1; return { ok: true }; };
  await assert.rejects(() => dispatchOvernightChild({
    readOperatorControl: async () => ({ control_available: true, paused: true }), spawnChild,
  }), (error) => error.code === "operator_paused");
  await assert.rejects(() => dispatchOvernightChild({
    readOperatorControl: async () => { throw new Error("control read failed"); }, spawnChild,
  }), (error) => error.code === "operator_control_unavailable");
  assert.equal(spawned, 0);
  assert.deepEqual(await dispatchOvernightChild({
    readOperatorControl: async () => ({ control_available: true, paused: false }), spawnChild,
  }), { ok: true });
  assert.equal(spawned, 1);
});

test("overnight child context rejects local inference while ordinary --once health semantics remain unchanged", () => {
  const sample = {
    freeMemoryBytes: 16 * 1024 ** 3, totalMemoryBytes: 32 * 1024 ** 3,
    cpuPercent: 1, freeDiskBytes: 10 * 1024 ** 3, processNames: ["ollama.exe"],
  };
  assert.equal(shouldRejectLocalInference({ overnight: false, env: { GMK_OVERNIGHT_SESSION_ID: "session-1" } }), true);
  assert.equal(assessHealthSample(sample, { rejectLocalInference: true }).reason, "health_ollama_active");
  assert.equal(shouldRejectLocalInference({ overnight: false, env: {} }), false);
  assert.equal(assessHealthSample(sample, { rejectLocalInference: false }).allowed, true);
});

test("classified worker failure writes routing_outcomes and countRecentFailures observes it", async (t) => {
  const runtime = tempRuntime(t);
  const job = {
    id: "failed-worker", job_type: "engineering.review", priority: 10,
    created_at: "2026-08-24T20:00:00Z", payload: { files: ["app/page.tsx"] },
  };
  const failedRpcs = [];
  const workerRuntime = {
    logger: { log: () => {} }, modelHandle: "opencode/kimi-k2.7-code",
    supabase: {
      from: () => queryResult([job]),
      async rpc(name) {
        if (name === "claim_agent_job") return { data: job, error: null };
        if (name === "fail_agent_job") failedRpcs.push(name);
        return { data: true, error: null };
      },
    },
    recordRoutingOutcome: (entry) => recordRoutingOutcome(runtime.db, entry),
  };
  const error = new Error("provider request failed");
  error.code = "provider_5xx";
  const processed = await processNextJob(workerRuntime, {
    capability: "engineering.local", leaseSeconds: 300, run: async () => { throw error; },
  });
  assert.equal(processed, true);
  assert.equal(workerRuntime.lastFailureClass, "provider_5xx");
  assert.equal(failedRpcs.length, 1);
  const row = runtime.db.prepare("SELECT * FROM routing_outcomes").get();
  assert.equal(row.outcome, "failed");
  assert.equal(row.failure_class, "provider_5xx");
  assert.equal(row.model, "opencode/kimi-k2.7-code");
  assert.equal(countRecentFailures(runtime.db, job.job_type, scopeFingerprint(job)), 1);
});

test("N. unresolved reservation/process state blocks preflight", async (t) => {
  const runtime = tempRuntime(t);
  await assert.rejects(
    () => runOvernightPreflight(preflightOptions(runtime, {
      runCanary: false,
      reservationReconciler: () => ({ allowed: false, reason: "reservation_liveness_unknown" }),
    })),
    (error) => error.code === "reservation_liveness_unknown",
  );
});

test("O. unconfirmed termination is session-blocking and retains a single morning artifact", async (t) => {
  const runtime = tempRuntime(t);
  const active = session(runtime);
  const result = await runOvernightLoop({
    db: runtime.db, runtimeRoot: runtime.root, session: active,
    preflight: async () => ({ allowed: true }),
    selectJob: async () => ({ id: "job-unconfirmed" }),
    dispatchJob: async () => ({
      status: "session_blocked", failureClass: "watchdog_termination_unconfirmed", processMayBeAlive: true,
    }),
    limits: { maxJobs: 1 },
  });
  assert.equal(result.status, "BLOCKED");
  assert.match(fs.readFileSync(result.artifact, "utf8"), /Process may still be alive: YES/);
});

test("P-Q. synthetic canary classifies, routes, authorizes, reserves, writes artifacts, and makes no cloud call", async (t) => {
  const runtime = tempRuntime(t);
  let fakeCalls = 0;
  const result = await runSyntheticCanary({
    db: runtime.db, runtimeRoot: runtime.root, routerConfig: routerConfig(runtime.root), sessionId: "canary",
    fakeWorker: async () => { fakeCalls += 1; return { ok: true, kind: "fake" }; },
  });
  assert.equal(fakeCalls, 1);
  assert.equal(result.route, "opencode/minimax-m3");
  assert.equal(result.cloudCalls, 0);
  assert.equal(runtime.db.prepare("SELECT COUNT(*) AS count FROM coordinator_reservations").get().count, 0);
  assert.equal(JSON.parse(fs.readFileSync(result.artifact, "utf8")).production_access, false);
});

test("R-S. overnight Inbox remains synthetic, send=false, human-reviewed, and rejects live-looking IDs", async () => {
  const fixture = JSON.parse(fs.readFileSync(path.resolve("tests/fixtures/inbox/k-english-inquiry.json"), "utf8"));
  const job = { id: "inbox-fixture", job_type: "inbox.draft", requires_review: true, payload: { conversation_fixture: fixture } };
  assert.equal(assertOvernightJobAuthority(job), true);
  const candidate = {
    schema_version: "strehe.inbox.result.v1", fixture_id: fixture.fixture_id,
    channel: fixture.channel, language: "en", intent: "services_inquiry",
    category: "services", urgency: "low", suggested_attention: "needs_reply",
    confidence: "high", summary: "Synthetic request prepared for operator review.",
    customer_needs: ["Service information"],
    draft_reply: "Thanks for contacting STREHE. Which property-care service would you like the operator to review?",
    send: false, requires_human_review: true, risk_flags: [], uncertainty_flags: [],
    decision_evidence: ["Synthetic fixture text only."],
  };
  const result = await inboxSpec.run({
    llm: { provider: "fake", model: "fake", protocol: "fake", isExternal: false, chat: async () => JSON.stringify(candidate) },
  }, job);
  assert.equal(result.send, false);
  assert.equal(result.requires_human_review, true);
  assert.throws(() => assertOvernightJobAuthority({
    job_type: "inbox.draft", requires_review: true,
    payload: { conversation_id: "123e4567-e89b-42d3-a456-426614174000" },
  }), (error) => error.code === "authority_blocked");
});

test("T. live Inbox, outbound messaging, or production deployment capability stops preflight", () => {
  for (const key of ["GMK_INBOX_LIVE_ENABLED", "GMK_OUTBOUND_MESSAGING_ENABLED", "GMK_PRODUCTION_DEPLOY_ENABLED"]) {
    const result = inspectCapabilityState({ [key]: "true" });
    assert.equal(result.allowed, false);
  }
  assert.equal(inspectCapabilityState({}).allowed, true);
  assert.equal(inspectCapabilityState({}, { inboxTools: ["send"], inboxJobTypes: ["inbox.draft"] }).reason, "outbound_capability_exposed");
  assert.equal(inspectCapabilityState({}, { inboxTools: [], inboxJobTypes: ["inbox.live"] }).reason, "live_inbox_capability_exposed");
});

test("U-V. no-job cadence sleeps without busy-spin and wall-clock limit ends normally", async (t) => {
  const runtime = tempRuntime(t);
  const active = session(runtime);
  let clock = new Date(active.started_at);
  let sleeps = 0;
  const result = await runOvernightLoop({
    db: runtime.db, runtimeRoot: runtime.root, session: active,
    preflight: async () => ({ allowed: true }), selectJob: async () => null,
    dispatchJob: async () => assert.fail("no dispatch expected"),
    limits: { wallClockMs: 60_000, cadenceMs: 10_000 }, now: () => new Date(clock),
    sleep: async (ms) => { sleeps += 1; clock = new Date(clock.getTime() + ms); },
  });
  assert.equal(result.status, "COMPLETED");
  assert.equal(result.session.stop_reason, "wall_clock_limit");
  assert.equal(sleeps, 6);
});

test("W. session job-count limit is finite and writes one summary", async (t) => {
  const runtime = tempRuntime(t);
  const active = session(runtime);
  let index = 0;
  const result = await runOvernightLoop({
    db: runtime.db, runtimeRoot: runtime.root, session: active,
    preflight: async () => ({ allowed: true }),
    selectJob: async () => ({ id: `job-${++index}` }),
    dispatchJob: async () => ({ status: "succeeded", provider: "opencode", model: "minimax-m3" }),
    limits: { maxJobs: 1 },
  });
  assert.equal(result.status, "COMPLETED");
  assert.equal(result.session.jobs_attempted, 1);
  assert.equal(result.session.stop_reason, "job_count_limit");
  assert.ok(fs.existsSync(result.artifact));
});

test("X. same failure class across different jobs reaches the systemic limit", async (t) => {
  const runtime = tempRuntime(t);
  const active = session(runtime);
  let index = 0;
  const result = await runOvernightLoop({
    db: runtime.db, runtimeRoot: runtime.root, session: active,
    preflight: async () => ({ allowed: true }), selectJob: async () => ({ id: `job-${++index}` }),
    dispatchJob: async () => ({ status: "retryable_failure", failureClass: "provider_5xx" }),
    limits: { identicalFailureLimit: 2 },
  });
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.session.jobs_attempted, 2);
  assert.equal(result.session.retry_count, 2);
  assert.match(result.session.stop_reason, /identical_failure_limit/);
});

test("different failure classes do not combine into one systemic streak", async (t) => {
  const runtime = tempRuntime(t);
  const active = session(runtime);
  const classes = ["provider_5xx", "schema_invalid"];
  let index = 0;
  const result = await runOvernightLoop({
    db: runtime.db, runtimeRoot: runtime.root, session: active,
    preflight: async () => ({ allowed: true }), selectJob: async () => ({ id: `job-${index}` }),
    dispatchJob: async () => ({ status: "retryable_failure", failureClass: classes[index++] }),
    limits: { identicalFailureLimit: 2, maxJobs: 2 },
  });
  assert.equal(result.status, "COMPLETED");
  assert.equal(result.session.identical_failure_count, 1);
  assert.equal(result.session.last_failure_signature, "schema_invalid");
});

test("successful work resets the consecutive failure streak", async (t) => {
  const runtime = tempRuntime(t);
  const active = session(runtime);
  const outcomes = [
    { status: "retryable_failure", failureClass: "provider_5xx" },
    { status: "succeeded", provider: "opencode", model: "minimax-m3" },
    { status: "retryable_failure", failureClass: "provider_5xx" },
  ];
  let index = 0;
  const result = await runOvernightLoop({
    db: runtime.db, runtimeRoot: runtime.root, session: active,
    preflight: async () => ({ allowed: true }), selectJob: async () => ({ id: `job-${index}` }),
    dispatchJob: async () => outcomes[index++],
    limits: { identicalFailureLimit: 2, maxJobs: 3 },
  });
  assert.equal(result.status, "COMPLETED");
  assert.equal(result.session.identical_failure_count, 1);
  assert.equal(result.session.last_failure_signature, "provider_5xx");
});

test("durable failure streak reloads on coordinator restart without double increment", async (t) => {
  const runtime = tempRuntime(t);
  session(runtime, { ownerPid: 101 });
  updateOvernightSession(runtime.db, "session-p6", {
    jobs_attempted: 1, jobs_failed: 1, retry_count: 1,
    last_failure_signature: "provider_5xx", identical_failure_count: 1,
  });
  const recovered = acquireOvernightSession(runtime.db, {
    startingCommit: "a".repeat(40), ownerPid: 202, probeLiveness: () => "dead",
  });
  assert.equal(recovered.identical_failure_count, 1);
  const result = await runOvernightLoop({
    db: runtime.db, runtimeRoot: runtime.root, session: recovered,
    preflight: async () => ({ allowed: true }), selectJob: async () => ({ id: "different-job" }),
    dispatchJob: async () => ({ status: "retryable_failure", failureClass: "provider_5xx" }),
    limits: { identicalFailureLimit: 2 },
  });
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.session.identical_failure_count, 2);
  assert.match(result.session.stop_reason, /identical_failure_limit/);
});

test("corrupt durable failure streak fails closed instead of silently clearing", async (t) => {
  const runtime = tempRuntime(t);
  const active = session(runtime);
  runtime.db.prepare(
    "UPDATE overnight_sessions SET last_failure_signature = ?, identical_failure_count = ? WHERE session_id = ?",
  ).run("provider_5xx", "not-a-count", active.session_id);
  let dispatched = false;
  const result = await runOvernightLoop({
    db: runtime.db, runtimeRoot: runtime.root, session: active,
    preflight: async () => ({ allowed: true }), selectJob: async () => ({ id: "job" }),
    dispatchJob: async () => { dispatched = true; return { status: "succeeded" }; },
  });
  assert.equal(result.status, "BLOCKED");
  assert.equal(dispatched, false);
  assert.match(result.session.stop_reason, /overnight_failure_state_invalid/);
});

test("Y. restart with a possibly active durable job blocks before duplicate dispatch", async (t) => {
  const runtime = tempRuntime(t);
  session(runtime);
  updateOvernightSession(runtime.db, "session-p6", { current_job: "active-job" });
  const recovered = acquireOvernightSession(runtime.db, {
    startingCommit: "a".repeat(40), ownerPid: 202, probeLiveness: () => "dead",
  });
  let dispatched = false;
  const result = await runOvernightLoop({
    db: runtime.db, runtimeRoot: runtime.root, session: recovered,
    preflight: () => runOvernightPreflight(preflightOptions(runtime, {
      sessionId: recovered.session_id, runCanary: false,
      inspectCurrentJob: async () => ({ allowed: false, reason: "active_job_may_still_run" }),
    })),
    selectJob: async () => ({ id: "active-job" }),
    dispatchJob: async () => { dispatched = true; return { status: "succeeded" }; },
  });
  assert.equal(result.status, "BLOCKED");
  assert.equal(dispatched, false);
});

test("Z-AC. summaries and blocked artifacts are single, idempotent, bounded, and secret/customer-data free", (t) => {
  const runtime = tempRuntime(t);
  session(runtime);
  updateOvernightSession(runtime.db, "session-p6", {
    stop_reason: "provider_credentials_missing: api_key=super-secret customer said raw-private-message",
    final_status: "BLOCKED", ended_at: "2026-08-24T21:00:00Z",
  });
  const state = readOvernightSession(runtime.db, "session-p6");
  const first = writeOvernightArtifact(runtime.root, state, { kind: "blocked" });
  const second = writeOvernightArtifact(runtime.root, state, { kind: "blocked" });
  assert.equal(first, second);
  const blockedFiles = fs.readdirSync(path.dirname(first)).filter((name) => name.startsWith("BLOCKED-"));
  assert.equal(blockedFiles.length, 1);
  const content = fs.readFileSync(first, "utf8");
  assert.doesNotMatch(content, /super-secret/);
  assert.doesNotMatch(content, /raw-private-message/);
  // Artifacts never receive or serialize job payload/customer conversation fields.
  assert.doesNotMatch(content, /conversation_fixture|messages|draft_reply/);
  const summary = writeOvernightArtifact(runtime.root, state, { kind: "summary" });
  assert.ok(fs.existsSync(summary));
});

test("AD. P6 exposes no push, deploy, migration, scheduler, live-read, or messaging implementation path", () => {
  const coordinator = fs.readFileSync(path.resolve("scripts/gmk-agent-worker/coordinator.mjs"), "utf8");
  const overnight = fs.readFileSync(path.resolve("scripts/gmk-agent-worker/lib/overnight.mjs"), "utf8");
  assert.doesNotMatch(coordinator, /sendMetaMessage|lib\/messaging\/send|supabase\s+db|vercel\s+deploy|schtasks|crontab/i);
  assert.doesNotMatch(overnight, /sendMetaMessage|lib\/messaging\/send|supabase\s+db|vercel\s+deploy|schtasks|crontab/i);
  assert.throws(() => assertOvernightJobAuthority({ job_type: "growth.recommend", payload: {} }), (error) => error.code === "authority_blocked");
  assert.throws(() => assertOvernightJobAuthority({ job_type: "engineering.deploy", payload: {} }), (error) => error.code === "authority_blocked");
});

test("overnight limit validation never accepts zero or accidental infinity", () => {
  assert.deepEqual(validateOvernightLimits({}).maxJobs, 40);
  for (const invalid of [
    { wallClockMs: 0 }, { cadenceMs: 0 }, { maxJobs: 0 }, { identicalFailureLimit: 0 },
    { wallClockMs: Infinity }, { maxJobs: 101 },
  ]) assert.throws(() => validateOvernightLimits(invalid), (error) => error.code === "overnight_config_invalid");
});

test("generic stale reservations are reclaimed only after positive dead liveness", (t) => {
  const runtime = tempRuntime(t);
  const deadlineAt = new Date(Date.now() + 60_000).toISOString();
  assert.equal(reserveExecution(runtime.db, {
    jobId: "reserved", resourceClass: "heavy", provider: "opencode", deadlineAt, ownerPid: 101,
  }).allowed, true);
  const source = fs.readFileSync(path.resolve("scripts/gmk-agent-worker/lib/scheduler.mjs"), "utf8");
  assert.match(source, /probeLiveness\(row\.owner_pid\) !== "dead"/);
});

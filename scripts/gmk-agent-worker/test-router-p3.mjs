import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  budgetMeteringHoldStateKey,
  evaluateBudget,
  budgetPauseStateKey,
  readBudgetWindows,
} from "./lib/budget.mjs";
import { recordBlockedCoordinator } from "./lib/blocked-artifact.mjs";
import { assessHealthSample, DEFAULT_HEALTH_LIMITS, evaluateHealth } from "./lib/health.mjs";
import { recordJobLifecycle, recordLlmUsage } from "./lib/ledger.mjs";
import { createOpenCodeAdapter } from "./lib/llm/opencode.mjs";
import {
  createCountingLlm,
  bindReservationWorker,
  releaseExecution,
  releaseExecutionAfterResult,
  reserveExecution,
  runBoundedProcess,
} from "./lib/scheduler.mjs";
import { getState, openDatabase } from "./lib/sqlite.mjs";

const GIB = 1024 ** 3;

function tempDatabase(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "strehe-router-p3-test-"));
  const opened = openDatabase(root);
  t.after(() => {
    try { opened.db.close(); } catch {}
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  });
  return { root, ...opened };
}

function healthySample(overrides = {}) {
  return {
    freeMemoryBytes: 8 * GIB,
    totalMemoryBytes: 32 * GIB,
    cpuPercent: 20,
    freeDiskBytes: 10 * GIB,
    processNames: [],
    ...overrides,
  };
}

function budgetConfig(maxTokens = 100) {
  return {
    opencode: {
      rolling_5h: { max_tokens: maxTokens, max_usd_estimate: 1000 },
      rolling_7d: { max_tokens: maxTokens, max_usd_estimate: 1000 },
      rolling_30d: { max_tokens: maxTokens, max_usd_estimate: 1000 },
    },
    soft_threshold_pct: 80,
    hard_threshold_pct: 100,
  };
}

function insertUsage(db, { tokens, createdAt, estimated = null, reported = null, status = "unknown" }) {
  db.prepare(
    `INSERT INTO llm_usage_ledger
      (provider, model, input_tokens, output_tokens, estimated_cost_usd,
       reported_cost_usd, cost_status, created_at)
     VALUES ('opencode', 'minimax-m3', ?, 0, ?, ?, ?, ?)`,
  ).run(tokens, estimated, reported, status, createdAt);
}

test("healthy GMK allows eligible heavy work", () => {
  const result = assessHealthSample(healthySample(), { resourceClass: "heavy" });
  assert.equal(result.allowed, true);
  assert.equal(result.reason, "healthy");
});

test("low physical memory blocks heavy work at the 6 GiB default", () => {
  const result = assessHealthSample(healthySample({ freeMemoryBytes: DEFAULT_HEALTH_LIMITS.heavyFreeMemoryBytes - 1 }), {
    resourceClass: "heavy",
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "health_low_memory");
  assert.equal(result.evidence.required_memory_bytes, 6 * GIB);
});

test("CPU at or above 75 percent blocks heavy work", () => {
  const result = assessHealthSample(healthySample({ cpuPercent: 75 }), { resourceClass: "heavy" });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "health_high_cpu");
});

test("health sampling error fails closed", async () => {
  const result = await evaluateHealth({
    runtimeRoot: os.tmpdir(),
    resourceClass: "heavy",
    samplers: { memory: () => { throw new Error("sample unavailable"); } },
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "health_sampling_error");
  assert.match(result.evidence.error, /sample unavailable/);
});

test("Ollama-active overnight health policy blocks without killing it", () => {
  const result = assessHealthSample(healthySample({ processNames: ["ollama.exe", "explorer.exe"] }), {
    resourceClass: "heavy",
    rejectLocalInference: true,
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "health_ollama_active");
  assert.deepEqual(result.evidence.active_processes, ["ollama.exe"]);
});

test("one-heavy-job concurrency limit never permits overlap", (t) => {
  const { db } = tempDatabase(t);
  const deadlineAt = new Date(Date.now() + 60000).toISOString();
  assert.equal(reserveExecution(db, { jobId: "heavy-1", resourceClass: "heavy", provider: "opencode", deadlineAt }).allowed, true);
  const second = reserveExecution(db, { jobId: "heavy-2", resourceClass: "heavy", provider: "opencode", deadlineAt });
  assert.equal(second.allowed, false);
  assert.equal(second.reason, "concurrency_heavy_limit");
  assert.equal(releaseExecution(db, "heavy-1", { allowUnbound: true }), true);
});

test("two-light-job default limit blocks a third", (t) => {
  const { db } = tempDatabase(t);
  const deadlineAt = new Date(Date.now() + 60000).toISOString();
  assert.equal(reserveExecution(db, { jobId: "light-1", resourceClass: "light", provider: "opencode", deadlineAt }).allowed, true);
  assert.equal(reserveExecution(db, { jobId: "light-2", resourceClass: "light", provider: "opencode", deadlineAt }).allowed, true);
  const third = reserveExecution(db, { jobId: "light-3", resourceClass: "light", provider: "opencode", deadlineAt });
  assert.equal(third.allowed, false);
  assert.equal(third.reason, "concurrency_total_limit");
});

test("Codex reservation is future-compatible and counts as heavy", (t) => {
  const { db } = tempDatabase(t);
  const deadlineAt = new Date(Date.now() + 60000).toISOString();
  assert.equal(reserveExecution(db, {
    jobId: "codex-1", resourceClass: "heavy", provider: "codex", processKind: "codex", deadlineAt,
  }).allowed, true);
  const heavy = reserveExecution(db, { jobId: "heavy-1", resourceClass: "heavy", provider: "opencode", deadlineAt });
  assert.equal(heavy.allowed, false);
  assert.equal(heavy.reason, "concurrency_heavy_limit");
});

test("concurrency state failure fails closed", (t) => {
  const { db } = tempDatabase(t);
  db.close();
  const result = reserveExecution(db, {
    jobId: "job", resourceClass: "heavy", provider: "opencode", deadlineAt: new Date(Date.now() + 1000).toISOString(),
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "concurrency_state_unavailable");
});

test("budget soft threshold holds low-priority work but permits high-priority work", (t) => {
  const { db } = tempDatabase(t);
  recordLlmUsage(db, { provider: "opencode", model: "minimax-m3", inputTokens: 80, outputTokens: 0 });
  const config = budgetConfig();
  const low = evaluateBudget({ db, provider: "opencode", budgetConfig: config, job: { id: "low", priority: 400 }, route: { handle: "opencode/minimax-m3" } });
  assert.equal(low.allowed, false);
  assert.equal(low.reason, "budget_soft_low_priority");
  const high = evaluateBudget({ db, provider: "opencode", budgetConfig: config, job: { id: "high", priority: 100 }, route: { handle: "opencode/minimax-m3" } });
  assert.equal(high.allowed, true);
  assert.equal(high.costPressure, "soft");
});

test("budget hard threshold creates only local coordinator pause state", (t) => {
  const { db } = tempDatabase(t);
  recordLlmUsage(db, { provider: "opencode", model: "minimax-m3", inputTokens: 100, outputTokens: 0 });
  const result = evaluateBudget({ db, provider: "opencode", budgetConfig: budgetConfig(), job: { priority: 100 } });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "budget_hard");
  assert.match(getState(db, budgetPauseStateKey("opencode")), /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(getState(db, "operator_paused"), null);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM runtime_state").get().count, 1);
});

test("local budget pause auto-resumes only after every window drains below soft", (t) => {
  const { db } = tempDatabase(t);
  const config = budgetConfig();
  const now = new Date("2026-08-24T12:00:00Z");
  insertUsage(db, { tokens: 100, createdAt: now.toISOString() });
  assert.equal(evaluateBudget({ db, provider: "opencode", budgetConfig: config, now, job: { priority: 100 } }).reason, "budget_hard");
  const drained = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000);
  const resumed = evaluateBudget({ db, provider: "opencode", budgetConfig: config, now: drained, job: { priority: 100 } });
  assert.equal(resumed.allowed, true);
  assert.equal(getState(db, budgetPauseStateKey("opencode")), null);
  assert.equal(db.prepare("SELECT event FROM coordinator_events ORDER BY id DESC LIMIT 1").get().event, "budget_resumed");
});

test("rolling budget windows are exactly 5h, 7d, and 30d", (t) => {
  const { db } = tempDatabase(t);
  const now = new Date("2026-08-24T12:00:00Z");
  insertUsage(db, { tokens: 1, createdAt: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString() });
  insertUsage(db, { tokens: 10, createdAt: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString() });
  insertUsage(db, { tokens: 100, createdAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString() });
  insertUsage(db, { tokens: 1000, createdAt: new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000).toISOString() });
  const windows = readBudgetWindows(db, "opencode", budgetConfig(10000).opencode, now);
  assert.equal(windows.rolling_5h.tokens, 1);
  assert.equal(windows.rolling_7d.tokens, 11);
  assert.equal(windows.rolling_30d.tokens, 111);
});

test("reported cost takes precedence while estimated and unknown remain distinct", (t) => {
  const { db } = tempDatabase(t);
  const now = new Date("2026-08-24T12:00:00Z");
  insertUsage(db, { tokens: 1, createdAt: now.toISOString(), reported: 3, estimated: 99, status: "reported" });
  insertUsage(db, { tokens: 1, createdAt: now.toISOString(), estimated: 2, status: "estimated" });
  insertUsage(db, { tokens: 1, createdAt: now.toISOString(), estimated: 50, status: "unknown" });
  const window = readBudgetWindows(db, "opencode", budgetConfig(1000).opencode, now).rolling_5h;
  assert.equal(window.reported_usd, 3);
  assert.equal(window.estimated_usd, 2);
  assert.equal(window.unknown_cost_calls, 1);
});

test("provider-reported exact cost is stored separately from estimates", async (t) => {
  const { db } = tempDatabase(t);
  const adapter = createOpenCodeAdapter({
    apiKey: "test",
    baseUrl: "https://opencode.example/zen/go/v1",
    model: "kimi-k3",
    protocol: "openai_chat_completions",
    db,
    ratecard: { input: 99, output: 99 },
    fetchImpl: async () => new Response(JSON.stringify({
      choices: [{ message: { content: "ok" } }],
      usage: { prompt_tokens: 10, completion_tokens: 2, cost_usd: 0.25 },
    }), { status: 200 }),
  });
  assert.equal(await adapter.chat({ prompt: "test" }), "ok");
  const row = db.prepare("SELECT reported_cost_usd, estimated_cost_usd, cost_status FROM llm_usage_ledger").get();
  assert.equal(row.reported_cost_usd, 0.25);
  assert.equal(row.estimated_cost_usd, null);
  assert.equal(row.cost_status, "reported");
});

test("fetch-level failure is audited without a metering hold and a later request can run", async (t) => {
  const { db } = tempDatabase(t);
  let fetchCalls = 0;
  const adapter = createOpenCodeAdapter({
    apiKey: "test",
    baseUrl: "https://opencode.example/zen/go/v1",
    model: "kimi-k3",
    protocol: "openai_chat_completions",
    db,
    ratecard: { input: 0, output: 0 },
    fetchImpl: async () => {
      fetchCalls += 1;
      if (fetchCalls === 1) {
        const error = new TypeError("fetch failed");
        error.cause = { code: "ECONNRESET" };
        throw error;
      }
      return new Response(JSON.stringify({
        choices: [{ message: { content: "recovered" } }],
        usage: { prompt_tokens: 8, completion_tokens: 2 },
      }), { status: 200 });
    },
  });

  await assert.rejects(adapter.chat({ prompt: "first" }), (error) => {
    assert.equal(error.code, "provider_network_error");
    return true;
  });
  assert.equal(getState(db, budgetMeteringHoldStateKey("opencode")), null);
  const failed = db.prepare("SELECT * FROM llm_usage_ledger ORDER BY id").get();
  assert.equal(failed.cost_status, "transport_failed");
  assert.equal(failed.input_tokens, null);
  assert.equal(failed.output_tokens, null);
  assert.equal(failed.estimated_cost_usd, null);
  assert.equal(failed.reported_cost_usd, null);

  assert.equal(await adapter.chat({ prompt: "retry" }), "recovered");
  assert.equal(fetchCalls, 2);
  assert.equal(getState(db, budgetMeteringHoldStateKey("opencode")), null);
  const recovered = db.prepare("SELECT * FROM llm_usage_ledger ORDER BY id DESC").get();
  assert.equal(recovered.cost_status, "unknown");
  assert.equal(recovered.input_tokens, 8);
  assert.equal(recovered.output_tokens, 2);
});

test("successful response with missing usage sets the metering hold", async (t) => {
  const { db } = tempDatabase(t);
  let fetchCalls = 0;
  const adapter = createOpenCodeAdapter({
    apiKey: "test",
    baseUrl: "https://opencode.example/zen/go/v1",
    model: "kimi-k3",
    protocol: "openai_chat_completions",
    db,
    ratecard: { input: 0, output: 0 },
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Response(JSON.stringify({
        choices: [{ message: { content: "unmetered work" } }],
      }), { status: 200 });
    },
  });

  assert.equal(await adapter.chat({ prompt: "first" }), "unmetered work");
  assert.ok(getState(db, budgetMeteringHoldStateKey("opencode")));
  const row = db.prepare("SELECT * FROM llm_usage_ledger").get();
  assert.equal(row.cost_status, "unknown");
  assert.equal(row.input_tokens, null);
  assert.equal(row.output_tokens, null);
  assert.equal(row.estimated_cost_usd, null);
  assert.equal(row.reported_cost_usd, null);
  await assert.rejects(adapter.chat({ prompt: "blocked" }), (error) => {
    assert.equal(error.code, "budget_metering_fault");
    return true;
  });
  assert.equal(fetchCalls, 1);
});

test("successful response with valid usage does not set the metering hold", async (t) => {
  const { db } = tempDatabase(t);
  const adapter = createOpenCodeAdapter({
    apiKey: "test",
    baseUrl: "https://opencode.example/zen/go/v1",
    model: "minimax-m3",
    protocol: "anthropic_messages",
    db,
    ratecard: { input: 0, output: 0 },
    fetchImpl: async () => new Response(JSON.stringify({
      content: [{ type: "text", text: "metered work" }],
      usage: { input_tokens: 5, output_tokens: 1 },
    }), { status: 200 }),
  });

  assert.equal(await adapter.chat({ prompt: "test" }), "metered work");
  assert.equal(getState(db, budgetMeteringHoldStateKey("opencode")), null);
  const row = db.prepare("SELECT * FROM llm_usage_ledger").get();
  assert.equal(row.cost_status, "unknown");
  assert.equal(row.input_tokens, 5);
  assert.equal(row.output_tokens, 1);
});

test("LLM iteration ceiling is bounded and classified", async () => {
  const llm = createCountingLlm({ chat: async () => "ok" }, 2);
  assert.equal(await llm.chat({}), "ok");
  assert.equal(await llm.chat({}), "ok");
  await assert.rejects(llm.chat({}), (error) => error.code === "iteration_limit_exceeded");
});

test("dispatch lifecycle persists watchdog deadline and iteration ceiling", (t) => {
  const { db } = tempDatabase(t);
  const deadlineAt = new Date(Date.now() + 60000).toISOString();
  recordJobLifecycle(db, {
    jobId: "job-1",
    state: "dispatch",
    modelHandle: "opencode/minimax-m3",
    iterationCeiling: 60,
    deadlineAt,
  });
  const row = db.prepare("SELECT iteration_ceiling, deadline_at FROM job_lifecycle_log WHERE job_id = 'job-1'").get();
  assert.equal(row.iteration_ceiling, 60);
  assert.equal(row.deadline_at, deadlineAt);
});

test("watchdog terminates a process at its wall-clock deadline", async () => {
  const started = Date.now();
  const result = await runBoundedProcess({
    command: process.execPath,
    args: ["-e", "setInterval(() => {}, 1000)"],
    options: { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
    timeoutMs: 100,
  });
  assert.equal(result.timedOut, true);
  assert.equal(result.ok, false);
  assert.ok(Date.now() - started < 10000);
});

test("Windows watchdog terminates descendant processes without elevation", {
  skip: process.platform !== "win32",
}, async () => {
  const script = [
    "const { spawn } = require('node:child_process');",
    "const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { windowsHide: true, stdio: 'ignore' });",
    "console.log(child.pid);",
    "setInterval(() => {}, 1000);",
  ].join(" ");
  const result = await runBoundedProcess({
    command: process.execPath,
    args: ["-e", script],
    options: { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
    timeoutMs: 300,
  });
  const descendantPid = Number(result.stdout.trim().split(/\s+/)[0]);
  assert.equal(result.timedOut, true);
  assert.ok(Number.isInteger(descendantPid) && descendantPid > 0);
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.throws(() => process.kill(descendantPid, 0), (error) => error?.code === "ESRCH");
});

test("expired reservation with a live worker is not reclaimed", (t) => {
  const { db } = tempDatabase(t);
  const old = new Date("2026-08-24T10:00:00Z");
  assert.equal(reserveExecution(db, {
    jobId: "old", resourceClass: "heavy", provider: "opencode", ownerPid: 101,
    deadlineAt: new Date(old.getTime() + 1000).toISOString(), now: old,
  }).allowed, true);
  assert.equal(bindReservationWorker(db, { jobId: "old", workerPid: 202, boundAt: old }).allowed, true);
  const result = reserveExecution(db, {
    jobId: "new", resourceClass: "heavy", provider: "opencode", ownerPid: 303,
    deadlineAt: "2026-08-24T12:00:00Z", now: new Date("2026-08-24T11:00:00Z"),
    probeLiveness: (pid) => pid === 202 ? "alive" : "dead",
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "concurrency_heavy_limit");
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM coordinator_reservations WHERE job_id = 'old'").get().count, 1);
});

test("dead worker and dead owner reservation is safely reclaimed", (t) => {
  const { db } = tempDatabase(t);
  const old = new Date("2026-08-24T10:00:00Z");
  reserveExecution(db, {
    jobId: "dead", resourceClass: "heavy", provider: "opencode", ownerPid: 101,
    deadlineAt: "2026-08-24T10:00:01Z", now: old,
  });
  bindReservationWorker(db, { jobId: "dead", workerPid: 202, boundAt: old });
  const result = reserveExecution(db, {
    jobId: "replacement", resourceClass: "heavy", provider: "opencode", ownerPid: 303,
    deadlineAt: "2026-08-24T12:00:00Z", now: new Date("2026-08-24T11:00:00Z"),
    probeLiveness: () => "dead",
  });
  assert.equal(result.allowed, true);
  assert.deepEqual(result.reclaimed, ["dead"]);
});

test("dead owner with a live worker does not free the heavy slot", (t) => {
  const { db } = tempDatabase(t);
  const old = new Date("2026-08-24T10:00:00Z");
  reserveExecution(db, {
    jobId: "orphan-worker", resourceClass: "heavy", provider: "opencode", ownerPid: 101,
    deadlineAt: "2026-08-24T10:00:01Z", now: old,
  });
  bindReservationWorker(db, { jobId: "orphan-worker", workerPid: 202, boundAt: old });
  const result = reserveExecution(db, {
    jobId: "replacement", resourceClass: "heavy", provider: "opencode", ownerPid: 303,
    deadlineAt: "2026-08-24T12:00:00Z", now: new Date("2026-08-24T11:00:00Z"),
    probeLiveness: (pid) => pid === 202 ? "alive" : "dead",
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "concurrency_heavy_limit");
});

test("worker PID binding is required before worker work", async (t) => {
  const { root } = tempDatabase(t);
  const result = await runBoundedProcess({
    command: process.execPath,
    args: [path.resolve("scripts/gmk-agent-worker/worker.mjs"), "--once", "--job-id", "missing"],
    options: {
      cwd: process.cwd(), shell: false, windowsHide: true,
      env: { ...process.env, GMK_RUNTIME_ROOT: root },
      stdio: ["ignore", "pipe", "pipe"],
    },
    timeoutMs: 5000,
  });
  assert.equal(result.ok, false);
  assert.match(result.stderr, /worker_pid_binding_failed/);
});

test("watchdog settles after bounded grace when termination fails and close never arrives", async () => {
  const child = new EventEmitter();
  child.pid = 424242;
  const started = Date.now();
  const result = await runBoundedProcess({
    command: "ignored",
    timeoutMs: 30,
    settlementGraceMs: 50,
    spawnImpl: () => child,
    terminateImpl: async () => new Promise(() => {}),
  });
  const elapsed = Date.now() - started;
  assert.equal(result.timedOut, true);
  assert.equal(result.terminationConfirmed, false);
  assert.equal(result.processMayBeAlive, true);
  assert.ok(elapsed >= 70 && elapsed < 1000, `settled in ${elapsed} ms`);
});

test("unconfirmed termination does not release the heavy reservation", async (t) => {
  const { db } = tempDatabase(t);
  reserveExecution(db, {
    jobId: "held", resourceClass: "heavy", provider: "opencode",
    deadlineAt: new Date(Date.now() + 1000).toISOString(),
  });
  bindReservationWorker(db, { jobId: "held", workerPid: 202 });
  const child = new EventEmitter();
  child.pid = 202;
  const processResult = await runBoundedProcess({
    command: "ignored", timeoutMs: 10, settlementGraceMs: 20,
    spawnImpl: () => child, terminateImpl: async () => false,
  });
  assert.equal(processResult.processMayBeAlive, true);
  assert.equal(releaseExecutionAfterResult(db, "held", processResult, {
    probeLiveness: () => "alive",
  }), false);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM coordinator_reservations").get().count, 1);
});

test("confirmed timeout releases the heavy reservation after dead-tree proof", async (t) => {
  const { db } = tempDatabase(t);
  reserveExecution(db, {
    jobId: "stopped", resourceClass: "heavy", provider: "opencode",
    deadlineAt: new Date(Date.now() + 1000).toISOString(),
  });
  bindReservationWorker(db, { jobId: "stopped", workerPid: 202 });
  const child = new EventEmitter();
  child.pid = 202;
  const processResult = await runBoundedProcess({
    command: "ignored", timeoutMs: 10, settlementGraceMs: 100,
    spawnImpl: () => child,
    terminateImpl: async () => {
      queueMicrotask(() => child.emit("close", 1, "SIGTERM"));
      return true;
    },
  });
  assert.equal(processResult.terminationConfirmed, true);
  assert.equal(processResult.processMayBeAlive, false);
  assert.equal(releaseExecutionAfterResult(db, "stopped", processResult), true);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM coordinator_reservations").get().count, 0);
});

test("unknown cost with missing or zero tokens triggers budget containment", async (t) => {
  const { db } = tempDatabase(t);
  recordLlmUsage(db, {
    provider: "opencode", model: "minimax-m3", inputTokens: null, outputTokens: 0,
    costStatus: "unknown", estimatedCostUsd: null,
  });
  const result = evaluateBudget({
    db, provider: "opencode", budgetConfig: budgetConfig(), job: { priority: 100 },
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "budget_metering_fault");
  assert.ok(getState(db, budgetMeteringHoldStateKey("opencode")));
  let fetchCalls = 0;
  const adapter = createOpenCodeAdapter({
    apiKey: "test",
    baseUrl: "https://opencode.example/zen/go/v1",
    model: "minimax-m3",
    protocol: "anthropic_messages",
    db,
    ratecard: { input: 0, output: 0 },
    fetchImpl: async () => { fetchCalls += 1; return new Response("{}"); },
  });
  await assert.rejects(adapter.chat({ prompt: "must not dispatch" }), (error) => {
    assert.equal(error.code, "budget_metering_fault");
    return true;
  });
  assert.equal(fetchCalls, 0);
});

test("budget state unavailable fails closed", (t) => {
  const { db } = tempDatabase(t);
  db.close();
  const result = evaluateBudget({
    db, provider: "opencode", budgetConfig: budgetConfig(), job: { priority: 100 },
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "budget_state_unavailable");
});

test("blocked gate and watchdog results record coordinator event and BLOCKED evidence", (t) => {
  const { db, root } = tempDatabase(t);
  for (const reason of ["health_low_memory", "budget_hard", "concurrency_heavy_limit", "wall_clock_exceeded"]) {
    const artifact = recordBlockedCoordinator(db, root, {
      job: { id: `job-${reason}` },
      reason: `${reason}: blocked for test`,
      attempted: ["test gate"],
      concurrency: reason === "wall_clock_exceeded" ? { processMayBeAlive: false } : null,
    });
    assert.equal(fs.existsSync(artifact), true);
    assert.match(fs.readFileSync(artifact, "utf8"), new RegExp(reason));
  }
  const events = db.prepare("SELECT event, detail_json FROM coordinator_events ORDER BY id").all();
  assert.equal(events.length, 4);
  assert.ok(events.every((event) => event.event === "coordinator_blocked"));
  assert.deepEqual(events.map((event) => JSON.parse(event.detail_json).reason), [
    "health_low_memory", "budget_hard", "concurrency_heavy_limit", "wall_clock_exceeded",
  ]);
});

test("two SQLite connections contending for one heavy capacity cannot both acquire", async (t) => {
  const { dbPath, root } = tempDatabase(t);
  assert.ok(dbPath);
  const startAt = Date.now() + 500;
  const schedulerUrl = new URL("./lib/scheduler.mjs", import.meta.url).href;
  const sqliteUrl = new URL("./lib/sqlite.mjs", import.meta.url).href;
  const script = `
    import { openDatabase } from ${JSON.stringify(sqliteUrl)};
    import { reserveExecution } from ${JSON.stringify(schedulerUrl)};
    const delay = Math.max(0, ${startAt} - Date.now());
    await new Promise((resolve) => setTimeout(resolve, delay));
    const { db } = openDatabase(${JSON.stringify(root)});
    const result = reserveExecution(db, {
      jobId: process.argv[1], resourceClass: "heavy", provider: "opencode",
      deadlineAt: new Date(Date.now() + 60_000).toISOString(),
    });
    process.stdout.write(JSON.stringify(result));
    await new Promise((resolve) => setTimeout(resolve, 100));
    db.close();
  `;
  const run = (jobId) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--input-type=module", "-e", script, jobId], {
      cwd: process.cwd(), shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(JSON.parse(stdout)) : reject(new Error(stderr)));
  });
  const results = await Promise.all([run("race-a"), run("race-b")]);
  assert.equal(results.filter((result) => result.allowed).length, 1);
  assert.equal(results.filter((result) => result.reason === "concurrency_heavy_limit").length, 1);
});

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { writeBlockedArtifact } from "./lib/blocked-artifact.mjs";
import { createOpenCodeAdapter } from "./lib/llm/opencode.mjs";
import { openDatabase } from "./lib/sqlite.mjs";
import { assertJobAuthority } from "./lib/router/authority.mjs";
import { classifyJob } from "./lib/router/classify.mjs";
import {
  DEFAULT_MODEL_CONFIG,
  loadRouterConfig,
  validateBudgetConfig,
  validateModelConfig,
} from "./lib/router/config.mjs";
import { routeJob, selectFirstEnabled } from "./lib/router/route.mjs";
import { assertPrivacyBlock } from "./lib/validate.mjs";

function tempRuntime(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "strehe-router-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }));
  return root;
}

function job(jobType, payload = {}, overrides = {}) {
  return {
    id: "job-1",
    job_type: jobType,
    payload: { type: jobType, ...payload },
    attempt_count: 0,
    requires_review: true,
    workspace_type: "system",
    ...overrides,
  };
}

function routed(input) {
  const classification = classifyJob(input);
  return routeJob(input, classification, DEFAULT_MODEL_CONFIG).handle;
}

test("P0 creates all four additive audit tables", (t) => {
  const root = tempRuntime(t);
  const { db } = openDatabase(root);
  const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name));
  for (const name of ["llm_usage_ledger", "routing_outcomes", "coordinator_events", "job_lifecycle_log"]) {
    assert.equal(tables.has(name), true, `missing ${name}`);
  }
  db.close();
});

test("usage report rolls up 5h/7d/30d windows", (t) => {
  const root = tempRuntime(t);
  const { db } = openDatabase(root);
  db.prepare(
    `INSERT INTO llm_usage_ledger
      (provider, model, input_tokens, output_tokens, cost_status)
     VALUES ('opencode', 'kimi-k3', 10, 2, 'unknown')`,
  ).run();
  db.close();
  const report = spawnSync(process.execPath, [
    path.resolve("scripts/gmk-agent-worker/scripts/router-usage-report.mjs"),
    "--runtime-root", root,
  ], { encoding: "utf8", timeout: 30000 });
  assert.equal(report.status, 0, report.stderr);
  const parsed = JSON.parse(report.stdout);
  assert.deepEqual(Object.keys(parsed).sort(), ["rolling_30d", "rolling_5h", "rolling_7d"]);
  assert.equal(parsed.rolling_5h[0].input_tokens, 10);
});

test("router defaults use 5h/7d/30d budgets and model-specific protocols", (t) => {
  const loaded = loadRouterConfig(tempRuntime(t));
  assert.deepEqual(Object.keys(loaded.budget.opencode).sort(), ["rolling_30d", "rolling_5h", "rolling_7d"]);
  assert.equal(loaded.models.models["opencode/kimi-k3"].protocol, "openai_chat_completions");
  assert.equal(loaded.models.models["opencode/kimi-k2.7-code"].protocol, "openai_chat_completions");
  assert.equal(loaded.models.models["opencode/minimax-m3"].protocol, "anthropic_messages");
  assert.equal(loaded.models.models["opencode/qwen3.7-plus"].protocol, "anthropic_messages");
  assert.equal(loaded.models.models["opencode/deepseek-v4-pro"].enabled, false);
});

test("operator config examples validate when provisioned with live filenames", (t) => {
  const root = tempRuntime(t);
  const configDir = path.join(root, "config");
  const examplesDir = path.resolve("scripts/gmk-agent-worker/config-examples");
  fs.mkdirSync(configDir, { recursive: true });
  for (const filename of ["router.models.json", "router.budget.json", "router.ratecard.json"]) {
    fs.copyFileSync(path.join(examplesDir, `${filename}.example`), path.join(configDir, filename));
  }

  const loaded = loadRouterConfig(root);
  assert.equal(loaded.models.models["opencode/kimi-k3"].protocol, "openai_chat_completions");
  assert.equal(loaded.models.models["opencode/deepseek-v4-pro"].enabled, false);
  assert.equal(loaded.budget.opencode.rolling_5h.max_usd_estimate, 5);
  assert.equal(loaded.ratecard.currency, "USD");
});

test("config validation rejects 24h OpenCode budget and enabled deepseek-v4-pro", () => {
  assert.throws(() => validateBudgetConfig({
    opencode: {
      rolling_24h: { max_tokens: 1 },
      rolling_5h: { max_tokens: 1 },
      rolling_7d: { max_tokens: 1 },
      rolling_30d: { max_tokens: 1 },
    },
  }), /rolling_5h, not rolling_24h/);
  const invalid = JSON.parse(JSON.stringify(DEFAULT_MODEL_CONFIG));
  invalid.models["opencode/deepseek-v4-pro"].enabled = true;
  assert.throws(() => validateModelConfig(invalid), /must remain disabled/);
});

test("route matrix resolves every P2 task class", () => {
  assert.equal(routed(job("engineering.synthetic", { kind: "synthetic" })), "opencode/minimax-m3");
  assert.equal(routed(job("inbox.triage", { kind: "classify" })), "opencode/qwen3.7-plus");
  assert.equal(routed(job("inbox.draft")), "opencode/kimi-k2.7-code");
  assert.equal(routed(job("engineering.proactive")), "opencode/kimi-k2.7-code");
  assert.equal(routed(job("engineering.review")), "opencode/kimi-k2.7-code");
  assert.equal(routed(job("engineering.review", { implementation: true })), "codex");
  assert.equal(routed(job("engineering.review", { task: "difficult debugging refactor", files: Array.from({ length: 11 }, (_, i) => `f${i}.ts`) })), "codex");
  assert.equal(routed(job("engineering.review", { task: "architecture root cause" })), "opencode/kimi-k3");
  assert.equal(routed(job("engineering.review", { needsIndependentReview: true, work_provider: "opencode" })), "codex");
  assert.equal(routed(job("engineering.review", { needsIndependentReview: true, work_provider: "codex" })), "opencode/kimi-k3");
});

test("disabled-model primary walks to an enabled fallback and records the event", (t) => {
  const root = tempRuntime(t);
  const { db } = openDatabase(root);
  const result = selectFirstEnabled(DEFAULT_MODEL_CONFIG, [
    "opencode/deepseek-v4-pro",
    "opencode/kimi-k2.7-code",
  ], { db });
  assert.equal(result.handle, "opencode/kimi-k2.7-code");
  const event = db.prepare("SELECT event, detail_json FROM coordinator_events ORDER BY id DESC LIMIT 1").get();
  assert.equal(event.event, "model_disabled_fallback");
  assert.deepEqual(JSON.parse(event.detail_json).disabled_models, ["opencode/deepseek-v4-pro"]);
  db.close();
});

test("low-risk routine work is cheap-first and prior failures skip cheap tiers", () => {
  const routine = job("engineering.synthetic", { kind: "synthetic" });
  assert.equal(routed(routine), "opencode/minimax-m3");
  const failed = { ...routine, attempt_count: 2 };
  assert.equal(routed(failed), "opencode/kimi-k2.7-code");
});

test("authority gate blocks forbidden actions and real Inbox IDs but permits code review", () => {
  assert.throws(() => assertJobAuthority(job("engineering.review", { deploy: true })), (error) => error.code === "authority_blocked");
  assert.throws(() => assertJobAuthority(job("inbox.triage", { conversation_id: "real-id" })), (error) => error.code === "authority_blocked");
  assert.equal(assertJobAuthority(job("engineering.review", { scope: "supabase/migrations/example.sql" })), true);
});

test("OpenCode chat-completions adapter uses its protocol endpoint and ledgers usage", async (t) => {
  const root = tempRuntime(t);
  const { db } = openDatabase(root);
  let request;
  const adapter = createOpenCodeAdapter({
    apiKey: "test-key",
    baseUrl: "https://opencode.example/zen/go/v1",
    model: "kimi-k3",
    protocol: "openai_chat_completions",
    db,
    ratecard: { input: 1, output: 2 },
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({
        choices: [{ message: { content: '{"answer":4}' } }],
        usage: { prompt_tokens: 11, completion_tokens: 3, completion_tokens_details: { reasoning_tokens: 1 } },
      }), { status: 200 });
    },
  });
  adapter.setContext({ jobId: "j1", agentKey: "engineering.local", taskType: "engineering.synthetic" });
  assert.equal(await adapter.chat({ prompt: "test" }), '{"answer":4}');
  assert.equal(request.url, "https://opencode.example/zen/go/v1/chat/completions");
  assert.equal(JSON.parse(request.options.body).model, "kimi-k3");
  const row = db.prepare("SELECT * FROM llm_usage_ledger").get();
  assert.equal(row.input_tokens, 11);
  assert.equal(row.output_tokens, 3);
  assert.equal(row.reasoning_tokens, 1);
  assert.equal(row.cost_status, "estimated");
  assert.equal(row.reported_cost_usd, null);
  assert.equal(row.estimated_cost_usd, 0.000017);
  db.close();
});

test("OpenCode Anthropic Messages adapter uses /v1/messages and normalizes cache usage", async (t) => {
  const root = tempRuntime(t);
  const { db } = openDatabase(root);
  let request;
  const adapter = createOpenCodeAdapter({
    apiKey: "test-key",
    baseUrl: "https://opencode.example/zen/go/v1",
    model: "minimax-m3",
    protocol: "anthropic_messages",
    db,
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({
        content: [{ type: "text", text: '{"answer":4}' }],
        usage: { input_tokens: 7, output_tokens: 2, cache_read_input_tokens: 5, cache_creation_input_tokens: 1 },
      }), { status: 200 });
    },
  });
  assert.equal(await adapter.chat({ prompt: "test" }), '{"answer":4}');
  assert.equal(request.url, "https://opencode.example/zen/go/v1/messages");
  assert.equal(request.options.headers["anthropic-version"], "2023-06-01");
  const row = db.prepare("SELECT * FROM llm_usage_ledger").get();
  assert.equal(row.cache_read_tokens, 5);
  assert.equal(row.cache_write_tokens, 1);
  assert.equal(row.estimated_cost_usd, null);
  assert.equal(row.reported_cost_usd, null);
  assert.equal(row.cost_status, "unknown");
  db.close();
});

test("OpenCode context overflow is classified and ledgered without an identical retry signal", async (t) => {
  const root = tempRuntime(t);
  const { db } = openDatabase(root);
  const adapter = createOpenCodeAdapter({
    apiKey: "test-key",
    baseUrl: "https://opencode.example/zen/go/v1",
    model: "kimi-k2.7-code",
    protocol: "openai_chat_completions",
    db,
    fetchImpl: async () => new Response(
      JSON.stringify({ error: { message: "maximum context length exceeded" } }),
      { status: 400 },
    ),
  });
  await assert.rejects(adapter.chat({ prompt: "oversized" }), (error) => error.code === "context_length");
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM llm_usage_ledger").get().count, 1);
  db.close();
});

test("privacy gate accepts explicit local or cloud processing and rejects ambiguity", () => {
  assert.doesNotThrow(() => assertPrivacyBlock({ privacy: { external_ai_used: false, local_processing: true } }));
  assert.doesNotThrow(() => assertPrivacyBlock({
    privacy: { external_ai_used: true, local_processing: false },
    runtime: { provider: "opencode", model: "kimi-k3", protocol: "openai_chat_completions" },
  }));
  assert.throws(() => assertPrivacyBlock({ privacy: { external_ai_used: true, local_processing: false } }), /audited provider/);
  assert.throws(() => assertPrivacyBlock({ privacy: { external_ai_used: true, local_processing: true } }), /privacy boundary/);
});

test("blocked artifact is local, explicit, and resumable", (t) => {
  const root = tempRuntime(t);
  const artifact = writeBlockedArtifact(root, {
    reason: "authority_blocked",
    pendingJobs: [{ id: "job-1" }],
    attempted: ["authority"],
    date: new Date("2026-08-24T03:04:05Z"),
  });
  assert.equal(path.dirname(artifact), path.join(root, "state", "artifacts"));
  const text = fs.readFileSync(artifact, "utf8");
  assert.match(text, /authority_blocked/);
  assert.match(text, /job-1/);
  assert.match(text, /coordinator\.mjs --once/);
});

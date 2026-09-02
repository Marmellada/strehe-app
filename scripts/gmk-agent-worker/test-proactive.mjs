import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import {
  buildProactiveInput,
  buildProactivePrompt,
  proactivePlan,
  PROACTIVE_MAX_EXCERPT_PER_FILE,
  PROACTIVE_MAX_FILES,
  PROACTIVE_MAX_PROMPT_BYTES,
  PROACTIVE_TOTAL_EXCERPT_BUDGET,
  shouldRetryTask,
} from "./agents/engineering.spec.mjs";
import { orderJobsForProcessing } from "./lib/claim-loop.mjs";
import { ensureLocalOllamaUrl, isContextLengthError, ollamaChat } from "./lib/ollama.mjs";
import {
  buildEngineeringSnapshot,
  initializeNextEligibility,
  isProactiveDue,
  maybeEnqueueProactiveJob,
  readEngineeringControl,
  recordProactiveFailure,
  recordProactiveOutcome,
  readRecentEngineeringDecisions,
  selectProactiveTarget,
  updateFindingLifecycle,
} from "./lib/proactive.mjs";
import { openDatabase, setState } from "./lib/sqlite.mjs";
import { createToolGateway, getToolSecurityProfile } from "./lib/tools.mjs";
import { processWorkerOnce, processWorkerPass } from "./lib/worker-pass.mjs";

function tempRuntime(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "strehe-engineering-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }));
  return root;
}

function seedModule(db, overrides = {}) {
  db.prepare(
    `INSERT INTO modules
      (name, purpose, source_paths, tests, criticality, mapping_state, validation_state,
       known_findings, last_meaningful_review_at, last_reviewed_fingerprint,
       last_proactive_failure_at, last_proactive_failure_class, proactive_failure_count)
     VALUES (?, ?, ?, ?, ?, 'MAPPED', ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    overrides.name ?? "Auth / RBAC",
    overrides.purpose ?? "Authentication and security",
    JSON.stringify(overrides.source_paths ?? ["lib/auth"]),
    JSON.stringify(overrides.tests ?? []),
    overrides.criticality ?? "high",
    overrides.validation_state ?? "STALE",
    JSON.stringify(overrides.known_findings ?? []),
    overrides.last_meaningful_review_at ?? null,
    overrides.last_reviewed_fingerprint ?? null,
    overrides.last_proactive_failure_at ?? null,
    overrides.last_proactive_failure_class ?? null,
    overrides.proactive_failure_count ?? 0,
  );
}

function queryResult(data, error = null) {
  const chain = {
    select: () => chain, eq: () => chain, lte: () => chain, gt: () => chain,
    order: () => chain, limit: () => chain,
    maybeSingle: async () => ({ data, error }),
    then: (resolve, reject) => Promise.resolve({ data, error }).then(resolve, reject),
  };
  return chain;
}

test("no proactive job is due before the persisted cadence", () => {
  const now = Date.parse("2026-08-21T08:00:00Z");
  assert.equal(isProactiveDue({ nowMs: now, nextEligibleAt: "2026-08-21T11:59:59Z" }), false);
  assert.equal(isProactiveDue({ nowMs: now, nextEligibleAt: "2026-08-21T07:00:00Z", enabled: false }), false);
});

test("exactly one proactive job is requested when due and the next pass does not duplicate it", async (t) => {
  const root = tempRuntime(t);
  const opened = openDatabase(root);
  seedModule(opened.db);
  opened.db.close();
  const control = { proactive_enabled: true, paused: false, cadence_minutes: 240, next_proactive_at: "2026-08-21T07:00:00Z", manual_review_requested_at: null };
  let enqueueCalls = 0;
  const runtime = {
    agentId: "agent-1",
    supabase: {
      from: () => queryResult(control),
      async rpc(name) {
        assert.equal(name, "enqueue_due_engineering_proactive");
        enqueueCalls += 1;
        control.next_proactive_at = "2026-08-21T12:00:00Z";
        return { data: { enqueued: true, job_id: "job-1", next_proactive_at: control.next_proactive_at }, error: null };
      },
    },
    config: { runtimeRoot: root },
    tools: { runTool: async (name) => name === "git.rev" ? { ok: true, commit: "a".repeat(40), tree: "b".repeat(40) } : { ok: true, fingerprint: "c".repeat(64), fileCount: 1 } },
  };
  const first = await maybeEnqueueProactiveJob(runtime, { now: new Date("2026-08-21T08:00:00Z") });
  const second = await maybeEnqueueProactiveJob(runtime, { now: new Date("2026-08-21T08:01:00Z") });
  assert.equal(first.enqueued, true);
  assert.equal(second.reason, "not_due");
  assert.equal(enqueueCalls, 1);
});

test("change-aware queued work is ordered ahead of proactive work regardless of numeric priority", () => {
  const ordered = orderJobsForProcessing([
    { id: "proactive", job_type: "engineering.proactive", priority: 1, created_at: "2026-01-01" },
    { id: "review", job_type: "engineering.review", priority: 999, created_at: "2026-01-02" },
  ]);
  assert.deepEqual(ordered.map((job) => job.id), ["review", "proactive"]);
});

test("recently reviewed unchanged module is not immediately selected again", () => {
  const selected = selectProactiveTarget([
    { name: "Auth", purpose: "security", criticality: "high", validation_state: "STALE", tests: "[]", known_findings: "[]", last_meaningful_review_at: "2026-08-21T07:00:00Z", last_reviewed_fingerprint: "module-tree", current_module_fingerprint: "module-tree" },
    { name: "Billing", purpose: "payments", criticality: "high", validation_state: "NEEDS_REVIEW", tests: "[]", known_findings: "[]", last_meaningful_review_at: null, last_reviewed_fingerprint: null },
  ], { nowMs: Date.parse("2026-08-21T08:00:00Z"), currentFingerprint: "tree" });
  assert.equal(selected.name, "Billing");
});

test("persisted freshness and failure cooldown survive database restart", (t) => {
  const root = tempRuntime(t);
  const first = openDatabase(root);
  seedModule(first.db);
  setState(first.db, "proactive_next_eligible_at", "2026-08-21T12:00:00Z");
  recordProactiveFailure(first.db, { sessionId: "failed-1", moduleName: "Auth / RBAC", commit: "a".repeat(40), attemptedAt: "2026-08-21T08:00:00Z", failureClass: "ollama_timeout" });
  first.db.close();
  const second = openDatabase(root);
  assert.equal(initializeNextEligibility(second.db, Date.parse("2026-08-21T09:00:00Z")), "2026-08-21T12:00:00Z");
  assert.equal(selectProactiveTarget(second.db.prepare("SELECT * FROM modules").all(), { nowMs: Date.parse("2026-08-21T09:00:00Z") }), null);
  assert.equal(second.db.prepare("SELECT proactive_failure_count FROM modules").get().proactive_failure_count, 1);
  second.db.close();
});

test("failed target is cooled down and successful outcome clears failure feedback", (t) => {
  const root = tempRuntime(t);
  const { db } = openDatabase(root);
  seedModule(db, { name: "Auth" });
  seedModule(db, { name: "Billing", criticality: "medium" });
  recordProactiveFailure(db, { moduleName: "Auth", attemptedAt: "2026-08-21T08:00:00Z", failureClass: "schema_error" });
  assert.equal(selectProactiveTarget(db.prepare("SELECT * FROM modules").all(), { nowMs: Date.parse("2026-08-21T09:00:00Z") }).name, "Billing");
  assert.equal(selectProactiveTarget(db.prepare("SELECT * FROM modules").all(), { nowMs: Date.parse("2026-08-21T21:00:01Z") }).name, "Auth");
  recordProactiveOutcome(db, { sessionId: "success", moduleName: "Auth", commit: "a".repeat(40), fingerprint: "b".repeat(64), findings: [], reviewedAt: "2026-08-21T21:00:00Z" });
  const row = db.prepare("SELECT * FROM modules WHERE name = 'Auth'").get();
  assert.equal(row.proactive_failure_count, 0);
  assert.equal(row.last_proactive_failure_at, null);
  assert.equal(row.last_proactive_failure_class, null);
  db.close();
});

test("zero-readable-file module records failure and another bounded target is chosen", async (t) => {
  const root = tempRuntime(t);
  const opened = openDatabase(root);
  seedModule(opened.db, { name: "Missing", source_paths: ["missing"] });
  seedModule(opened.db, { name: "Present", criticality: "medium", source_paths: ["present"] });
  opened.db.close();
  let requestedTarget = null;
  const runtime = {
    agentId: "agent-1", config: { runtimeRoot: root },
    supabase: { async rpc(name, args) { assert.equal(name, "enqueue_due_engineering_proactive"); requestedTarget = args.target_module; return { data: { enqueued: true, next_proactive_at: "2026-08-21T12:00:00Z" }, error: null }; } },
    tools: { async runTool(name, args) {
      if (name === "git.rev") return { ok: true, commit: "a".repeat(40), tree: "b".repeat(40) };
      return { ok: true, fileCount: args.paths[0] === "missing" ? 0 : 1, fingerprint: "c".repeat(64) };
    } },
  };
  await maybeEnqueueProactiveJob(runtime, { now: new Date("2026-08-21T08:00:00Z"), control: { control_available: true, proactive_enabled: true, paused: false, cadence_minutes: 240, next_proactive_at: "2026-08-21T07:00:00Z" } });
  assert.equal(requestedTarget, "Present");
  const reopened = openDatabase(root);
  assert.equal(reopened.db.prepare("SELECT last_proactive_failure_class FROM modules WHERE name = 'Missing'").get().last_proactive_failure_class, "zero_readable_files");
  reopened.db.close();
});

test("existing SQLite memory is upgraded in place without losing module state", (t) => {
  const root = tempRuntime(t);
  fs.mkdirSync(path.join(root, "state"), { recursive: true });
  const legacy = new DatabaseSync(path.join(root, "state", "engineering.sqlite3"));
  legacy.exec(`CREATE TABLE modules (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, purpose TEXT,
    source_paths TEXT NOT NULL DEFAULT '[]', db_dependencies TEXT NOT NULL DEFAULT '[]',
    rpc_dependencies TEXT NOT NULL DEFAULT '[]', upstream_dependencies TEXT NOT NULL DEFAULT '[]',
    downstream_dependents TEXT NOT NULL DEFAULT '[]', external_services TEXT NOT NULL DEFAULT '[]',
    tests TEXT NOT NULL DEFAULT '[]', criticality TEXT NOT NULL DEFAULT 'low',
    mapping_state TEXT NOT NULL DEFAULT 'UNKNOWN', validation_state TEXT NOT NULL DEFAULT 'UNKNOWN',
    last_validated_commit TEXT, known_findings TEXT NOT NULL DEFAULT '[]', updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  ); INSERT INTO modules(name, validation_state) VALUES ('Legacy module', 'VALIDATED');`);
  legacy.close();
  const upgraded = openDatabase(root);
  const columns = upgraded.db.prepare("PRAGMA table_info(modules)").all().map((item) => item.name);
  assert.equal(columns.includes("last_proactive_failure_at"), true);
  assert.equal(upgraded.db.prepare("SELECT validation_state FROM modules WHERE name = 'Legacy module'").get().validation_state, "VALIDATED");
  upgraded.db.close();
});

test("no-finding advances freshness and finding lifecycle remains auditable", (t) => {
  const root = tempRuntime(t);
  const { db } = openDatabase(root);
  seedModule(db);
  const reviewedAt = "2026-08-21T08:00:00Z";
  assert.equal(recordProactiveOutcome(db, { sessionId: "s1", moduleName: "Auth / RBAC", commit: "a".repeat(40), fingerprint: "b".repeat(64), findings: [], reviewedAt }), "NO_FINDINGS");
  assert.equal(db.prepare("SELECT last_meaningful_review_at FROM modules").get().last_meaningful_review_at, reviewedAt);
  recordProactiveOutcome(db, { sessionId: "s2", moduleName: "Auth / RBAC", commit: "a".repeat(40), fingerprint: "c".repeat(64), reviewedAt, findings: [{ severity: "high", confidence: "high", summary: "Missing guard", evidence: ["lib/auth/a.ts:10"] }] });
  const finding = db.prepare("SELECT * FROM engineering_findings WHERE session_id = 's2'").get();
  updateFindingLifecycle(db, { findingId: finding.id, lifecycle: "RESOLVED", decidedAt: "2026-08-21T09:00:00Z" });
  const snapshot = buildEngineeringSnapshot(db, { model: "local-model" });
  assert.equal(snapshot.counts.pending_findings, 0);
  assert.equal(snapshot.findings.some((item) => item.id === finding.id && item.lifecycle === "RESOLVED"), true);
  db.prepare("UPDATE engineering_findings SET evidence = ? WHERE id = ?")
    .run(JSON.stringify(["bad\u0000evidence"]), finding.id);
  const sanitizedSnapshot = buildEngineeringSnapshot(db, { model: "local-model" });
  const sanitizedFinding = sanitizedSnapshot.findings.find((item) => item.id === finding.id);
  assert.equal(sanitizedFinding.evidence[0].includes("\u0000"), false);
  assert.equal(sanitizedFinding.evidence[0].includes("\uFFFD"), true);
  assert.equal(db.prepare("SELECT count(*) AS count FROM engineering_decisions WHERE finding_id = ?").get(finding.id).count, 1);
  const selected = selectProactiveTarget([
    { ...db.prepare("SELECT * FROM modules WHERE name = 'Auth / RBAC'").get(), current_module_fingerprint: "changed" },
    { name: "Other", purpose: "ordinary", criticality: "high", validation_state: "VALIDATED", tests: "[]", known_findings: "[]", last_meaningful_review_at: "2026-08-15T09:00:00Z", last_reviewed_fingerprint: "old", current_module_fingerprint: "changed" },
  ], { nowMs: Date.parse("2026-08-23T09:00:00Z") });
  assert.equal(selected.name, "Other");
  for (let run = 0; run < 3; run += 1) {
    recordProactiveOutcome(db, {
      sessionId: `bounded-${run}`, moduleName: "Auth / RBAC", commit: "a".repeat(40),
      fingerprint: `${run}`.repeat(64), reviewedAt,
      findings: Array.from({ length: 5 }, (_, index) => ({ summary: `Finding ${run}-${index}`, severity: "low", evidence: [] })),
    });
  }
  assert.equal(JSON.parse(db.prepare("SELECT known_findings FROM modules WHERE name = 'Auth / RBAC'").get().known_findings).length, 10);
  assert.equal(db.prepare("SELECT count(*) AS count FROM engineering_findings WHERE module = 'Auth / RBAC'").get().count, 16);
  db.close();
});

test("proactive prompt includes prior decisions and intentional safety constraints", (t) => {
  const root = tempRuntime(t);
  const { db } = openDatabase(root);
  seedModule(db, {
    name: "Outbound messaging",
    purpose: "Human-authorized send via Meta Graph API.",
  });

  const reviewedAt = "2026-08-21T10:00:00Z";
  recordProactiveOutcome(db, {
    sessionId: "decision-context",
    moduleName: "Outbound messaging",
    commit: "a".repeat(40),
    fingerprint: "b".repeat(64),
    reviewedAt,
    findings: [{
      severity: "high",
      confidence: "high",
      summary: "Lack of Agent Send Capability",
      evidence: ["lib/messaging/send/index.ts"],
    }],
  });

  const finding = db.prepare(
    "SELECT id FROM engineering_findings WHERE session_id = 'decision-context'",
  ).get();

  updateFindingLifecycle(db, {
    findingId: finding.id,
    lifecycle: "RESOLVED",
    decidedAt: "2026-08-21T10:05:00Z",
  });

  const decisions = readRecentEngineeringDecisions(db, "Outbound messaging", 8);
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0].decision, "RESOLVED");
  assert.equal(decisions[0].finding, "Lack of Agent Send Capability");

  const prompt = buildProactivePrompt({
    name: "Outbound messaging",
    purpose: "Human-authorized send via Meta Graph API.",
    criticality: "high",
    known_findings: [],
    tests: [],
    decisions,
  }, [
    "FILE: lib/messaging/send/index.ts\nexport function sendMetaMessage() {}",
  ]);

  assert.match(prompt, /human-authorized/i);
  assert.match(prompt, /must not autonomously deploy/i);
  assert.match(prompt, /local-only/i);
  assert.match(prompt, /intentional architectural constraint or non-goal is not itself a defect/i);
  assert.match(prompt, /Lack of Agent Send Capability/);
  assert.match(prompt, /"decision":"RESOLVED"/);

  db.close();
});

test("control-plane failure fails closed and does not process queued work", async (t) => {
  const runtimeRoot = tempRuntime(t);
  const logs = [];
  let enqueueCalls = 0;
  let completed = 0;
  const job = { id: "normal-1", job_type: "engineering.review", priority: 10, created_at: "2026-08-21T08:00:00Z", payload: {} };
  const runtime = {
    agentId: "agent-1", logger: { log: (event, detail) => logs.push({ event, detail }) }, onJobState: async () => {},
    config: { runtimeRoot },
    supabase: {
      from(table) { return table === "agent_operator_controls" ? queryResult(null, { message: "relation unavailable" }) : queryResult([job]); },
      async rpc(name) {
        if (name === "claim_agent_job") return { data: job, error: null };
        if (name === "complete_agent_job") { completed += 1; return { data: true, error: null }; }
        if (name === "enqueue_due_engineering_proactive") enqueueCalls += 1;
        return { data: null, error: null };
      },
    },
  };
  const spec = { capability: "engineering.local", leaseSeconds: 300, run: async () => ({ privacy: { external_ai_used: false, local_processing: true }, production_changes_made: false }) };
  const pass = await processWorkerPass(runtime, spec, { engineering: true });
  assert.equal(pass.processed, false);
  assert.equal(pass.control.proactive_enabled, false);
  assert.equal(pass.control.paused, true);
  assert.equal(completed, 0);
  assert.equal(enqueueCalls, 0);
  await readEngineeringControl(runtime);
  assert.equal(logs.filter((item) => item.event === "engineering_control_unavailable").length, 1);
});

test("--once control-plane failure with an idle queue cannot self-generate proactive work", async (t) => {
  const runtimeRoot = tempRuntime(t);
  let rpcCalls = 0;
  const runtime = {
    agentId: "agent-1", logger: { log: () => {} },
    config: { runtimeRoot },
    supabase: { from: (table) => table === "agent_operator_controls" ? queryResult(null, { message: "down" }) : queryResult([]), rpc: async () => { rpcCalls += 1; return { data: null, error: null }; } },
  };
  const pass = await processWorkerOnce(runtime, { capability: "engineering.local", leaseSeconds: 300, run: async () => ({}) }, { engineering: true });
  assert.equal(pass.processed, false);
  assert.equal(pass.scheduled, null);
  assert.equal(rpcCalls, 0);
});

test("available paused control remains authoritative for normal and proactive work", async (t) => {
  const runtimeRoot = tempRuntime(t);
  let rpcCalls = 0;
  const runtime = {
    agentId: "agent-1", logger: { log: () => {} },
    config: { runtimeRoot },
    supabase: { from: () => queryResult({ proactive_enabled: true, paused: true, cadence_minutes: 240, next_proactive_at: "2026-08-21T07:00:00Z" }), rpc: async () => { rpcCalls += 1; return { data: null, error: null }; } },
  };
  const pass = await processWorkerPass(runtime, { capability: "engineering.local", leaseSeconds: 300, run: async () => ({}) }, { engineering: true });
  assert.equal(pass.control.control_available, true);
  assert.equal(pass.processed, false);
  assert.equal(pass.scheduled, null);
  assert.equal(rpcCalls, 0);
});

test("public AI and production mutation paths remain impossible at the executable tool boundary", async (t) => {
  assert.throws(() => ensureLocalOllamaUrl("https://api.openai.com/v1"), /Public AI APIs are disabled/);
  assert.equal(ensureLocalOllamaUrl("http://127.0.0.1:11434"), "http://127.0.0.1:11434");
  const root = tempRuntime(t);
  const gateway = createToolGateway({ worktreePath: root });
  const profile = getToolSecurityProfile();
  assert.equal(profile.shell, false);
  assert.equal(profile.arbitraryCommandTool, false);
  assert.equal(profile.environmentAllowlist.some((name) => /SUPABASE|OLLAMA|TOKEN|SECRET|KEY/i.test(name)), false);
  assert.equal(gateway.list().some((name) => /write|patch|deploy|migrate|sql|push/i.test(name)), false);
  assert.deepEqual(proactivePlan({ name: "Auth" }).map((step) => step.taskKind), ["git.rev", "git.status", "proactive.analyze"]);
  assert.equal((await gateway.runTool("shell.exec", { command: "git push" })).ok, false);
  assert.equal((await gateway.runTool("file.write", { path: "x", content: "x" })).ok, false);
  assert.equal(fs.existsSync(path.join(root, "x")), false);
});

test("proactive prompt input is bounded: 6 files / 18 KiB total / 6 KiB per file / 22 KiB prompt", async () => {
  assert.equal(PROACTIVE_MAX_FILES, 6);
  assert.equal(PROACTIVE_TOTAL_EXCERPT_BUDGET, 18 * 1024);
  assert.equal(PROACTIVE_MAX_EXCERPT_PER_FILE, 6 * 1024);
  assert.equal(PROACTIVE_MAX_PROMPT_BYTES, 22 * 1024);

  // 12 candidate files of 1 KiB: the 6-file cap must be the binding limit, and the
  // assembled prompt must stay under the hard byte budget WITHOUT adaptive trimming.
  const manySmall = Array.from({ length: 12 }, (_, i) => `lib/mod${i}/index.ts`).join("\n");
  const tools = {
    async runTool(name) {
      if (name === "git.ls_files") return { ok: true, stdout: manySmall };
      if (name === "file.read") return { ok: true, content: "z".repeat(1024) };
      throw new Error(`unexpected tool ${name}`);
    },
  };
  const targetModule = { name: "Auth", purpose: "security", criticality: "high", known_findings: [], tests: [], decisions: [], source_paths: ["lib"] };
  const input = await buildProactiveInput(targetModule, tools);
  assert.equal(input.files.length, 6, "candidate cap of 6 files was not enforced");
  const contentChars = input.excerpts.reduce((sum, entry) => sum + (entry.length - entry.indexOf("\n") - 1), 0);
  assert.ok(contentChars <= 18 * 1024, `excerpt content ${contentChars} exceeds the 18 KiB total budget`);
  for (const excerpt of input.excerpts) {
    const content = excerpt.length - excerpt.indexOf("\n") - 1;
    assert.ok(content <= 6 * 1024, `per-file excerpt ${content} exceeds the 6 KiB cap`);
  }
  assert.ok(input.promptBytes <= 22 * 1024, `final prompt is not bounded (${input.promptBytes} bytes)`);
  assert.equal(input.adaptivelyTrimmed, false, "normal small inputs must be unchanged");
  assert.ok(input.excerptBytes > 0 && input.promptChars > 0, "telemetry counts missing");
});

test("byte-dense source cannot produce a prompt above the 22 KiB hard budget", async () => {
  // 6 files x 2 KiB CJK chars (3 UTF-8 bytes each) — ~37 KiB of raw excerpts alone.
  assert.ok(Buffer.byteLength("界".repeat(2048), "utf8") * 6 > PROACTIVE_MAX_PROMPT_BYTES,
    "fixture must be byte-dense enough to exercise the hard budget");
  const listed = Array.from({ length: 6 }, (_, i) => `lib/mod${i}/index.ts`).join("\n");
  const tools = {
    async runTool(name) {
      if (name === "git.ls_files") return { ok: true, stdout: listed };
      if (name === "file.read") return { ok: true, content: "界".repeat(2048) };
      throw new Error(`unexpected tool ${name}`);
    },
  };
  const targetModule = { name: "Auth", purpose: "security", criticality: "high", known_findings: [], tests: [], decisions: [], source_paths: ["lib"] };
  const input = await buildProactiveInput(targetModule, tools);
  assert.equal(input.adaptivelyTrimmed, true, "dense input must trigger adaptive trimming");
  assert.ok(input.promptBytes <= 22 * 1024, `final prompt ${input.promptBytes} bytes exceeds the 22 KiB hard budget`);
});

test("adaptive trimming preserves representation from as many files as possible", async () => {
  const listed = Array.from({ length: 6 }, (_, i) => `lib/mod${i}/index.ts`).join("\n");
  const tools = {
    async runTool(name) {
      if (name === "git.ls_files") return { ok: true, stdout: listed };
      if (name === "file.read") return { ok: true, content: "界".repeat(2048) };
      throw new Error(`unexpected tool ${name}`);
    },
  };
  const targetModule = { name: "Auth", purpose: "security", criticality: "high", known_findings: [], tests: [], decisions: [], source_paths: ["lib"] };
  const input = await buildProactiveInput(targetModule, tools);
  assert.equal(input.files.length, 6, "trimming must keep every selected file represented");
  for (const excerpt of input.excerpts) {
    assert.match(excerpt, /^FILE: lib\/mod\d\/index\.ts\n.+/s, "excerpt header + at least one code point must survive");
  }
  assert.ok(input.promptBytes <= 22 * 1024);
});

test("context overflow is classified as ollama_context_exceeded", () => {
  assert.equal(isContextLengthError("the prompt is longer than the context length currently available to the model"), true);
  assert.equal(isContextLengthError("Ollama returned 400: the prompt is longer than the context length currently available to the model"), true);
  assert.equal(isContextLengthError("ECONNREFUSED"), false);
  assert.equal(isContextLengthError(""), false);
});

test("ollamaChat tags deterministic context overflow with a machine-readable error code", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    "the prompt is longer than the context length currently available to the model",
    { status: 400, headers: { "Content-Type": "text/plain" } },
  );
  try {
    await assert.rejects(
      ollamaChat({ baseUrl: "http://127.0.0.1:11434", model: "test-model", prompt: "x" }),
      (err) => err instanceof Error && err.code === "ollama_context_exceeded",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("deterministic context overflow is never retried unchanged; transient failures still retry", () => {
  assert.equal(shouldRetryTask({ code: "ollama_context_exceeded" }, 0), false);
  assert.equal(shouldRetryTask({ code: "ollama_context_exceeded" }, 1), false);
  assert.equal(shouldRetryTask({ code: "ollama_context_exceeded" }, 2), false);
  assert.equal(shouldRetryTask({ code: "context_length" }, 0), false);
  assert.equal(shouldRetryTask(new Error("ECONNRESET"), 0), true);
  assert.equal(shouldRetryTask(new Error("ECONNRESET"), 1), true);
  assert.equal(shouldRetryTask(new Error("ECONNRESET"), 2), false);
});

test("bounded proactive input still produces a valid prompt and telemetry on the success path", async () => {
  const tools = {
    async runTool(name) {
      if (name === "git.ls_files") return { ok: true, stdout: "lib/auth/index.ts" };
      if (name === "file.read") return { ok: true, content: "export const guard = true;" };
      throw new Error(`unexpected tool ${name}`);
    },
  };
  const targetModule = { name: "Auth", purpose: "RBAC", criticality: "high", known_findings: [], tests: ["test/auth.spec.ts"], decisions: [], source_paths: ["lib/auth"] };
  const input = await buildProactiveInput(targetModule, tools);
  assert.deepEqual(input.files, ["lib/auth/index.ts"]);
  assert.match(input.prompt, /MODULE: Auth/);
  assert.match(input.prompt, /INTENTIONAL CONSTRAINTS/);
  assert.ok(input.promptChars > 0 && input.promptBytes > 0 && input.excerptBytes > 0);
  assert.equal(input.prompt, buildProactivePrompt(targetModule, input.excerpts));
});

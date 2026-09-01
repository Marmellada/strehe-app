import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import engineeringSpec from "./agents/engineering.spec.mjs";
import { processNextJob } from "./lib/claim-loop.mjs";
import {
  createDeterministicLlm,
  createDispatchPlan,
  createWorkerLlm,
  DISPATCH_KIND,
  recordDispatchSelection,
} from "./lib/dispatch.mjs";
import { classifyJob } from "./lib/router/classify.mjs";
import { DEFAULT_MODEL_CONFIG } from "./lib/router/config.mjs";
import { selectCoordinatorJob } from "./lib/job-selection.mjs";
import { openDatabase } from "./lib/sqlite.mjs";
import {
  releaseExecutionAfterResult,
  reserveExecution,
} from "./lib/scheduler.mjs";
import { bindTargetedWorker } from "./lib/worker-binding.mjs";

const TARGET_JOB_ID = "synthetic-finding-lifecycle-job";

function tempRuntime(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "strehe-finding-lifecycle-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }));
  return root;
}

function lifecycleJob(payload = {}) {
  return {
    id: TARGET_JOB_ID,
    job_type: "engineering.finding.lifecycle",
    payload: { finding_id: 1, lifecycle: "RESOLVED", ...payload },
    priority: 10,
    created_at: "2026-09-01T08:00:00Z",
    attempt_count: 0,
    requires_review: true,
    workspace_type: "system",
  };
}

function modelJob(jobType) {
  return {
    id: `synthetic-${jobType}`,
    job_type: jobType,
    payload: { type: jobType },
    attempt_count: 0,
    requires_review: true,
    workspace_type: "system",
  };
}

function seedFinding(root) {
  const { db } = openDatabase(root);
  db.prepare("INSERT INTO modules(name, validation_state) VALUES ('Synthetic module', 'STALE')").run();
  const findingId = Number(db.prepare(
    "INSERT INTO engineering_findings(module, finding, lifecycle) VALUES ('Synthetic module', 'Synthetic finding', 'OPEN')",
  ).run().lastInsertRowid);
  db.close();
  return findingId;
}

function fakeSupabase(candidate) {
  const evidence = {
    targetedIds: [],
    claimedIds: [],
    completed: [],
    failed: [],
  };
  const query = {
    select() { return query; },
    eq(column, value) {
      if (column === "id") evidence.targetedIds.push(value);
      return query;
    },
    lte() { return query; },
    gt() { return query; },
    order() { return query; },
    async limit() { return { data: [candidate], error: null }; },
  };
  return {
    evidence,
    client: {
      from(table) {
        assert.equal(table, "agent_jobs");
        return query;
      },
      async rpc(name, args) {
        if (name === "claim_agent_job") {
          evidence.claimedIds.push(args.target_job_id);
          return { data: { ...candidate, status: "running", run_id: "synthetic-run" }, error: null };
        }
        if (name === "complete_agent_job") {
          evidence.completed.push(args);
          return { data: true, error: null };
        }
        if (name === "fail_agent_job") {
          evidence.failed.push(args);
          return { data: true, error: null };
        }
        if (name === "renew_agent_job_lease") return { data: true, error: null };
        throw new Error(`unexpected synthetic RPC: ${name}`);
      },
    },
  };
}

function deterministicRuntime(root, candidate) {
  const supabase = fakeSupabase(candidate);
  let routingOutcomeCalls = 0;
  return {
    evidence: supabase.evidence,
    runtime: {
      supabase: supabase.client,
      config: { runtimeRoot: root, worktreePath: process.cwd() },
      logger: { log() {} },
      targetJobId: TARGET_JOB_ID,
      modelHandle: null,
      dispatchKind: DISPATCH_KIND.DETERMINISTIC,
      llm: createDeterministicLlm(),
      async onJobState() {},
      recordRoutingOutcome() { routingOutcomeCalls += 1; },
    },
    routingOutcomeCalls: () => routingOutcomeCalls,
  };
}

test("coordinator dispatch planning accepts finding lifecycle without model routing or budget identity", () => {
  const job = lifecycleJob();
  let modelRouteCalls = 0;
  const plan = createDispatchPlan(job, classifyJob(job), DEFAULT_MODEL_CONFIG, {
    routeJobImpl() {
      modelRouteCalls += 1;
      throw new Error("model route must not be called");
    },
  });
  assert.equal(plan.kind, DISPATCH_KIND.DETERMINISTIC);
  assert.equal(plan.handle, null);
  assert.equal(plan.provider, "deterministic");
  assert.equal(plan.resourceClass, "light");
  assert.equal(plan.llmCallCeiling, 0);
  assert.equal(modelRouteCalls, 0);
});

test("coordinator selection pins the exact requested lifecycle job ID", async () => {
  const candidate = lifecycleJob();
  const fixture = fakeSupabase(candidate);
  const selected = await selectCoordinatorJob(
    fixture.client,
    "engineering.local",
    TARGET_JOB_ID,
    new Date("2026-09-01T08:01:00Z"),
  );
  assert.equal(selected.id, TARGET_JOB_ID);
  assert.deepEqual(fixture.evidence.targetedIds, [TARGET_JOB_ID]);
});

test("deterministic dispatch selection is audited without a model handle or routing outcome", (t) => {
  const root = tempRuntime(t);
  const { db } = openDatabase(root);
  const job = lifecycleJob();
  const plan = createDispatchPlan(job, classifyJob(job), DEFAULT_MODEL_CONFIG);
  recordDispatchSelection(db, job, plan);
  const lifecycle = db.prepare("SELECT state, model_handle FROM job_lifecycle_log WHERE job_id = ?").get(job.id);
  assert.equal(lifecycle.state, "deterministic_dispatch_selected");
  assert.equal(lifecycle.model_handle, null);
  const event = db.prepare("SELECT event, detail_json FROM coordinator_events ORDER BY id DESC LIMIT 1").get();
  assert.equal(event.event, "deterministic_dispatch_selected");
  assert.deepEqual(JSON.parse(event.detail_json), {
    job_id: TARGET_JOB_ID,
    job_type: "engineering.finding.lifecycle",
    dispatch_kind: "deterministic",
    complexity: "low",
    risk_class: plan.riskClass,
  });
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM routing_outcomes").get().count, 0);
  db.close();
});

test("ordinary review and proactive jobs retain their existing model routes", () => {
  const review = modelJob("engineering.review");
  const proactive = modelJob("engineering.proactive");
  assert.equal(createDispatchPlan(review, classifyJob(review), DEFAULT_MODEL_CONFIG).handle, "opencode/kimi-k2.7-code");
  assert.equal(createDispatchPlan(proactive, classifyJob(proactive), DEFAULT_MODEL_CONFIG).handle, "opencode/kimi-k2.7-code");
});

test("malformed finding lifecycle payloads fail closed before dispatch", () => {
  for (const payload of [
    { finding_id: 0, lifecycle: "RESOLVED" },
    { finding_id: "not-an-id", lifecycle: "RESOLVED" },
    { finding_id: 1, lifecycle: "INVALID" },
  ]) {
    const job = lifecycleJob(payload);
    assert.throws(
      () => createDispatchPlan(job, classifyJob(job), DEFAULT_MODEL_CONFIG),
      (error) => ["invalid_finding_lifecycle_target", "invalid_finding_lifecycle"].includes(error.code),
    );
  }
});

test("deterministic worker runtime constructs no model adapter and forbids chat", async () => {
  let modelFactoryCalls = 0;
  const llm = createWorkerLlm(DISPATCH_KIND.DETERMINISTIC, () => {
    modelFactoryCalls += 1;
    throw new Error("model adapter construction must be unreachable");
  });
  assert.equal(modelFactoryCalls, 0);
  assert.deepEqual(
    { provider: llm.provider, model: llm.model, protocol: llm.protocol, isExternal: llm.isExternal },
    { provider: "deterministic", model: "none", protocol: "none", isExternal: false },
  );
  await assert.rejects(llm.chat({ prompt: "must never execute" }), (error) => error.code === "deterministic_llm_forbidden");
});

test("targeted lifecycle worker binds the coordinator reservation and cleanup releases it", (t) => {
  const root = tempRuntime(t);
  const { db } = openDatabase(root);
  const reserved = reserveExecution(db, {
    jobId: TARGET_JOB_ID,
    resourceClass: "light",
    provider: "deterministic",
    processKind: "worker",
    deadlineAt: new Date(Date.now() + 60_000).toISOString(),
  });
  assert.equal(reserved.allowed, true);
  const binding = bindTargetedWorker({ runtimeRoot: root, jobId: TARGET_JOB_ID, workerPid: process.pid });
  assert.equal(binding.allowed, true);
  const row = db.prepare("SELECT worker_pid, provider, process_kind FROM coordinator_reservations WHERE job_id = ?")
    .get(TARGET_JOB_ID);
  assert.equal(row.worker_pid, process.pid);
  assert.equal(row.provider, "deterministic");
  assert.equal(row.process_kind, "worker");
  assert.equal(releaseExecutionAfterResult(db, TARGET_JOB_ID, {
    processMayBeAlive: false,
    terminationConfirmed: true,
  }), true);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM coordinator_reservations").get().count, 0);
  db.close();
});

test("exact targeted lifecycle job updates the finding and creates no model accounting", async (t) => {
  const root = tempRuntime(t);
  const findingId = seedFinding(root);
  const candidate = lifecycleJob({ finding_id: findingId, lifecycle: "RESOLVED" });
  const fixture = deterministicRuntime(root, candidate);
  assert.equal(await processNextJob(fixture.runtime, engineeringSpec), true);
  assert.deepEqual(fixture.evidence.targetedIds, [TARGET_JOB_ID]);
  assert.deepEqual(fixture.evidence.claimedIds, [TARGET_JOB_ID]);
  assert.equal(fixture.evidence.completed.length, 1);
  assert.equal(fixture.evidence.failed.length, 0);
  assert.equal(fixture.evidence.completed[0].target_job_id, TARGET_JOB_ID);
  assert.match(fixture.evidence.completed[0].job_result.summary, /lifecycle updated to RESOLVED/);

  const { db } = openDatabase(root);
  assert.equal(db.prepare("SELECT lifecycle FROM engineering_findings WHERE id = ?").get(findingId).lifecycle, "RESOLVED");
  assert.equal(db.prepare("SELECT decision FROM engineering_decisions WHERE finding_id = ?").get(findingId).decision, "RESOLVED");
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM llm_usage_ledger").get().count, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM routing_outcomes").get().count, 0);
  db.close();
  assert.equal(fixture.routingOutcomeCalls(), 0);
});

test("malformed claimed lifecycle job fails through normal RPC semantics without model accounting", async (t) => {
  const root = tempRuntime(t);
  const findingId = seedFinding(root);
  const candidate = lifecycleJob({ finding_id: findingId, lifecycle: "INVALID" });
  const fixture = deterministicRuntime(root, candidate);
  assert.equal(await processNextJob(fixture.runtime, engineeringSpec), true);
  assert.equal(fixture.evidence.completed.length, 0);
  assert.equal(fixture.evidence.failed.length, 1);
  assert.equal(fixture.evidence.failed[0].target_job_id, TARGET_JOB_ID);
  assert.equal(fixture.evidence.failed[0].failure_code, "invalid_finding_lifecycle");

  const { db } = openDatabase(root);
  assert.equal(db.prepare("SELECT lifecycle FROM engineering_findings WHERE id = ?").get(findingId).lifecycle, "OPEN");
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM engineering_decisions").get().count, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM llm_usage_ledger").get().count, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM routing_outcomes").get().count, 0);
  db.close();
  assert.equal(fixture.routingOutcomeCalls(), 0);
});

import fs from "node:fs";
import path from "node:path";

import inboxSpec from "./agents/inbox.spec.mjs";
import { evaluateBudget } from "./lib/budget.mjs";
import {
  assertNoActiveRuntimeWork,
  assertOperatorPauseState,
  controlledInboxJob,
  GO_RESET_JOB_ID,
  GO_RESET_ROUTE,
  inspectOpenCodeBudget,
} from "./lib/go-ready.mjs";
import { createOpenCodeAdapter } from "./lib/llm/opencode.mjs";
import { recordJobLifecycle, recordRoutingOutcome } from "./lib/ledger.mjs";
import { assertJobAuthority } from "./lib/router/authority.mjs";
import { classifyJob } from "./lib/router/classify.mjs";
import { loadRouterConfig, loadRouterEnvironment, resolveModelConfig } from "./lib/router/config.mjs";
import { routeJob } from "./lib/router/route.mjs";
import { openDatabase } from "./lib/sqlite.mjs";
import { releaseExecution, reserveExecution } from "./lib/scheduler.mjs";

function parseArgs(argv) {
  const result = { confirmed: false, operatorPauseState: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--runtime-root") result.runtimeRoot = argv[++index];
    else if (arg === "--fixture") result.fixture = argv[++index];
    else if (arg === "--job-id") result.jobId = argv[++index];
    else if (arg === "--operator-pause-state") result.operatorPauseState = argv[++index];
    else if (arg === "--confirm-single-cloud-call") result.confirmed = true;
    else throw new Error(`unknown_argument (${arg})`);
  }
  return result;
}

function safeFailureClass(error) {
  return String(error?.code || "go_reset_test_failed").replace(/[^a-z0-9_-]/gi, "_").slice(0, 80);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.confirmed) throw new Error("missing_confirm_single_cloud_call");
  assertOperatorPauseState(args.operatorPauseState);
  if (!GO_RESET_JOB_ID.test(String(args.jobId || ""))) throw new Error("invalid_or_missing_go_reset_job_id");
  const worktree = process.cwd();
  const runtimeRoot = path.resolve(args.runtimeRoot || path.join(worktree, "..", ".."));
  const fixturePath = path.resolve(worktree, args.fixture || "tests/fixtures/inbox/k-english-inquiry.json");
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const job = controlledInboxJob(fixture, args.jobId);
  const artifact = path.join(runtimeRoot, "state", "artifacts", `${job.id}.result.json`);
  const { db } = openDatabase(runtimeRoot);
  let reserved = false;
  let route = null;
  let fetchCalls = 0;
  const deadlineAt = new Date(Date.now() + 3 * 60_000).toISOString();
  try {
    assertNoActiveRuntimeWork(db);
    if (db.prepare("SELECT 1 FROM job_lifecycle_log WHERE job_id = ? LIMIT 1").get(job.id)
      || db.prepare("SELECT 1 FROM llm_usage_ledger WHERE job_id = ? LIMIT 1").get(job.id)
      || fs.existsSync(artifact)) {
      throw new Error("go_reset_job_id_already_used");
    }
    const routerConfig = loadRouterConfig(runtimeRoot);
    const classification = classifyJob(job, { db });
    route = routeJob(job, classification, routerConfig.models, { db });
    if (route.handle !== GO_RESET_ROUTE) throw new Error(`unexpected_go_route (${route.handle})`);
    assertJobAuthority(job);
    const budget = evaluateBudget({ db, provider: "opencode", budgetConfig: routerConfig.budget, job, route });
    if (budget.allowed !== true) {
      const error = new Error(budget.reason || "budget_blocked");
      error.code = budget.reason || "budget_blocked";
      throw error;
    }
    const reservation = reserveExecution(db, {
      jobId: job.id,
      resourceClass: "light",
      provider: "opencode",
      processKind: "go_reset_single_call",
      deadlineAt,
    });
    if (reservation.allowed !== true) throw new Error(reservation.reason || "reservation_blocked");
    reserved = true;
    recordJobLifecycle(db, { jobId: job.id, state: "routed", modelHandle: route.handle });
    recordJobLifecycle(db, {
      jobId: job.id,
      state: "dispatch",
      modelHandle: route.handle,
      iterationCeiling: 1,
      deadlineAt,
    });
    const resolved = resolveModelConfig(routerConfig.models, route.handle);
    const routerEnvironment = loadRouterEnvironment(runtimeRoot);
    const adapter = createOpenCodeAdapter({
      apiKey: routerEnvironment.get("OPENCODE_GO_API_KEY") || routerEnvironment.get("OPENCODE_API_KEY"),
      baseUrl: routerEnvironment.get("OPENCODE_BASE_URL") || resolved.provider.base_url,
      model: route.handle.slice("opencode/".length),
      protocol: resolved.model.protocol,
      db,
      ratecard: routerConfig.ratecard.per_million_tokens?.[route.handle],
      timeoutMs: 120_000,
      fetchImpl: async (...fetchArgs) => {
        fetchCalls += 1;
        if (fetchCalls > 1) throw Object.assign(new Error("single_cloud_call_ceiling_exceeded"), { code: "single_cloud_call_ceiling_exceeded" });
        return globalThis.fetch(...fetchArgs);
      },
    });
    adapter.setContext({
      jobId: job.id,
      runId: `${job.id}-run-1`,
      agentKey: "inbox.local",
      taskType: "inbox.draft",
    });
    const result = await inboxSpec.run({ llm: adapter }, job);
    if (fetchCalls !== 1) throw new Error(`single_cloud_call_count_invalid (${fetchCalls})`);
    inspectOpenCodeBudget(db, routerConfig.budget);
    if (result.send !== false || result.requires_human_review !== true
      || result.validation?.outbound_authority !== false) {
      throw Object.assign(new Error("inbox_authority_result_invalid"), { code: "authority_blocked" });
    }
    const artifactDir = path.join(runtimeRoot, "state", "artifacts");
    fs.mkdirSync(artifactDir, { recursive: true });
    fs.writeFileSync(artifact, `${JSON.stringify({
      schema_version: 1,
      job_id: job.id,
      synthetic: true,
      production_access: false,
      production_mutation: false,
      outbound_send: false,
      cloud_calls: fetchCalls,
      route: route.handle,
      model: adapter.model,
      result,
      completed_at: new Date().toISOString(),
    }, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    recordRoutingOutcome(db, {
      jobType: job.job_type,
      scopeFingerprint: classification.scopeFingerprint,
      model: route.handle,
      outcome: "succeeded",
    });
    recordJobLifecycle(db, { jobId: job.id, state: "completed", modelHandle: route.handle, iterationCount: 1 });
    process.stdout.write(`${JSON.stringify({ job_id: job.id, route: route.handle, model: adapter.model, cloud_calls: fetchCalls, artifact }, null, 2)}\n`);
  } catch (error) {
    const failureClass = safeFailureClass(error);
    if (route) {
      recordRoutingOutcome(db, {
        jobType: job.job_type,
        scopeFingerprint: route.scopeFingerprint,
        model: route.handle,
        outcome: "failed",
        failureClass,
      });
      recordJobLifecycle(db, { jobId: job.id, state: "failed", modelHandle: route.handle, iterationCount: fetchCalls });
    }
    throw error;
  } finally {
    if (reserved) releaseExecution(db, job.id, { allowUnbound: true });
    db.close();
  }
}

main().catch((error) => {
  process.stderr.write(`go reset test failed [${safeFailureClass(error)}]: ${String(error?.message || error).slice(0, 500)}\n`);
  process.exit(1);
});

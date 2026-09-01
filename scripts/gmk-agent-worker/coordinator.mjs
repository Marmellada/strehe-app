// Live execution requires operator-provisioned router config under <runtime-root>/config/
// and <runtime-root>/.env.gmk-router.local; repository examples are templates only.
import path from "node:path";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { readEnv, requireValue } from "./lib/env.mjs";
import { getCredential } from "./lib/credential.mjs";
import { createAgentClient, signInAgent } from "./lib/supabase.mjs";
import { openDatabase } from "./lib/sqlite.mjs";
import { loadRouterConfig, loadRouterEnvironment, ROUTER_CONFIG_FILENAMES } from "./lib/router/config.mjs";
import { classifyJob } from "./lib/router/classify.mjs";
import { createDispatchPlan, DISPATCH_KIND, recordDispatchSelection } from "./lib/dispatch.mjs";
import { selectCoordinatorJob } from "./lib/job-selection.mjs";
import { assertJobAuthority } from "./lib/router/authority.mjs";
import { recordCoordinatorEvent, recordJobLifecycle, recordLlmUsage, recordRoutingOutcome } from "./lib/ledger.mjs";
import { recordBlockedCoordinator } from "./lib/blocked-artifact.mjs";
import { evaluateHealth, shouldRejectLocalInference } from "./lib/health.mjs";
import { evaluateBudget } from "./lib/budget.mjs";
import {
  bindReservationWorker,
  DEFAULT_EXECUTION_LIMITS,
  reconcileOrphanedCodexReservations,
  releaseExecutionAfterResult,
  reserveExecution,
  runBoundedProcess,
} from "./lib/scheduler.mjs";
import { createCodexAdapter } from "./lib/llm/codex.mjs";
import { assertCodexPersistableResult } from "./lib/codex-runner.mjs";
import { readEngineeringControl } from "./lib/proactive.mjs";
import inboxSpec from "./agents/inbox.spec.mjs";
import { deterministicFailureClass, parseFatalFailureClass } from "./lib/failure-class.mjs";
import {
  acquireOvernightSession,
  assertOvernightJobAuthority,
  dispatchOvernightChild,
  inspectCapabilityState,
  runOvernightLoop,
  runOvernightPreflight,
  validateOvernightLimits,
} from "./lib/overnight.mjs";

const AGENTS = Object.freeze({
  engineering: { capability: "engineering.local", resourceClass: "heavy" },
  inbox: { capability: "inbox.analyze", resourceClass: "light" },
});

function parseArgs(argv) {
  let agent = "engineering";
  let once = false;
  let overnight = false;
  let jobId = null;
  const overnightLimits = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--once") once = true;
    else if (arg === "--overnight") overnight = true;
    else if (arg === "--agent" && argv[index + 1]) agent = argv[++index];
    else if (arg.startsWith("--agent=")) agent = arg.slice("--agent=".length);
    else if (arg === "--job-id" && argv[index + 1]) jobId = argv[++index];
    else if (arg.startsWith("--job-id=")) jobId = arg.slice("--job-id=".length);
    else if (arg === "--overnight-wall-clock-minutes" && argv[index + 1]) overnightLimits.wallClockMs = Number(argv[++index]) * 60_000;
    else if (arg.startsWith("--overnight-wall-clock-minutes=")) overnightLimits.wallClockMs = Number(arg.slice(arg.indexOf("=") + 1)) * 60_000;
    else if (arg === "--overnight-cadence-seconds" && argv[index + 1]) overnightLimits.cadenceMs = Number(argv[++index]) * 1000;
    else if (arg.startsWith("--overnight-cadence-seconds=")) overnightLimits.cadenceMs = Number(arg.slice(arg.indexOf("=") + 1)) * 1000;
    else if (arg === "--overnight-max-jobs" && argv[index + 1]) overnightLimits.maxJobs = Number(argv[++index]);
    else if (arg.startsWith("--overnight-max-jobs=")) overnightLimits.maxJobs = Number(arg.slice(arg.indexOf("=") + 1));
    else if (arg === "--overnight-retry-limit" && argv[index + 1]) overnightLimits.identicalFailureLimit = Number(argv[++index]);
    else if (arg.startsWith("--overnight-retry-limit=")) overnightLimits.identicalFailureLimit = Number(arg.slice(arg.indexOf("=") + 1));
  }
  return { agent, once, overnight, jobId, overnightLimits };
}

function childEnvironment() {
  const keys = [
    "SystemRoot", "SYSTEMROOT", "PATH", "Path", "PATHEXT", "TEMP", "TMP",
    "USERPROFILE", "ComSpec", "COMSPEC", "ProgramData", "ProgramFiles",
    "ProgramFiles(x86)", "LOCALAPPDATA", "APPDATA", "HOMEDRIVE", "HOMEPATH",
    "GMK_ENV_FILE", "GMK_RUNTIME_ROOT", "GMK_WORKTREE_PATH",
    "GMK_OVERNIGHT_SESSION_ID",
    "GMK_LEASE_SECONDS", "GMK_OLLAMA_TIMEOUT_MS", "GMK_OLLAMA_NUM_GPU",
    "OPENCODE_GO_API_KEY", "OPENCODE_API_KEY", "OPENCODE_BASE_URL",
  ];
  const env = {};
  for (const key of keys) if (process.env[key] !== undefined) env[key] = process.env[key];
  return env;
}

function runWorker({ agent, jobId, dispatchKind, modelHandle, timeoutMs, llmCallCeiling, runtimeRoot }) {
  const dispatchArgs = dispatchKind === DISPATCH_KIND.DETERMINISTIC
    ? ["--dispatch-kind", DISPATCH_KIND.DETERMINISTIC]
    : [
        "--dispatch-kind", DISPATCH_KIND.MODEL,
        "--model-handle", modelHandle,
        "--llm-call-ceiling", String(llmCallCeiling),
      ];
  return runBoundedProcess({
    command: process.execPath,
    args: [
      path.resolve(process.cwd(), "scripts", "gmk-agent-worker", "worker.mjs"),
      "--agent", agent,
      "--once",
      "--job-id", jobId,
      ...dispatchArgs,
    ],
    options: {
      cwd: process.cwd(),
      shell: false,
      windowsHide: true,
      env: { ...childEnvironment(), GMK_RUNTIME_ROOT: runtimeRoot },
      stdio: ["ignore", "pipe", "pipe"],
    },
    timeoutMs,
  });
}

function providerFromHandle(handle) {
  return handle.includes("/") ? handle.split("/", 1)[0] : handle;
}

function gateError(gate) {
  const error = new Error(`${gate.reason}: ${JSON.stringify(gate.evidence || gate.windows || gate.error || {})}`);
  error.code = gate.reason;
  error.gate = gate;
  return error;
}

function startCodexLeaseRenewal(supabase, jobId, leaseSeconds, db) {
  const intervalMs = Math.max(1000, Math.floor((leaseSeconds * 1000) / 3));
  const timer = setInterval(async () => {
    try {
      const { error } = await supabase.rpc("renew_agent_job_lease", {
        target_job_id: jobId,
        lease_seconds: leaseSeconds,
      });
      if (error) throw error;
    } catch (error) {
      recordCoordinatorEvent(db, "codex_lease_renew_failed", {
        job_id: jobId,
        error: String(error?.message || error).slice(0, 500),
      });
    }
  }, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}

async function dispatchCodex({
  supabase,
  db,
  job,
  runtimeRoot,
  sourceWorktree,
  configuredCli,
  timeoutMs,
}) {
  const leaseSeconds = 300;
  const { data: claimed, error: claimError } = await supabase.rpc("claim_agent_job", {
    target_job_id: job.id,
    lease_seconds: leaseSeconds,
  });
  if (claimError || !claimed) {
    const error = new Error(`Codex claim failed: ${claimError?.message || "claim race lost"}`);
    error.code = "claim_race_lost";
    throw error;
  }
  const stopRenewal = startCodexLeaseRenewal(supabase, claimed.id, leaseSeconds, db);
  const adapter = createCodexAdapter({
    runtimeRoot,
    sourceWorktree,
    configuredCli,
    timeoutMs,
    onSpawn(child) {
      return bindReservationWorker(db, { jobId: claimed.id, workerPid: child.pid });
    },
  });
  let result;
  try {
    result = await adapter.execute({ job: claimed });
  } finally {
    stopRenewal();
  }
  if (result.invocation?.pid) {
    recordLlmUsage(db, {
      provider: "codex",
      model: "codex-cli",
      jobId: claimed.id,
      runId: claimed.run_id || null,
      agentKey: "engineering.local",
      taskType: claimed.job_type,
      apiCalls: 1,
      costStatus: "run_counted",
      durationMs: result.duration_ms,
    });
  }
  if (result.final_status === "success") {
    assertCodexPersistableResult(result);
    const { error: completeError } = await supabase.rpc("complete_agent_job", {
      target_job_id: claimed.id,
      job_result: result,
    });
    if (completeError) {
      const error = new Error(`Codex result completion failed: ${completeError.message}`);
      error.code = "codex_complete_failed";
      throw error;
    }
    return result;
  }
  const failureCode = String(result.failure_code || `codex_${result.final_status}`).slice(0, 120);
  const { error: failError } = await supabase.rpc("fail_agent_job", {
    target_job_id: claimed.id,
    failure_code: failureCode,
    failure_message: String(result.failure_message || `Codex finished with ${result.final_status}`).slice(0, 4000),
  });
  if (failError) {
    recordCoordinatorEvent(db, "codex_fail_rpc_error", {
      job_id: claimed.id,
      error: String(failError.message || failError).slice(0, 500),
    });
  }
  const error = new Error(`Codex finished with ${result.final_status}: ${failureCode}`);
  error.code = failureCode;
  error.codexResult = result;
  throw error;
}

function gitHead(worktreePath) {
  return String(execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: worktreePath, encoding: "utf8", timeout: 30_000, windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  })).trim();
}

async function signedAgent(agentName, suppliedEnv = null) {
  const env = suppliedEnv || readEnv(path.resolve(process.cwd(), `.env.gmk-${agentName}.local`));
  const supabase = createAgentClient(requireValue(env, "SUPABASE_URL"), requireValue(env, "SUPABASE_ANON_KEY"));
  const auth = await signInAgent(
    supabase,
    requireValue(env, "SUPABASE_AGENT_EMAIL"),
    getCredential(env.get("GMK_CREDENTIAL_TARGET") || `strehe-agent-${agentName}`),
  );
  return { agentName, env, supabase, agentId: auth.user.id };
}

function providerCredentialsPresent(routerConfig, routerEnvironment) {
  if (routerConfig.models.providers.opencode?.enabled === true
    && !String(routerEnvironment.get("OPENCODE_GO_API_KEY") || routerEnvironment.get("OPENCODE_API_KEY") || "").trim()) {
    return false;
  }
  if (routerConfig.models.providers.codex?.enabled === true) {
    const cli = String(routerConfig.models.providers.codex.cli || "codex");
    try {
      execFileSync(process.platform === "win32" ? "where.exe" : "which", [cli], {
        encoding: "utf8", timeout: 10_000, windowsHide: true,
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {
      return false;
    }
    const authRoot = process.env.CODEX_HOME || path.join(process.env.USERPROFILE || "", ".codex");
    if (!authRoot || !fs.existsSync(path.join(authRoot, "auth.json"))) return false;
  }
  return true;
}

const SESSION_BLOCKING_CODES = new Set([
  "authority_blocked", "budget_hard", "budget_paused", "budget_metering_fault",
  "budget_state_unavailable", "health_sampling_error", "health_low_disk",
  "health_low_memory", "health_high_cpu", "health_ollama_active",
  "concurrency_state_unavailable", "reservation_liveness_unknown",
  "reservation_process_unresolved", "watchdog_termination_unconfirmed",
  "worktree_dirty", "push_protection_missing", "operator_paused",
  "operator_control_unavailable",
]);

async function runOvernightMain(args) {
  const limits = validateOvernightLimits(args.overnightLimits);
  const engineeringEnv = readEnv(path.resolve(process.cwd(), ".env.gmk-engineering.local"));
  const envGet = (key) => engineeringEnv.get(key) ?? process.env[key];
  const runtimeRoot = path.resolve(envGet("GMK_RUNTIME_ROOT") || path.resolve(process.cwd(), "..", ".."));
  const worktreePath = path.resolve(envGet("GMK_WORKTREE_PATH") || process.cwd());
  const { db } = openDatabase(runtimeRoot);
  let stopping = false;
  const stop = () => { stopping = true; };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  try {
    let startingCommit = "UNVERIFIED";
    try { startingCommit = gitHead(worktreePath); } catch {}
    const session = acquireOvernightSession(db, { startingCommit });
    recordCoordinatorEvent(db, session.recovered ? "overnight_session_recovered" : "overnight_session_started", {
      session_id: session.session_id,
      starting_commit: startingCommit,
      limits,
    });
    let routerConfig;
    let routerEnvironment;
    let engineering;
    let inbox;
    try {
      routerConfig = loadRouterConfig(runtimeRoot);
      routerEnvironment = loadRouterEnvironment(runtimeRoot);
      engineering = await signedAgent("engineering", engineeringEnv);
      inbox = await signedAgent("inbox");
    } catch (error) {
      const setupError = new Error("overnight preflight configuration or agent authentication is unavailable");
      setupError.code = String(error?.message || "").includes("router config")
        ? "router_config_invalid"
        : "agent_credentials_unavailable";
      const outcome = await runOvernightLoop({
        db, runtimeRoot, session,
        preflight: async () => { throw setupError; },
        selectJob: async () => null,
        dispatchJob: async () => ({ status: "session_blocked" }),
        limits,
      });
      if (outcome.status === "BLOCKED") process.exitCode = 2;
      return;
    }
    let canaryPending = true;
    const clients = [
      { ...engineering, ...AGENTS.engineering },
      { ...inbox, ...AGENTS.inbox },
    ];
    const reconcileCodex = () => reconcileOrphanedCodexReservations(db, {
      async getJobLeaseState(jobId) {
        for (const client of clients) {
          const { data, error } = await client.supabase.from("agent_jobs")
            .select("id,status,lease_expires_at").eq("id", jobId).maybeSingle();
          if (error) throw error;
          if (data) return data;
        }
        return null;
      },
    });
    const inspectCurrentJob = async () => {
      const current = db.prepare("SELECT current_job FROM overnight_sessions WHERE session_id = ?")
        .get(session.session_id)?.current_job;
      if (!current) return { allowed: true, reason: "no_active_job" };
      for (const client of clients) {
        const { data, error } = await client.supabase.from("agent_jobs")
          .select("id,status,lease_expires_at").eq("id", current).maybeSingle();
        if (error) return { allowed: false, reason: "active_job_state_unknown" };
        if (!data) continue;
        if (data.status === "running") {
          return { allowed: false, reason: "active_job_may_still_run", job_id: current, lease_expires_at: data.lease_expires_at };
        }
        return { allowed: true, reason: "previous_job_not_running", job_id: current, status: data.status };
      }
      return { allowed: false, reason: "active_job_state_unknown", job_id: current };
    };
    const preflight = async () => {
      const result = await runOvernightPreflight({
        db, runtimeRoot, worktreePath, expectedWorktree: path.resolve(process.cwd()), expectedCommit: startingCommit,
        routerConfig, sessionId: session.session_id,
        requiredConfigFiles: Object.values(ROUTER_CONFIG_FILENAMES),
        credentialsPresent: () => providerCredentialsPresent(routerConfig, routerEnvironment),
        readOperatorControl: () => readEngineeringControl({
          supabase: engineering.supabase, agentId: engineering.agentId,
        }),
        reconcileCodex,
        inspectCurrentJob,
        capabilityInspector: () => inspectCapabilityState(process.env, {
          inboxTools: inboxSpec.tools,
          inboxJobTypes: inboxSpec.jobTypes,
        }),
        runCanary: canaryPending,
      });
      canaryPending = false;
      return result;
    };
    const selectJob = async () => {
      const candidates = [];
      for (const client of clients) {
        const job = await selectCoordinatorJob(client.supabase, client.capability);
        if (job) candidates.push({ ...job, agentName: client.agentName, client });
      }
      candidates.sort((left, right) => Number(left.priority) - Number(right.priority)
        || String(left.created_at).localeCompare(String(right.created_at)));
      return candidates[0] || null;
    };
    const dispatchJob = async (job) => {
      assertOvernightJobAuthority(job);
      const classification = classifyJob(job, { db });
      const route = createDispatchPlan(job, classification, routerConfig.models, { db });
      const timeoutMs = job.agentName === "engineering" ? 46 * 60 * 1000 : 16 * 60 * 1000;
      const result = await dispatchOvernightChild({
        readOperatorControl: () => readEngineeringControl({
          supabase: engineering.supabase, agentId: engineering.agentId,
        }),
        spawnChild: () => runBoundedProcess({
          command: process.execPath,
          args: [
            path.resolve(process.cwd(), "scripts", "gmk-agent-worker", "coordinator.mjs"),
            "--once", "--agent", job.agentName, "--job-id", String(job.id),
          ],
          options: {
            cwd: process.cwd(), shell: false, windowsHide: true,
            env: {
              ...childEnvironment(),
              GMK_RUNTIME_ROOT: runtimeRoot,
              GMK_WORKTREE_PATH: worktreePath,
              GMK_OVERNIGHT_SESSION_ID: session.session_id,
            },
            stdio: ["ignore", "pipe", "pipe"],
          },
          timeoutMs,
        }),
      });
      if (result.processMayBeAlive === true || (result.timedOut && result.terminationConfirmed !== true)) {
        return { status: "session_blocked", failureClass: "watchdog_termination_unconfirmed", processMayBeAlive: true };
      }
      const { data: durable, error } = await job.client.supabase.from("agent_jobs")
        .select("id,status,attempt_count").eq("id", job.id).maybeSingle();
      if (error || !durable) return { status: "session_blocked", failureClass: "job_state_unavailable" };
      if (["completed", "awaiting_review"].includes(durable.status)) {
        return {
          status: "succeeded",
          provider: route.kind === DISPATCH_KIND.DETERMINISTIC
            ? "deterministic"
            : route.handle === "codex" ? "codex" : providerFromHandle(route.handle),
          model: route.kind === DISPATCH_KIND.DETERMINISTIC
            ? "none"
            : route.handle === "codex" ? "codex-cli" : route.handle.split("/").slice(1).join("/"),
        };
      }
      const fatal = parseFatalFailureClass(result.stderr, "coordinator");
      if (fatal && SESSION_BLOCKING_CODES.has(fatal)) {
        return { status: "session_blocked", failureClass: fatal, message: `dispatch stopped at ${fatal}` };
      }
      return { status: "retryable_failure", failureClass: fatal || `job_${durable.status}` };
    };
    const outcome = await runOvernightLoop({
      db, runtimeRoot, session, preflight, selectJob, dispatchJob, limits,
      shouldStop: () => stopping,
    });
    if (outcome.status === "BLOCKED") process.exitCode = 2;
  } finally {
    db.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.overnight) {
    if (args.once) throw new Error("--overnight and --once are mutually exclusive");
    await runOvernightMain(args);
    return;
  }
  if (!args.once) throw new Error("coordinator requires explicit --once or --overnight activation");
  const agent = AGENTS[args.agent];
  if (!agent) throw new Error(`unknown agent: ${args.agent}`);

  const envPath = process.env.GMK_ENV_FILE
    || path.resolve(process.cwd(), `.env.gmk-${args.agent}.local`);
  const env = readEnv(envPath);
  const envGet = (key) => env.get(key) ?? process.env[key];
  const runtimeRoot = path.resolve(envGet("GMK_RUNTIME_ROOT") || path.resolve(process.cwd(), "..", ".."));
  const { db } = openDatabase(runtimeRoot);
  const routerConfig = loadRouterConfig(runtimeRoot);

  try {
    const supabase = createAgentClient(
      requireValue(env, "SUPABASE_URL"),
      requireValue(env, "SUPABASE_ANON_KEY"),
    );
    const credentialTarget = env.get("GMK_CREDENTIAL_TARGET") || `strehe-agent-${args.agent}`;
    await signInAgent(
      supabase,
      requireValue(env, "SUPABASE_AGENT_EMAIL"),
      getCredential(credentialTarget),
    );
    const orphanEvidence = await reconcileOrphanedCodexReservations(db, {
      async getJobLeaseState(jobId) {
        const { data, error } = await supabase
          .from("agent_jobs")
          .select("id, status, lease_expires_at")
          .eq("id", jobId)
          .maybeSingle();
        if (error) throw error;
        return data ?? null;
      },
    });
    for (const entry of orphanEvidence) {
      recordCoordinatorEvent(db, `codex_orphan_${entry.action}`, {
        job_id: entry.jobId,
        worker_pid: entry.workerPid,
        reason: entry.reason,
        error: entry.error || null,
        reservation_retained: entry.action !== "released",
      });
    }
    const job = await selectCoordinatorJob(supabase, agent.capability, args.jobId);
    if (!job) {
      recordCoordinatorEvent(db, "coordinator_idle", { agent: args.agent });
      return;
    }

    let health = null;
    let budget = null;
    let concurrency = null;
    let reservationHeld = false;
    let workerResult = null;
    let route = null;
    let classification = null;
    let dispatchedViaCodex = false;
    try {
      classification = classifyJob(job, { db });
      route = createDispatchPlan(job, classification, routerConfig.models, { db });
      recordDispatchSelection(db, job, route);

      health = await evaluateHealth({
        runtimeRoot,
        resourceClass: route.resourceClass || agent.resourceClass,
        rejectLocalInference: shouldRejectLocalInference({ overnight: args.overnight }),
      });
      recordCoordinatorEvent(db, health.allowed ? "health_green" : health.reason, {
        job_id: job.id,
        resource_class: route.resourceClass || agent.resourceClass,
        evidence: health.evidence,
      });
      if (!health.allowed) throw gateError(health);

      const provider = route.kind === DISPATCH_KIND.DETERMINISTIC
        ? route.provider
        : providerFromHandle(route.handle);
      if (route.kind === DISPATCH_KIND.MODEL) {
        budget = evaluateBudget({ db, provider, budgetConfig: routerConfig.budget, job, route });
        if (!budget.allowed) throw gateError(budget);
      }

      assertJobAuthority(job);

      const isCodex = route.kind === DISPATCH_KIND.MODEL && route.handle === "codex";
      const executionLimits = route.kind === DISPATCH_KIND.DETERMINISTIC
        ? { wallClockMs: route.wallClockMs, llmCallCeiling: route.llmCallCeiling }
        : DEFAULT_EXECUTION_LIMITS[isCodex ? "codex" : agent.resourceClass];
      const deadlineAt = new Date(Date.now() + executionLimits.wallClockMs).toISOString();
      concurrency = reserveExecution(db, {
        jobId: job.id,
        resourceClass: isCodex ? "heavy" : route.resourceClass || agent.resourceClass,
        provider,
        processKind: isCodex ? "codex" : "worker",
        deadlineAt,
      });
      if (!concurrency.allowed) throw gateError(concurrency);
      reservationHeld = true;
      recordJobLifecycle(db, {
        jobId: job.id,
        state: "dispatch",
        modelHandle: route.handle,
        iterationCeiling: executionLimits.llmCallCeiling,
        deadlineAt,
      });
      dispatchedViaCodex = isCodex;
      const worker = isCodex
        ? await dispatchCodex({
          supabase,
          db,
          job,
          runtimeRoot,
          sourceWorktree: path.resolve(envGet("GMK_WORKTREE_PATH") || process.cwd()),
          configuredCli: routerConfig.models.providers.codex.cli,
          timeoutMs: executionLimits.wallClockMs,
        }).then((result) => ({
          ok: result.final_status === "success",
          code: result.exit_code,
          timedOut: result.timeout_state,
          terminationConfirmed: result.termination_confirmed,
          processMayBeAlive: result.process_may_be_alive,
          pid: result.invocation?.pid ?? null,
          stdout: "",
          stderr: result.failure_message || "",
          codexResult: result,
        }), (error) => {
          const result = error.codexResult;
          if (result) {
            workerResult = {
              ok: false,
              code: result.exit_code,
              timedOut: result.timeout_state,
              terminationConfirmed: result.termination_confirmed,
              processMayBeAlive: result.process_may_be_alive,
              pid: result.invocation?.pid ?? null,
              stdout: "",
              stderr: result.failure_message || error.message,
              codexResult: result,
            };
            recordJobLifecycle(db, {
              jobId: job.id,
              state: result.final_status,
              modelHandle: route.handle,
              deadlineAt,
            });
            if (result.final_status === "termination_unconfirmed") {
              recordCoordinatorEvent(db, "watchdog_termination_unconfirmed", {
                job_id: job.id,
                worker_pid: result.invocation?.pid ?? null,
                reservation_retained: true,
                process_kind: "codex",
              });
            } else if (result.timeout_state) {
              recordCoordinatorEvent(db, "watchdog_timeout", {
                job_id: job.id,
                model_handle: route.handle,
                wall_clock_ms: executionLimits.wallClockMs,
                timeout_reason: result.timeout_reason,
                process_kind: "codex",
              });
            }
          }
          throw error;
        })
        : await runWorker({
          agent: args.agent,
          jobId: job.id,
          dispatchKind: route.kind,
          modelHandle: route.handle,
          timeoutMs: executionLimits.wallClockMs,
          llmCallCeiling: executionLimits.llmCallCeiling,
          runtimeRoot,
        });
      workerResult = worker;
      if (worker.timedOut && !worker.terminationConfirmed) {
        concurrency = {
          ...concurrency,
          worker_pid: worker.pid,
          terminationConfirmed: false,
          processMayBeAlive: true,
        };
        recordCoordinatorEvent(db, "watchdog_termination_unconfirmed", {
          job_id: job.id,
          worker_pid: worker.pid,
          reservation_retained: true,
        });
      }
      recordJobLifecycle(db, {
        jobId: job.id,
        state: worker.timedOut ? "wall_clock_exceeded" : worker.ok ? "worker_exited" : "worker_failed",
        modelHandle: route.handle,
      });
      if (worker.timedOut) {
        recordCoordinatorEvent(db, "watchdog_timeout", {
          job_id: job.id,
          model_handle: route.handle,
          wall_clock_ms: executionLimits.wallClockMs,
        });
        const { error: failError } = await supabase.rpc("fail_agent_job", {
          target_job_id: job.id,
          failure_code: "wall_clock_exceeded",
          failure_message: `Coordinator wall-clock deadline exceeded after ${executionLimits.wallClockMs} ms`,
        });
        if (failError) {
          recordCoordinatorEvent(db, "watchdog_fail_rpc_error", {
            job_id: job.id,
            error: String(failError.message || failError).slice(0, 500),
          });
        }
        const error = new Error(`worker exceeded wall-clock deadline (${executionLimits.wallClockMs} ms)`);
        error.code = "wall_clock_exceeded";
        throw error;
      }
      if (!worker.ok) {
        const error = new Error(`worker exited ${worker.code ?? "before start"}: ${(worker.stderr || worker.stdout || "no output").slice(-1000)}`);
        error.code = parseFatalFailureClass(worker.stderr, "worker") || "worker_dispatch_failed";
        throw error;
      }
    } catch (error) {
      const code = deterministicFailureClass(error, "coordinator_failed");
      if (dispatchedViaCodex && route && classification) {
        recordRoutingOutcome(db, {
          jobType: job.job_type,
          scopeFingerprint: classification.scopeFingerprint,
          model: route.handle,
          outcome: "failed",
          failureClass: code,
        });
      }
      const reason = `${code}: ${error instanceof Error ? error.message : String(error)}`;
      if (!process.env.GMK_OVERNIGHT_SESSION_ID) {
        recordBlockedCoordinator(db, runtimeRoot, {
          job,
          reason,
          attempted: route?.kind === DISPATCH_KIND.DETERMINISTIC
            ? ["classify", "deterministic dispatch selection", "health gate", "authority gate", "bounded dispatch"]
            : ["classify", "route", "health gate", "budget gate", "authority gate", "bounded dispatch"],
          health,
          budget,
          concurrency,
          resumeCommand: `node scripts/gmk-agent-worker/coordinator.mjs --once --agent ${args.agent} --job-id ${job.id}`,
        });
      } else {
        recordCoordinatorEvent(db, "overnight_dispatch_failed", {
          session_id: process.env.GMK_OVERNIGHT_SESSION_ID,
          job_id: job?.id || null,
          reason: code,
        });
      }
      throw error;
    } finally {
      if (reservationHeld && workerResult?.processMayBeAlive !== true) {
        if (!releaseExecutionAfterResult(db, job.id, workerResult)) {
          recordCoordinatorEvent(db, "concurrency_release_failed", { job_id: job.id });
        }
      } else if (reservationHeld) {
        recordCoordinatorEvent(db, "concurrency_reservation_retained", {
          job_id: job.id,
          reason: "worker_process_liveness_unconfirmed",
        });
      }
    }
  } finally {
    db.close();
  }
}

main().catch((error) => {
  process.stderr.write(`coordinator fatal [${error?.code || "coordinator_failed"}]: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});

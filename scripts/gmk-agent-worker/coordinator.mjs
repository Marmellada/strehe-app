// Live execution requires operator-provisioned router config under <runtime-root>/config/
// and <runtime-root>/.env.gmk-router.local; repository examples are templates only.
import path from "node:path";
import { readEnv, requireValue } from "./lib/env.mjs";
import { getCredential } from "./lib/credential.mjs";
import { createAgentClient, signInAgent } from "./lib/supabase.mjs";
import { openDatabase } from "./lib/sqlite.mjs";
import { loadRouterConfig } from "./lib/router/config.mjs";
import { classifyJob } from "./lib/router/classify.mjs";
import { routeJob } from "./lib/router/route.mjs";
import { assertJobAuthority } from "./lib/router/authority.mjs";
import { recordCoordinatorEvent, recordJobLifecycle } from "./lib/ledger.mjs";
import { recordBlockedCoordinator } from "./lib/blocked-artifact.mjs";
import { evaluateHealth } from "./lib/health.mjs";
import { evaluateBudget } from "./lib/budget.mjs";
import {
  DEFAULT_EXECUTION_LIMITS,
  releaseExecutionAfterResult,
  reserveExecution,
  runBoundedProcess,
} from "./lib/scheduler.mjs";

const AGENTS = Object.freeze({
  engineering: { capability: "engineering.local", resourceClass: "heavy" },
});

function parseArgs(argv) {
  let agent = "engineering";
  let once = false;
  let overnight = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--once") once = true;
    else if (arg === "--overnight") overnight = true;
    else if (arg === "--agent" && argv[index + 1]) agent = argv[++index];
    else if (arg.startsWith("--agent=")) agent = arg.slice("--agent=".length);
  }
  return { agent, once, overnight };
}

function childEnvironment() {
  const keys = [
    "SystemRoot", "SYSTEMROOT", "PATH", "Path", "PATHEXT", "TEMP", "TMP",
    "USERPROFILE", "ComSpec", "COMSPEC", "ProgramData", "ProgramFiles",
    "ProgramFiles(x86)", "LOCALAPPDATA", "APPDATA", "HOMEDRIVE", "HOMEPATH",
    "GMK_ENV_FILE", "GMK_RUNTIME_ROOT", "GMK_WORKTREE_PATH",
    "GMK_LEASE_SECONDS", "GMK_OLLAMA_TIMEOUT_MS", "GMK_OLLAMA_NUM_GPU",
    "OPENCODE_GO_API_KEY", "OPENCODE_API_KEY", "OPENCODE_BASE_URL",
  ];
  const env = {};
  for (const key of keys) if (process.env[key] !== undefined) env[key] = process.env[key];
  return env;
}

function runWorker({ agent, jobId, modelHandle, timeoutMs, llmCallCeiling, runtimeRoot }) {
  return runBoundedProcess({
    command: process.execPath,
    args: [
      path.resolve(process.cwd(), "scripts", "gmk-agent-worker", "worker.mjs"),
      "--agent", agent,
      "--once",
      "--job-id", jobId,
      "--model-handle", modelHandle,
      "--llm-call-ceiling", String(llmCallCeiling),
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

async function queuedJob(supabase, capability) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("agent_jobs")
    .select("id, payload, job_type, priority, created_at, attempt_count, max_attempts, requires_review, workspace_type")
    .eq("required_capability", capability)
    .eq("status", "queued")
    .lte("available_at", now)
    .gt("expires_at", now)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.once || args.overnight) {
    throw new Error("P2 coordinator supports --once only; Overnight Mode starts in P6");
  }
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
    const job = await queuedJob(supabase, agent.capability);
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
    try {
      const classification = classifyJob(job, { db });
      route = routeJob(job, classification, routerConfig.models, { db });
      recordJobLifecycle(db, { jobId: job.id, state: "routed", modelHandle: route.handle });
      recordCoordinatorEvent(db, "job_routed", {
        job_id: job.id,
        job_type: job.job_type,
        model_handle: route.handle,
        complexity: route.complexity,
        risk_class: route.riskClass,
      });

      health = await evaluateHealth({
        runtimeRoot,
        resourceClass: agent.resourceClass,
        rejectLocalInference: args.overnight,
      });
      recordCoordinatorEvent(db, health.allowed ? "health_green" : health.reason, {
        job_id: job.id,
        resource_class: agent.resourceClass,
        evidence: health.evidence,
      });
      if (!health.allowed) throw gateError(health);

      const provider = providerFromHandle(route.handle);
      budget = evaluateBudget({ db, provider, budgetConfig: routerConfig.budget, job, route });
      if (!budget.allowed) throw gateError(budget);

      assertJobAuthority(job);

      if (route.handle === "codex") {
        const error = new Error("Codex execution starts in P4; P2 refuses to dispatch this route");
        error.code = "provider_not_implemented";
        throw error;
      }

      const executionLimits = DEFAULT_EXECUTION_LIMITS[agent.resourceClass];
      const deadlineAt = new Date(Date.now() + executionLimits.wallClockMs).toISOString();
      concurrency = reserveExecution(db, {
        jobId: job.id,
        resourceClass: agent.resourceClass,
        provider,
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
      const worker = await runWorker({
        agent: args.agent,
        jobId: job.id,
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
        error.code = "worker_dispatch_failed";
        throw error;
      }
    } catch (error) {
      const code = error?.code || "coordinator_failed";
      const reason = `${code}: ${error instanceof Error ? error.message : String(error)}`;
      recordBlockedCoordinator(db, runtimeRoot, {
        job,
        reason,
        attempted: ["classify", "route", "health gate", "budget gate", "authority gate", "bounded dispatch"],
        health,
        budget,
        concurrency,
        resumeCommand: `node scripts/gmk-agent-worker/coordinator.mjs --once --agent ${args.agent}`,
      });
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
  process.stderr.write(`coordinator fatal: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});

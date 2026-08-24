import path from "node:path";
import { readEnv, requireValue } from "./lib/env.mjs";
import { getCredential } from "./lib/credential.mjs";
import { createAgentClient, signInAgent, heartbeat } from "./lib/supabase.mjs";
import { createLogger } from "./lib/logging.mjs";
import { createToolGateway } from "./lib/tools.mjs";
import { publishEngineeringSnapshot } from "./lib/proactive.mjs";
import { processWorkerOnce, processWorkerPass } from "./lib/worker-pass.mjs";
import { createLlmRegistry } from "./lib/llm/registry.mjs";
import { bindReservationWorker, createCountingLlm } from "./lib/scheduler.mjs";
import { openDatabase } from "./lib/sqlite.mjs";
import { recordRoutingOutcome } from "./lib/ledger.mjs";
import { deterministicFailureClass } from "./lib/failure-class.mjs";

const AGENT_LOADERS = {
  engineering: () => import("./agents/engineering.spec.mjs").then((m) => m.default),
  inbox: () => import("./agents/inbox.spec.mjs").then((m) => m.default),
  growth: () => import("./agents/growth.spec.mjs").then((m) => m.default),
};

function parseArgs(argv) {
  let agent = "engineering";
  let once = false;
  let modelHandle = null;
  let jobId = null;
  let llmCallCeiling = null;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--once") once = true;
    else if (a === "--agent" && argv[i + 1]) { agent = argv[++i]; }
    else if (a.startsWith("--agent=")) agent = a.slice("--agent=".length);
    else if (a === "--model-handle" && argv[i + 1]) { modelHandle = argv[++i]; }
    else if (a.startsWith("--model-handle=")) modelHandle = a.slice("--model-handle=".length);
    else if (a === "--job-id" && argv[i + 1]) { jobId = argv[++i]; }
    else if (a.startsWith("--job-id=")) jobId = a.slice("--job-id=".length);
    else if (a === "--llm-call-ceiling" && argv[i + 1]) { llmCallCeiling = Number(argv[++i]); }
    else if (a.startsWith("--llm-call-ceiling=")) llmCallCeiling = Number(a.slice("--llm-call-ceiling=".length));
  }
  return { agent, once, modelHandle, jobId, llmCallCeiling };
}

function numOr(value, fallback, min) {
  const n = Number(value);
  return Number.isFinite(n) && n >= min ? n : fallback;
}

async function main() {
  const { agent, once, modelHandle, jobId, llmCallCeiling } = parseArgs(process.argv.slice(2));
  if (!AGENT_LOADERS[agent]) throw new Error(`unknown agent: ${agent}`);
  const spec = await AGENT_LOADERS[agent]();

  const envPath = process.env.GMK_ENV_FILE || path.resolve(process.cwd(), `.env.gmk-${agent}.local`);
  const env = readEnv(envPath);
  const logger = createLogger({ agent: spec.agentKey, capability: spec.capability });

  const envGet = (key) => env.get(key) ?? process.env[key];
  const runtimeRoot = envGet("GMK_RUNTIME_ROOT") || null;
  if (jobId) {
    if (!runtimeRoot) {
      const error = new Error("GMK_RUNTIME_ROOT is required for worker PID binding");
      error.code = "worker_pid_binding_failed";
      throw error;
    }
    const { db } = openDatabase(path.resolve(runtimeRoot));
    try {
      const binding = bindReservationWorker(db, { jobId, workerPid: process.pid });
      if (!binding.allowed) {
        const error = new Error("worker PID binding was rejected");
        error.code = "worker_pid_binding_failed";
        throw error;
      }
    } finally {
      db.close();
    }
  }

  const supabaseUrl = requireValue(env, "SUPABASE_URL");
  const anonKey = requireValue(env, "SUPABASE_ANON_KEY");
  const email = requireValue(env, "SUPABASE_AGENT_EMAIL");
  const credentialTarget = env.get("GMK_CREDENTIAL_TARGET") || `strehe-agent-${agent}`;

  const config = {
    supabaseUrl,
    anonKey,
    email,
    ollamaBaseUrl: envGet("OLLAMA_BASE_URL") || "http://127.0.0.1:11434",
    ollamaModel: envGet("OLLAMA_MODEL") || spec.ollamaModel || "deepseek-coder-v2:16b",
    pollSeconds: numOr(envGet("GMK_POLL_SECONDS"), spec.pollSeconds, 2),
    leaseSeconds: numOr(envGet("GMK_LEASE_SECONDS"), spec.leaseSeconds, 30),
    ollamaTimeoutMs: numOr(envGet("GMK_OLLAMA_TIMEOUT_MS"), spec.ollamaTimeoutMs, 30000),
    ollamaNumGpu: numOr(envGet("GMK_OLLAMA_NUM_GPU"), 0, 0),
    runtimeRoot,
    worktreePath: envGet("GMK_WORKTREE_PATH") || null,
  };

  // Agent password comes from the OS credential store, never from env/files/logs.
  const password = getCredential(credentialTarget);
  const supabase = createAgentClient(supabaseUrl, anonKey);
  const auth = await signInAgent(supabase, email, password);
  logger.log("signed_in", { credential_target: credentialTarget });

  await heartbeat(supabase);
  logger.log("heartbeat", {});

  const runtime = {
    supabase,
    config,
    logger,
    agentId: auth.user.id,
    targetJobId: jobId,
    modelHandle,
    recordRoutingOutcome(entry) {
      if (!runtimeRoot) return;
      const { db } = openDatabase(path.resolve(runtimeRoot));
      try {
        recordRoutingOutcome(db, entry);
      } finally {
        db.close();
      }
    },
  };
  runtime.llm = createCountingLlm(createLlmRegistry({
    runtimeRoot: config.runtimeRoot,
    modelHandle,
    ollamaConfig: {
      baseUrl: config.ollamaBaseUrl,
      model: config.ollamaModel,
      numGpu: config.ollamaNumGpu,
      timeoutMs: config.ollamaTimeoutMs,
    },
  }), llmCallCeiling);
  if (agent === "engineering") {
    runtime.tools = createToolGateway({ worktreePath: config.worktreePath });
    runtime.onJobState = (state, jobId, errorClass) =>
      publishEngineeringSnapshot(runtime, state, jobId, errorClass).catch((err) => {
        logger.log("snapshot_publish_failed", { error_class: err instanceof Error ? err.message.slice(0, 160) : "unknown" });
      });
    await runtime.onJobState("idle", null);
  }
  spec.leaseSeconds = config.leaseSeconds; // env override (used by claim + renew)

  let stopped = false;
  const shutdown = () => {
    if (stopped) return;
    stopped = true;
    logger.log("shutdown", {});
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  if (once) {
    const pass = await processWorkerOnce(runtime, spec, { engineering: agent === "engineering" });
    const processed = pass.processed;
    const scheduled = pass.scheduled;
    if (!processed && agent === "engineering") logger.log("proactive_check", { enqueued: Boolean(scheduled?.enqueued), reason: scheduled?.reason || (pass.control.control_available ? "not_due" : "control_unavailable"), target: scheduled?.target || null });
    logger.log(processed ? "pass_processed" : "pass_idle", {});
    if (jobId && !processed) {
      logger.log("target_job_not_processed", { job_id: jobId });
      process.exit(3);
    }
    if (runtime.lastFailureClass) {
      const error = new Error("classified worker failure");
      error.code = runtime.lastFailureClass;
      throw error;
    }
    process.exit(0);
  }

  logger.log("watching", { poll_seconds: config.pollSeconds, provider: runtime.llm.provider, model: runtime.llm.model });
  while (!stopped) {
    try {
      const pass = await processWorkerPass(runtime, spec, { engineering: agent === "engineering" });
      const { control, processed, scheduled } = pass;
      if (!processed) {
        await heartbeat(supabase).catch(() => {});
        if (agent === "engineering" && !control.paused) {
          if (scheduled?.enqueued) logger.log("proactive_enqueued", { job_id: scheduled.job_id, target: scheduled.target });
          if (control.worker_state === "error") await runtime.onJobState("idle", null);
        }
        if (agent === "engineering" && control.paused) await runtime.onJobState("paused", null);
      }
    } catch (err) {
      logger.log("loop_error", { error_class: err instanceof Error ? err.message.slice(0, 200) : "unknown" });
      if (agent === "engineering") await runtime.onJobState("error", null, err instanceof Error ? err.message.slice(0, 120) : "unknown");
    }
    await new Promise((resolve) => setTimeout(resolve, config.pollSeconds * 1000));
  }
}

main().catch((err) => {
  const failureClass = deterministicFailureClass(err, "worker_failed");
  process.stderr.write(`worker fatal [${failureClass}]: classified worker failure\n`);
  process.exit(1);
});

// Live execution requires operator-provisioned router config under <runtime-root>/config/
// and <runtime-root>/.env.gmk-router.local; repository examples are templates only.
import path from "node:path";
import { spawn } from "node:child_process";
import { readEnv, requireValue } from "./lib/env.mjs";
import { getCredential } from "./lib/credential.mjs";
import { createAgentClient, signInAgent } from "./lib/supabase.mjs";
import { openDatabase } from "./lib/sqlite.mjs";
import { loadRouterConfig } from "./lib/router/config.mjs";
import { classifyJob } from "./lib/router/classify.mjs";
import { routeJob } from "./lib/router/route.mjs";
import { assertJobAuthority } from "./lib/router/authority.mjs";
import { recordCoordinatorEvent, recordJobLifecycle } from "./lib/ledger.mjs";
import { writeBlockedArtifact } from "./lib/blocked-artifact.mjs";

const AGENTS = Object.freeze({
  engineering: { capability: "engineering.local" },
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

function runWorker({ agent, jobId, modelHandle }) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [
      path.resolve(process.cwd(), "scripts", "gmk-agent-worker", "worker.mjs"),
      "--agent", agent,
      "--once",
      "--job-id", jobId,
      "--model-handle", modelHandle,
    ], {
      cwd: process.cwd(),
      shell: false,
      windowsHide: true,
      env: childEnvironment(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const append = (current, chunk) => (current + chunk.toString()).slice(-64 * 1024);
    child.stdout.on("data", (chunk) => { stdout = append(stdout, chunk); });
    child.stderr.on("data", (chunk) => { stderr = append(stderr, chunk); });
    child.on("error", (error) => resolve({ ok: false, code: null, error, stdout, stderr }));
    child.on("close", (code, signal) => resolve({ ok: code === 0, code, signal, stdout, stderr }));
  });
}

async function queuedJob(supabase, capability) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("agent_jobs")
    .select("id, payload, job_type, priority, created_at, attempt_count, requires_review, workspace_type")
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

    try {
      assertJobAuthority(job);
      const classification = classifyJob(job, { db });
      const route = routeJob(job, classification, routerConfig.models, { db });
      recordJobLifecycle(db, { jobId: job.id, state: "routed", modelHandle: route.handle });
      recordCoordinatorEvent(db, "job_routed", {
        job_id: job.id,
        job_type: job.job_type,
        model_handle: route.handle,
        complexity: route.complexity,
        risk_class: route.riskClass,
      });

      if (route.handle === "codex") {
        const error = new Error("Codex execution starts in P4; P2 refuses to dispatch this route");
        error.code = "provider_not_implemented";
        throw error;
      }

      recordJobLifecycle(db, { jobId: job.id, state: "dispatch", modelHandle: route.handle });
      const worker = await runWorker({ agent: args.agent, jobId: job.id, modelHandle: route.handle });
      recordJobLifecycle(db, {
        jobId: job.id,
        state: worker.ok ? "worker_exited" : "worker_failed",
        modelHandle: route.handle,
      });
      if (!worker.ok) {
        const error = new Error(`worker exited ${worker.code ?? "before start"}: ${(worker.stderr || worker.stdout || "no output").slice(-1000)}`);
        error.code = "worker_dispatch_failed";
        throw error;
      }
    } catch (error) {
      const code = error?.code || "coordinator_failed";
      const reason = `${code}: ${error instanceof Error ? error.message : String(error)}`;
      const artifact = writeBlockedArtifact(runtimeRoot, {
        reason,
        pendingJobs: [job],
        attempted: ["classify", "route", "authority", "single-job dispatch"],
        resumeCommand: `node scripts/gmk-agent-worker/coordinator.mjs --once --agent ${args.agent}`,
      });
      recordCoordinatorEvent(db, "coordinator_blocked", {
        job_id: job.id,
        reason: code,
        artifact,
      });
      throw error;
    }
  } finally {
    db.close();
  }
}

main().catch((error) => {
  process.stderr.write(`coordinator fatal: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});

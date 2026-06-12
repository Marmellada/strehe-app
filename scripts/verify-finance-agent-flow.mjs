import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

function readEnv(filePath) {
  const values = new Map();
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    values.set(
      trimmed.slice(0, separator).trim(),
      trimmed
        .slice(separator + 1)
        .trim()
        .replace(/^['"]|['"]$/g, "")
    );
  }
  return values;
}

const localRoot = path.resolve(
  process.argv[2] || "../strehe-finance-local"
);
const appEnv = readEnv(path.resolve(".env.local"));
const admin = createClient(
  appEnv.get("NEXT_PUBLIC_SUPABASE_URL"),
  appEnv.get("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const [{ data: space, error: spaceError }, { data: requester, error: userError }] =
  await Promise.all([
    admin.from("household_spaces").select("id").eq("is_active", true).limit(1).single(),
    admin
      .from("app_users")
      .select("id")
      .eq("role", "admin")
      .eq("is_active", true)
      .limit(1)
      .single(),
  ]);
if (spaceError) throw spaceError;
if (userError) throw userError;

const { data: agent, error: agentError } = await admin
  .from("agent_principals")
  .select("id")
  .eq("agent_key", "finance.local")
  .single();
if (agentError) throw agentError;

let jobId = "";
try {
  const { data: job, error: jobError } = await admin
    .from("agent_jobs")
    .insert({
      job_type: "finance.report.generate",
      required_capability: "finance.report.generate",
      workspace_type: "household",
      household_space_id: space.id,
      requested_by_user_id: requester.id,
      assigned_agent_id: agent.id,
      status: "queued",
      priority: 1,
      payload: { month: "2026-06", verification: true },
      requires_review: true,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();
  if (jobError) throw jobError;
  jobId = job.id;

  const python = path.join(localRoot, ".venv", "Scripts", "python.exe");
  const worker = spawnSync(python, ["-m", "src.main", "--cloud-once"], {
    cwd: localRoot,
    encoding: "utf8",
  });
  if (worker.status !== 0) {
    throw new Error(worker.stderr || worker.stdout || "Local worker failed.");
  }

  const { data: completed, error: completedError } = await admin
    .from("agent_jobs")
    .select("status, result")
    .eq("id", jobId)
    .single();
  if (completedError) throw completedError;
  if (completed.status !== "awaiting_review") {
    throw new Error(`Unexpected job status: ${completed.status}`);
  }

  const result = completed.result || {};
  if (
    result.account_balances ||
    result.transactions ||
    result.privacy?.raw_transactions_uploaded !== false ||
    result.privacy?.account_details_uploaded !== false ||
    result.privacy?.receipt_data_uploaded !== false
  ) {
    throw new Error("Finance privacy boundary verification failed.");
  }

  console.log("Real queue verification passed: queued -> local -> awaiting_review.");
  console.log("Verified aggregate-only result with no raw finance records.");
} finally {
  if (jobId) {
    await admin.from("agent_jobs").delete().eq("id", jobId);
  }
}

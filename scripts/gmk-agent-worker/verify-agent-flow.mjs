import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { readEnv } from "./lib/env.mjs";

// Synthetic end-to-end proof (Phase 1H). Uses service_role ONLY to enqueue a
// harmless synthetic job and read back results; the worker itself runs as the
// agent identity with no service_role. Leaves job rows as audit history.

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail: detail || "" });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
}

function secretScan(text) {
  return /service[_\-]?role/i.test(text) ||
    /eyJhbGciOi[A-Za-z0-9._-]{12,}/.test(text) ||
    /\bsk-[A-Za-z0-9]{16,}/.test(text) ||
    /\bgh[pousr]_[A-Za-z0-9]{16,}/.test(text) ||
    /(SUPABASE_)?SERVICE_ROLE_KEY/.test(text) ||
    /(AGENT_)?PASSWORD/i.test(text);
}

async function main() {
  const source = process.env.SOURCE || path.resolve(process.cwd(), "..", "strehe-app", ".env.local");
  const sourceEnv = readEnv(source);
  const supabaseUrl = sourceEnv.get("NEXT_PUBLIC_SUPABASE_URL") || sourceEnv.get("SUPABASE_URL");
  const anonKey = sourceEnv.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") || sourceEnv.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = sourceEnv.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("missing Supabase credentials in source env");
    process.exit(2);
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const agent = (await admin.from("agent_principals").select("id").eq("agent_key", "engineering.local").single()).data;
  const requester = (await admin.from("app_users").select("id").eq("role", "admin").eq("is_active", true).limit(1).single()).data;
  if (!agent || !requester) {
    console.error("engineering.local principal or admin requester not found (run provision first)");
    process.exit(2);
  }

  async function enqueue(payload) {
    const { data, error } = await admin.from("agent_jobs").insert({
      job_type: "engineering.synthetic",
      required_capability: "engineering.local",
      workspace_type: "system",
      subject_type: "verification",
      requested_by_user_id: requester.id,
      assigned_agent_id: agent.id,
      status: "queued",
      priority: 1,
      payload,
      requires_review: true,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    }).select("id").single();
    if (error) throw error;
    return data.id;
  }

  function runWorker(extraEnv = {}) {
    return spawnSync(
      process.execPath,
      ["scripts/gmk-agent-worker/worker.mjs", "--agent", "engineering", "--once"],
      { cwd: process.cwd(), encoding: "utf8", timeout: 300000, env: { ...process.env, ...extraEnv } },
    );
  }

  // ---- Test A: synthetic end-to-end ----
  const jobId = await enqueue({
    type: "synthetic",
    prompt: 'Return JSON with a single key "answer" whose value is the number 4.',
  });
  const worker = runWorker();
  check("worker exit 0", worker.status === 0, worker.status === 0 ? "" : (worker.stderr || worker.stdout).slice(-300));

  const after = (await admin.from("agent_jobs").select("status, result").eq("id", jobId).single()).data;
  check("job reached awaiting_review", after.status === "awaiting_review", `status=${after.status}`);
  check("result schema_version 1", after.result?.schema_version === 1);
  check("result privacy local-only", after.result?.privacy?.local_processing === true && after.result?.privacy?.external_ai_used === false);
  check("result runtime model set", typeof after.result?.runtime?.model === "string", after.result?.runtime?.model);

  const serialized = JSON.stringify(after.result ?? {});
  check("no secrets in result", !secretScan(serialized));

  const runs = (await admin.from("agent_runs").select("id,status").eq("job_id", jobId)).data || [];
  check("agent_runs created + completed", runs.length >= 1 && runs.every((r) => r.status === "completed"), `${runs.length} run(s)`);

  const caps = (await admin.from("agent_capabilities").select("capability_key").eq("agent_id", agent.id)).data || [];
  check("capability isolation (only engineering.local)", caps.length === 1 && caps[0].capability_key === "engineering.local", caps.map((c) => c.capability_key).join(","));

  const envPath = path.resolve(process.cwd(), ".env.gmk-engineering.local");
  if (fs.existsSync(envPath)) {
    const envText = fs.readFileSync(envPath, "utf8");
    check("env file has no secret", !secretScan(envText));
  } else {
    check("env file exists", false, "missing .env.gmk-engineering.local");
  }

  check("no secrets in worker stdout", !secretScan(worker.stdout || ""));

  // ---- Test B: lease renewal (short lease + slow job) ----
  const leaseJobId = await enqueue({
    type: "synthetic",
    prompt: 'Return JSON with a single key "answer" whose value is the number 1.',
    delay_ms: 12000,
  });
  const leaseWorker = runWorker({ GMK_LEASE_SECONDS: "6" });
  check("lease-test worker exit 0", leaseWorker.status === 0);
  const leaseAfter = (await admin.from("agent_jobs").select("status").eq("id", leaseJobId).single()).data;
  check("lease renewal kept slow job alive", leaseAfter.status === "awaiting_review", `status=${leaseAfter.status}`);

  // ---- Summary ----
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`verify failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(2);
});

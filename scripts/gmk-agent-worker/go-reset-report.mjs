import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { GO_RESET_JOB_ID } from "./lib/go-ready.mjs";

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const jobId = argValue("--job-id");
if (!GO_RESET_JOB_ID.test(String(jobId || ""))) {
  process.stderr.write("usage: node go-reset-report.mjs --job-id go-reset-inbox-draft-<id> [--runtime-root <path>]\n");
  process.exit(2);
}
const runtimeRoot = path.resolve(argValue("--runtime-root") || path.join(process.cwd(), "..", ".."));
const db = new DatabaseSync(path.join(runtimeRoot, "state", "engineering.sqlite3"), { readOnly: true });
try {
  const lifecycle = db.prepare(
    "SELECT state,model_handle,iteration_count,iteration_ceiling,deadline_at,created_at FROM job_lifecycle_log WHERE job_id = ? ORDER BY id",
  ).all(jobId);
  const usage = db.prepare(
    "SELECT provider,model,input_tokens,output_tokens,cache_read_tokens,cache_write_tokens,reasoning_tokens,api_calls,estimated_cost_usd,reported_cost_usd,cost_status,duration_ms,created_at FROM llm_usage_ledger WHERE job_id = ? ORDER BY id",
  ).all(jobId);
  const meteringHold = db.prepare("SELECT value FROM runtime_state WHERE key = 'budget_opencode_metering_hold'").get()?.value ?? null;
  const artifactPath = path.join(runtimeRoot, "state", "artifacts", `${jobId}.result.json`);
  const artifact = fs.statSync(artifactPath, { throwIfNoEntry: false })?.isFile()
    ? JSON.parse(fs.readFileSync(artifactPath, "utf8"))
    : null;
  process.stdout.write(`${JSON.stringify({
    job_id: jobId,
    route_selected: lifecycle.find((entry) => entry.state === "routed")?.model_handle ?? null,
    model_selected: usage[0]?.model ?? null,
    lifecycle,
    usage,
    cost_status: usage.map((entry) => entry.cost_status),
    metering_hold: meteringHold,
    job_result: artifact?.result ?? null,
    proof: artifact ? {
      synthetic: artifact.synthetic === true,
      cloud_calls: artifact.cloud_calls,
      production_access: artifact.production_access,
      production_mutation: artifact.production_mutation,
      outbound_send: artifact.outbound_send,
      send: artifact.result?.send,
      requires_human_review: artifact.result?.requires_human_review,
    } : null,
    artifact: artifactPath,
  }, null, 2)}\n`);
} finally {
  db.close();
}

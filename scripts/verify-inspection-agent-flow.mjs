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

const appRoot = process.cwd();
const appEnv = readEnv(path.join(appRoot, ".env.local"));
const admin = createClient(
  appEnv.get("NEXT_PUBLIC_SUPABASE_URL"),
  appEnv.get("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { autoRefreshToken: false, persistSession: false } }
);
const [{ data: requester, error: requesterError }, { data: agent, error: agentError }] =
  await Promise.all([
    admin
      .from("app_users")
      .select("id")
      .eq("role", "admin")
      .eq("is_active", true)
      .limit(1)
      .single(),
    admin
      .from("agent_principals")
      .select("id")
      .eq("agent_key", "inspection.local")
      .eq("is_active", true)
      .single(),
  ]);
if (requesterError) throw requesterError;
if (agentError) throw agentError;

const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const { data: job, error: jobError } = await admin
  .from("agent_jobs")
  .insert({
    job_type: "inspection.photo.compare",
    required_capability: "inspection.photo.compare",
    workspace_type: "inspection",
    subject_type: "verification",
    requested_by_user_id: requester.id,
    assigned_agent_id: agent.id,
    status: "queued",
    priority: 1,
    payload: {
      schema_version: 1,
      case_id: "local-agent-verification",
      room_type: "living_room",
      baseline_count: 1,
      current_count: 1,
      verification: true,
    },
    requires_review: true,
    expires_at: expiresAt,
  })
  .select("id")
  .single();
if (jobError) throw jobError;

const artifactPaths = [];
try {
  const samplePath = path.join(
    appRoot,
    "public",
    "marketing",
    "home-hero-v2.webp"
  );
  const sample = fs.readFileSync(samplePath);

  for (const slot of ["baseline", "current"]) {
    const storagePath = `${agent.id}/${job.id}/verification/${slot}-001.webp`;
    const { error: uploadError } = await admin.storage
      .from("agent-artifacts")
      .upload(storagePath, sample, {
        contentType: "image/webp",
        upsert: false,
      });
    if (uploadError) throw uploadError;
    artifactPaths.push(storagePath);

    const { error: artifactError } = await admin
      .from("agent_artifacts")
      .insert({
        job_id: job.id,
        artifact_kind: "input",
        storage_bucket: "agent-artifacts",
        storage_path: storagePath,
        mime_type: "image/webp",
        byte_size: sample.byteLength,
        metadata: {
          capture_slot: slot,
          order_index: 1,
          photo_type: "wide",
        },
        expires_at: expiresAt,
      });
    if (artifactError) throw artifactError;
  }

  const worker = spawnSync(
    process.execPath,
    ["scripts/local-inspection-agent.mjs", "--once"],
    {
      cwd: appRoot,
      encoding: "utf8",
      timeout: 240000,
    }
  );
  if (worker.status !== 0) {
    throw new Error(
      worker.stderr || worker.stdout || "Local inspection worker failed."
    );
  }

  const { data: completed, error: completedError } = await admin
    .from("agent_jobs")
    .select("status, result")
    .eq("id", job.id)
    .single();
  if (completedError) throw completedError;
  const result = completed.result || {};

  if (completed.status !== "awaiting_review") {
    throw new Error(`Unexpected inspection job status: ${completed.status}`);
  }
  if (
    result.quality?.status !== "passed" ||
    result.quality?.human_review_required !== true ||
    result.privacy?.local_processing !== true ||
    result.privacy?.external_ai_used !== false ||
    result.privacy?.temporary_photos_only !== true ||
    result.summary?.pair_count !== 1
  ) {
    throw new Error("Inspection quality or privacy verification failed.");
  }
  if (result.runtime?.local_model_used !== true) {
    throw new Error(
      "The deterministic fallback worked, but the local GPU vision model was not used."
    );
  }
  const serialized = JSON.stringify(result);
  if (
    serialized.includes('"storage_path":') ||
    serialized.includes('"source_photo_id":') ||
    serialized.includes('"base64":')
  ) {
    throw new Error("Inspection result leaked a raw input reference.");
  }

  console.log(
    "Real inspection queue verification passed: temporary photos -> local GPU comparison -> awaiting_review."
  );
  console.log(
    `Verified model ${result.runtime.local_model}, bounded corrections, privacy checks, and one matched photo pair.`
  );
} finally {
  if (artifactPaths.length > 0) {
    await admin.storage.from("agent-artifacts").remove(artifactPaths);
  }
  await admin.from("agent_jobs").delete().eq("id", job.id);
}

import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    throw new Error("Missing CRON_SECRET environment variable.");
  }

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

async function removeExpiredArtifacts(now: string) {
  const admin = getAdminClient();
  let removed = 0;

  for (let batch = 0; batch < 20; batch += 1) {
    const { data, error } = await admin
      .from("agent_artifacts")
      .select("storage_path")
      .lt("expires_at", now)
      .limit(500);

    if (error) {
      throw new Error(`Expired artifact lookup failed: ${error.message}`);
    }

    const paths = (data ?? []).map((artifact) => artifact.storage_path);
    if (paths.length === 0) break;

    const { error: storageError } = await admin.storage
      .from("agent-artifacts")
      .remove(paths);
    if (storageError) {
      throw new Error(`Expired artifact removal failed: ${storageError.message}`);
    }

    const { error: metadataError } = await admin
      .from("agent_artifacts")
      .delete()
      .in("storage_path", paths);
    if (metadataError) {
      throw new Error(
        `Expired artifact metadata cleanup failed: ${metadataError.message}`
      );
    }
    removed += paths.length;
  }

  return removed;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const admin = getAdminClient();
  const now = new Date().toISOString();
  const artifactsRemoved = await removeExpiredArtifacts(now);
  const { count: jobsRemoved, error } = await admin
    .from("agent_jobs")
    .delete({ count: "exact" })
    .lt("expires_at", now);

  if (error) {
    throw new Error(`Expired agent job cleanup failed: ${error.message}`);
  }

  return Response.json({
    ok: true,
    artifacts_removed: artifactsRemoved,
    jobs_removed: jobsRemoved ?? 0,
  });
}

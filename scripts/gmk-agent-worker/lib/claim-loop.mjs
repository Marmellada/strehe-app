import { assertSafeResult } from "./validate.mjs";

// Job discovery + by-ID claim + lease renewal + dispatch + complete/fail.
// Mirrors the proven reference-worker flow, with lease renewal added.

function startLeaseRenewal(supabase, jobId, leaseSeconds, logger) {
  const intervalMs = Math.max(1000, Math.floor((leaseSeconds * 1000) / 3));
  const timer = setInterval(async () => {
    try {
      await supabase.rpc("renew_agent_job_lease", {
        target_job_id: jobId,
        lease_seconds: leaseSeconds,
      });
    } catch {
      logger.log("lease_renew_failed", {
        job_id: jobId,
        error_class: "renew",
      });
    }
  }, intervalMs);
  return { stop: () => clearInterval(timer), intervalMs };
}

export async function processNextJob(runtime, spec) {
  const { supabase, logger } = runtime;
  const now = new Date().toISOString();

  const { data: jobs, error } = await supabase
    .from("agent_jobs")
    .select("id, payload, job_type")
    .eq("required_capability", spec.capability)
    .eq("status", "queued")
    .lte("available_at", now)
    .gt("expires_at", now)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(5);
  if (error) throw error;
  if (!jobs || jobs.length === 0) return false;

  for (const candidate of jobs) {
    const { data: claimed, error: claimError } = await supabase.rpc("claim_agent_job", {
      target_job_id: candidate.id,
      lease_seconds: spec.leaseSeconds,
    });
    if (claimError || !claimed) {
      logger.log("claim_race_lost", { job_id: candidate.id });
      continue; // lost the race — never fail the job for a claim error
    }

    const renewal = startLeaseRenewal(supabase, claimed.id, spec.leaseSeconds, logger);
    const started = Date.now();
    try {
      const result = await spec.run(runtime, claimed);
      assertSafeResult(result); // hard gate before persisting anything
      const { error: completeError } = await supabase.rpc("complete_agent_job", {
        target_job_id: claimed.id,
        job_result: result,
      });
      if (completeError) throw completeError;
      logger.log("job_completed", {
        job_id: claimed.id,
        job_type: claimed.job_type,
        duration_ms: Date.now() - started,
      });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code =
        err && typeof err === "object" && typeof err.code === "string"
          ? err.code
          : "agent_processing_failed";
      try {
        await supabase.rpc("fail_agent_job", {
          target_job_id: claimed.id,
          failure_code: code.slice(0, 120),
          failure_message: message.slice(0, 4000),
        });
      } catch {
        logger.log("fail_rpc_error", { job_id: claimed.id, error_class: "complete" });
      }
      logger.log("job_failed", {
        job_id: claimed.id,
        error_class: code.slice(0, 120),
        duration_ms: Date.now() - started,
      });
      return true;
    } finally {
      renewal.stop();
    }
  }
  return false;
}

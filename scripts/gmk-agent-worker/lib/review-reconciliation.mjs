import path from "node:path";
import { advanceLastReviewedCommit } from "./review-state.mjs";
import { getState, openDatabase } from "./sqlite.mjs";

const FULL_SHA = /^[0-9a-f]{40}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REVIEW_JOB_SELECT = [
  "id", "job_type", "required_capability", "workspace_type", "status",
  "payload", "result", "requires_review", "review_decision",
  "reviewed_by_user_id", "reviewed_at", "completed_at",
].join(",");

function normalizedSha(value, label) {
  const normalized = String(value || "").toLowerCase();
  if (!FULL_SHA.test(normalized)) throw new Error(`${label} must be a full Git SHA`);
  return normalized;
}

function normalizedTimestamp(value, label) {
  const parsed = new Date(String(value || ""));
  if (!Number.isFinite(parsed.getTime())) throw new Error(`${label} is required`);
  return parsed.toISOString();
}

function requireReviewedJob(session, job) {
  if (!job || typeof job !== "object") throw new Error("reviewed job is unavailable");
  const expectedJobId = String(session.supabase_job_id || "").toLowerCase();
  if (!UUID.test(expectedJobId) || String(job.id || "").toLowerCase() !== expectedJobId) {
    throw new Error("reviewed job does not match the local review session");
  }
  if (job.job_type !== "engineering.review"
    || job.required_capability !== "engineering.local"
    || job.workspace_type !== "system"
    || job.requires_review !== true) {
    throw new Error("reviewed job provenance is invalid");
  }
  const decision = String(job.review_decision || "");
  const expectedStatus = decision === "approved" ? "completed" : decision === "rejected" ? "failed" : null;
  if (!expectedStatus || job.status !== expectedStatus) {
    throw new Error("reviewed job decision and status are inconsistent");
  }
  if (!UUID.test(String(job.reviewed_by_user_id || ""))) {
    throw new Error("reviewed job is missing authenticated reviewer provenance");
  }
  const reviewedAt = normalizedTimestamp(job.reviewed_at, "reviewed job time");
  if (normalizedTimestamp(job.completed_at, "reviewed job completion time") !== reviewedAt) {
    throw new Error("reviewed job completion provenance is inconsistent");
  }

  const payload = job.payload;
  if (!payload || typeof payload !== "object"
    || payload.type !== "review"
    || payload.session_id !== session.id
    || normalizedSha(payload.base_commit, "review job base commit") !== session.base_commit
    || normalizedSha(payload.commit_sha, "review job target commit") !== session.current_commit
    || payload.scope !== "repository"
    || payload.implementation !== false
    || payload.writes_code !== false) {
    throw new Error("reviewed job payload does not match the local review session");
  }

  const result = job.result;
  if (!result || typeof result !== "object"
    || result.schema_version !== 1
    || result.agent !== "engineering"
    || result.session_id !== session.id
    || result.review_kind !== "review"
    || result.scope !== "review"
    || normalizedSha(result.base_commit, "review result base commit") !== session.base_commit
    || normalizedSha(result.git_commit, "review result target commit") !== session.current_commit
    || result.production_changes_made !== false) {
    throw new Error("reviewed job result does not match the completed local review");
  }

  return {
    decision,
    approval: decision === "approved" ? {
      decision: "approved",
      jobId: expectedJobId,
      approvedByUserId: String(job.reviewed_by_user_id).toLowerCase(),
      approvedAt: reviewedAt,
    } : null,
  };
}

export function reconcileReviewedJob(db, { session, job, advancedAt = new Date().toISOString() }) {
  const reviewed = requireReviewedJob(session, job);
  if (reviewed.decision === "rejected") {
    return {
      sessionId: session.id,
      jobId: String(job.id).toLowerCase(),
      decision: "rejected",
      advanced: false,
      replayed: false,
    };
  }
  const advancement = advanceLastReviewedCommit(db, {
    sessionId: session.id,
    baseCommit: session.base_commit,
    targetCommit: session.current_commit,
    approval: reviewed.approval,
    advancedAt,
  });
  return {
    sessionId: session.id,
    jobId: String(job.id).toLowerCase(),
    decision: "approved",
    ...advancement,
  };
}

async function readReviewedJob(supabase, session) {
  const { data, error } = await supabase
    .from("agent_jobs")
    .select(REVIEW_JOB_SELECT)
    .eq("id", session.supabase_job_id)
    .maybeSingle();
  if (error) throw new Error(`reviewed job lookup failed: ${error.message || error}`);
  if (!data) return null;
  const hasDecision = data.review_decision != null;
  const hasReviewer = data.reviewed_by_user_id != null || data.reviewed_at != null;
  if (!hasDecision) {
    if (hasReviewer) throw new Error("reviewed job has partial reviewer provenance");
    return null;
  }
  return { session, job: data, reviewed: requireReviewedJob(session, data) };
}

export async function reconcileReviewedEngineeringJobs(runtime, { advancedAt = new Date().toISOString() } = {}) {
  if (!runtime?.supabase || !runtime?.config?.runtimeRoot) {
    throw new Error("engineering review reconciliation requires the trusted worker runtime");
  }
  const { db } = openDatabase(path.resolve(runtime.config.runtimeRoot));
  try {
    const current = getState(db, "last_reviewed_commit");
    const sessions = db.prepare(
      `SELECT session.* FROM review_sessions session
       WHERE session.scope = 'review' AND session.status = 'done'
         AND session.supabase_job_id IS NOT NULL
         AND (NOT EXISTS (
           SELECT 1 FROM review_commit_advancements advancement
           WHERE advancement.session_id = session.id
         ) OR session.current_commit = ?)
       ORDER BY session.created_at, session.id`,
    ).all(current);
    const observed = [];
    for (const session of sessions) {
      const reviewed = await readReviewedJob(runtime.supabase, session);
      if (reviewed) observed.push(reviewed);
    }

    const pendingApprovals = observed.filter(({ session, reviewed }) => (
      reviewed.decision === "approved" && session.base_commit === current
    ));
    const staleApprovals = observed.filter(({ session, reviewed }) => (
      reviewed.decision === "approved"
      && session.base_commit !== current
      && session.current_commit !== current
    ));
    if (staleApprovals.length > 0) {
      throw new Error("approved review range is stale relative to current review state");
    }
    if (pendingApprovals.length > 1) {
      throw new Error("multiple approved reviews compete for the current commit");
    }

    const results = [];
    for (const entry of observed.filter(({ session, reviewed }) => (
      reviewed.decision === "approved" && session.current_commit === current
    ))) {
      results.push(reconcileReviewedJob(db, { ...entry, advancedAt }));
    }
    for (const entry of observed.filter(({ reviewed }) => reviewed.decision === "rejected")) {
      results.push(reconcileReviewedJob(db, { ...entry, advancedAt }));
    }
    for (const entry of pendingApprovals) {
      results.push(reconcileReviewedJob(db, { ...entry, advancedAt }));
    }
    return results;
  } finally {
    db.close();
  }
}

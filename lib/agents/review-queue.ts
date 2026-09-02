export type EngineeringReviewQueueJob = {
  id: string;
  job_type: string;
  status: string;
  priority: number;
  target_module: string | null;
  session_id: string | null;
  summary: string | null;
  finding_count: number;
  created_at: string;
  completed_at: string | null;
  review_decision: string | null;
  review_notes: string | null;
  reviewed_at: string | null;
  reviewer_name: string | null;
  reviewer_email: string | null;
};

export type EngineeringReviewQueue = {
  configured: boolean;
  pending_count: number;
  jobs: EngineeringReviewQueueJob[];
  recent_decisions: EngineeringReviewQueueJob[];
};

export type EngineeringReviewJobDetail = EngineeringReviewQueueJob & {
  requires_review: boolean;
  attempt_count: number;
  max_attempts: number;
  claimed_at: string | null;
  processed_at: string | null;
  updated_at: string;
  base_commit: string | null;
  target_commit: string | null;
  commit_sha: string | null;
  trigger: string | null;
  error_status: string | null;
  findings: Array<Record<string, unknown>>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringOrNull(value: unknown) {
  return typeof value === "string" ? value : null;
}

function numberOrZero(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function parseQueueJob(value: unknown): EngineeringReviewQueueJob | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  return {
    id: value.id,
    job_type: stringOrNull(value.job_type) || "engineering.review",
    status: stringOrNull(value.status) || "unknown",
    priority: numberOrZero(value.priority),
    target_module: stringOrNull(value.target_module),
    session_id: stringOrNull(value.session_id),
    summary: stringOrNull(value.summary),
    finding_count: numberOrZero(value.finding_count),
    created_at: stringOrNull(value.created_at) || "",
    completed_at: stringOrNull(value.completed_at),
    review_decision: stringOrNull(value.review_decision),
    review_notes: stringOrNull(value.review_notes),
    reviewed_at: stringOrNull(value.reviewed_at),
    reviewer_name: stringOrNull(value.reviewer_name),
    reviewer_email: stringOrNull(value.reviewer_email),
  };
}

export function parseEngineeringReviewQueue(
  value: unknown
): EngineeringReviewQueue {
  if (!isRecord(value)) {
    return { configured: false, pending_count: 0, jobs: [], recent_decisions: [] };
  }

  return {
    configured: value.configured === true,
    pending_count: numberOrZero(value.pending_count),
    jobs: Array.isArray(value.jobs)
      ? value.jobs.map(parseQueueJob).filter((job): job is EngineeringReviewQueueJob => Boolean(job))
      : [],
    recent_decisions: Array.isArray(value.recent_decisions)
      ? value.recent_decisions
          .map(parseQueueJob)
          .filter((job): job is EngineeringReviewQueueJob => Boolean(job))
      : [],
  };
}

export function parseEngineeringReviewJob(
  value: unknown
): EngineeringReviewJobDetail | null {
  const base = parseQueueJob(value);
  if (!base || !isRecord(value)) return null;

  return {
    ...base,
    requires_review: value.requires_review === true,
    attempt_count: numberOrZero(value.attempt_count),
    max_attempts: numberOrZero(value.max_attempts),
    claimed_at: stringOrNull(value.claimed_at),
    processed_at: stringOrNull(value.processed_at),
    updated_at: stringOrNull(value.updated_at) || "",
    base_commit: stringOrNull(value.base_commit),
    target_commit: stringOrNull(value.target_commit),
    commit_sha: stringOrNull(value.commit_sha),
    trigger: stringOrNull(value.trigger),
    error_status: stringOrNull(value.error_status),
    findings: Array.isArray(value.findings)
      ? value.findings.filter(isRecord)
      : [],
  };
}

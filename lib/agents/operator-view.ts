import type { AppRole } from "@/lib/auth/roles";

export type EngineeringModuleState = {
  name: string;
  criticality: string;
  validation_state: string;
  last_validated_commit: string | null;
  last_meaningful_review_at: string | null;
  last_review_outcome: string | null;
};

export type EngineeringFinding = {
  id: number;
  module: string | null;
  summary: string;
  evidence: unknown[];
  recommendation: string | null;
  severity: string;
  confidence: string;
  lifecycle: string;
  created_at: string;
};

export type EngineeringJob = {
  id: string;
  job_type: string;
  status: string;
  priority: number;
  target_module: string | null;
  summary: string | null;
  finding_count: number;
  error_status: string | null;
  claimed_at: string | null;
  lease_expires_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  attempt_count: number;
  review_decision: string | null;
};

type DashboardPayload = {
  principal?: {
    id: string;
    agent_key: string;
    display_name: string;
    is_active: boolean;
    last_seen_at: string | null;
  } | null;
  control?: {
    proactive_enabled: boolean;
    paused: boolean;
    next_proactive_at: string | null;
    manual_review_requested_at: string | null;
    local_model_name: string | null;
    worker_state: string;
    current_job_id: string | null;
    last_error_class: string | null;
    status_snapshot: {
      counts?: { validated?: number; stale?: number; deferred?: number; pending_findings?: number };
      modules?: EngineeringModuleState[];
      findings?: EngineeringFinding[];
    } | null;
    snapshot_updated_at: string | null;
  } | null;
  jobs?: EngineeringJob[];
};

export function canViewAgentOperations(role: AppRole) {
  return role === "admin" || role === "office";
}

export function canControlAgentOperations(role: AppRole) {
  return role === "admin";
}

export function buildEngineeringAgentView(payload: DashboardPayload | null, nowMs = Date.now()) {
  const principal = payload?.principal || null;
  const control = payload?.control || null;
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : [];
  const lastSeenMs = principal?.last_seen_at ? Date.parse(principal.last_seen_at) : Number.NaN;
  const runningJob = jobs.find((job) => job.status === "running") || null;
  const leaseMs = runningJob?.lease_expires_at ? Date.parse(runningJob.lease_expires_at) : Number.NaN;
  const heartbeatFresh = Number.isFinite(lastSeenMs) && nowMs - lastSeenMs <= 90_000;
  const activeLease = Boolean(runningJob) && Number.isFinite(leaseMs) && leaseMs > nowMs;
  const online = Boolean(principal?.is_active) && (heartbeatFresh || activeLease);
  let state = "offline";
  if (online) {
    if (control?.paused) state = "paused";
    else if (control?.worker_state === "error") state = "error";
    else if (runningJob || control?.worker_state === "working") state = "working";
    else state = "idle";
  }
  const completedJobs = jobs
    .filter((job) => job.status === "completed" && Boolean(job.completed_at))
    .sort((a, b) => Date.parse(b.completed_at || "") - Date.parse(a.completed_at || ""));
  const snapshot = control?.status_snapshot || {};
  const modules = Array.isArray(snapshot.modules) ? snapshot.modules : [];
  const findings = Array.isArray(snapshot.findings) ? snapshot.findings : [];
  const counts = snapshot.counts || {};

  return {
    state,
    online,
    principal,
    control,
    currentJob: runningJob,
    lastCompleted: completedJobs[0] || null,
    jobs,
    modules,
    findings,
    counts: {
      pendingFindings: counts.pending_findings ?? findings.filter((item) => item.lifecycle === "OPEN").length,
      validated: counts.validated ?? modules.filter((item) => item.validation_state === "VALIDATED").length,
      deferred: counts.deferred ?? modules.filter((item) => item.validation_state === "DEFERRED").length,
      stale: counts.stale ?? modules.filter((item) => !["VALIDATED", "DEFERRED"].includes(item.validation_state)).length,
      pendingReview: jobs.filter((job) => job.status === "awaiting_review").length,
    },
  };
}

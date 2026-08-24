import crypto from "node:crypto";

const HIGH_RISK_PATTERN = /\b(auth|security|billing|payment|messaging|notification|infra|migration|secret|deploy|customer)\b/i;

function payloadObject(job) {
  return job?.payload && typeof job.payload === "object" ? job.payload : {};
}

function scopeFiles(payload) {
  for (const value of [payload.files, payload.changed_files, payload.scope_files]) {
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
  }
  if (typeof payload.scope === "string" && /\.[a-z0-9]+$/i.test(payload.scope)) return [payload.scope];
  return [];
}

export function scopeFingerprint(job) {
  const payload = payloadObject(job);
  const scope = {
    job_type: job?.job_type || payload.type || "unknown",
    scope: payload.scope ?? null,
    files: scopeFiles(payload).sort(),
    implementation: payload.implementation === true,
  };
  return crypto.createHash("sha256").update(JSON.stringify(scope)).digest("hex");
}

export function countRecentFailures(db, jobType, fingerprint, now = new Date()) {
  if (!db) return 0;
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  return Number(db.prepare(
    `SELECT COUNT(*) AS count FROM routing_outcomes
     WHERE job_type = ? AND scope_fingerprint = ?
       AND outcome = 'failed' AND created_at >= ?`,
  ).get(jobType, fingerprint, since)?.count || 0);
}

export function classifyJob(job, { db, now = new Date() } = {}) {
  const payload = payloadObject(job);
  const jobType = String(job?.job_type || payload.type || "unknown");
  const fingerprint = scopeFingerprint(job);
  const priorFailures = Number(job?.attempt_count || 0)
    + countRecentFailures(db, jobType, fingerprint, now);
  const files = scopeFiles(payload);
  const kind = String(payload.kind || payload.type || "").toLowerCase();
  const serializedScope = JSON.stringify({
    scope: payload.scope,
    files,
    task: payload.task,
    action: payload.action,
  });
  const writesCode = payload.implementation === true || payload.writes_code === true;

  let complexity = "medium";
  if (writesCode || files.length > 10 || Number(payload.module_count || 0) >= 3 || priorFailures >= 2) {
    complexity = "high";
  } else if (files.length === 1 || ["synthetic", "fixture", "classify"].includes(kind)) {
    complexity = "low";
  }

  let riskClass = HIGH_RISK_PATTERN.test(serializedScope) ? "high" : "medium";
  if (complexity === "low" && !HIGH_RISK_PATTERN.test(serializedScope)) riskClass = "low";
  if (job?.requires_review === true && job?.workspace_type === "system" && writesCode) riskClass = "high";
  if (jobType === "inbox.triage" && riskClass === "low") riskClass = "medium";
  if (jobType === "inbox.draft" || payload.needsIndependentReview === true) riskClass = "high";
  if (/architect|root cause|escalat|ambiguous/i.test(`${payload.type || ""} ${payload.task || ""}`)) riskClass = "high";

  return {
    taskType: String(payload.type || jobType),
    complexity,
    riskClass,
    priorFailures,
    scopeFingerprint: fingerprint,
    writesCode,
    fileCount: files.length,
    moduleCount: Number(payload.module_count || 0),
    needsIndependentReview: payload.needsIndependentReview === true,
  };
}

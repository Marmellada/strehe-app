import { getState, setState } from "./sqlite.mjs";

const FULL_SHA = /^[0-9a-f]{40}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COMPLETED_REVIEW_OUTCOMES = new Set(["NO_FINDINGS", "FINDINGS"]);

function parseEvidence(row, label) {
  try {
    const value = JSON.parse(row?.evidence_ref || "null");
    if (!value || typeof value !== "object") throw new Error("not an object");
    return value;
  } catch {
    throw new Error(`${label} evidence is missing or invalid`);
  }
}

function requireFullSha(value, label) {
  const normalized = String(value || "").toLowerCase();
  if (!FULL_SHA.test(normalized)) throw new Error(`${label} must be a full Git SHA`);
  return normalized;
}

function requireApproval(approval) {
  if (approval?.decision !== "approved") throw new Error("review approval is required");
  if (!UUID.test(String(approval.jobId || ""))) throw new Error("approved job id is required");
  if (!UUID.test(String(approval.approvedByUserId || ""))) throw new Error("authenticated approving user id is required");
  return {
    decision: "approved",
    jobId: String(approval.jobId).toLowerCase(),
    approvedByUserId: String(approval.approvedByUserId).toLowerCase(),
    approvedAt: String(approval.approvedAt || new Date().toISOString()),
  };
}

export function advanceLastReviewedCommit(db, {
  sessionId,
  baseCommit,
  targetCommit,
  approval,
  advancedAt = new Date().toISOString(),
}) {
  const base = requireFullSha(baseCommit, "base commit");
  const target = requireFullSha(targetCommit, "target commit");
  if (base === target) throw new Error("review advancement range must not be empty");
  const approved = requireApproval(approval);
  let affected = [];
  db.exec("BEGIN IMMEDIATE;");
  try {
    const session = db.prepare("SELECT * FROM review_sessions WHERE id = ?").get(String(sessionId || ""));
    if (!session || session.scope !== "review" || session.status !== "done") {
      throw new Error("completed change-aware review session is required");
    }
    if (session.base_commit !== base || session.current_commit !== target) {
      throw new Error("review session does not cover the requested commit range");
    }
    if (String(session.supabase_job_id || "").toLowerCase() !== approved.jobId) {
      throw new Error("approval does not match the reviewed job");
    }
    const current = getState(db, "last_reviewed_commit");
    if (current !== base) throw new Error(`review range would skip history: expected base ${current || "unset"}`);
    const taskSummary = db.prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'done' THEN 0 ELSE 1 END) AS incomplete
       FROM review_tasks WHERE session_id = ?`,
    ).get(session.id);
    if (!taskSummary?.total || Number(taskSummary.incomplete || 0) > 0) {
      throw new Error("review session has incomplete or failed tasks");
    }
    const rangeEvidence = db.prepare(
      `SELECT * FROM validation_records
       WHERE run_id = ? AND module = 'repository'
         AND commit_sha = ? AND check_performed LIKE 'change-aware diff (%'
       ORDER BY id DESC LIMIT 1`,
    ).get(session.id, target);
    if (!rangeEvidence || rangeEvidence.state !== "VALIDATED") {
      throw new Error("validated change-aware range evidence is missing");
    }
    const coverage = db.prepare(
      `SELECT * FROM validation_records
       WHERE run_id = ? AND module = 'repository'
         AND commit_sha = ? AND check_performed LIKE 'module attribution coverage:%'
       ORDER BY id DESC LIMIT 1`,
    ).get(session.id, target);
    if (!coverage || coverage.state !== "VALIDATED") {
      throw new Error("module attribution coverage is incomplete");
    }
    affected = db.prepare(
      `SELECT DISTINCT module FROM validation_records
       WHERE run_id = ? AND commit_sha = ? AND module NOT IN ('repository')
         AND (check_performed = 're-validated after checks passed'
           OR check_performed LIKE 'STALE — affected by change%')`,
    ).all(session.id, target).map((row) => row.module);
    for (const moduleName of affected) {
      const moduleRow = db.prepare(
        `SELECT validation_state, last_validated_commit, last_reviewed_fingerprint,
                last_meaningful_review_at, last_review_outcome
         FROM modules WHERE name = ?`,
      ).get(moduleName);
      if (!moduleRow
        || !moduleRow.last_reviewed_fingerprint
        || !moduleRow.last_meaningful_review_at
        || !COMPLETED_REVIEW_OUTCOMES.has(moduleRow.last_review_outcome)) {
        throw new Error(`required semantic review coverage is incomplete for ${moduleName}`);
      }
      const baselineObservation = db.prepare(
        `SELECT * FROM validation_records
         WHERE module = ? AND commit_sha = ?
           AND check_performed = 'baseline scope fingerprint observation (structural mapping only; not a semantic review)'
         ORDER BY id DESC LIMIT 1`,
      ).get(moduleName, target);
      const baselineEvidence = parseEvidence(baselineObservation, `baseline fingerprint for ${moduleName}`);
      if (baselineEvidence.kind !== "baseline_scope_fingerprint"
        || baselineEvidence.reviewed !== false
        || baselineEvidence.available !== true
        || !baselineEvidence.fingerprint) {
        throw new Error(`target fingerprint is unavailable for ${moduleName}`);
      }
      const semanticReview = db.prepare(
        `SELECT record.* FROM validation_records record
         JOIN review_sessions session ON session.id = record.run_id
         WHERE record.module = ? AND record.commit_sha = ?
           AND record.check_performed LIKE 'bounded proactive review %'
           AND session.scope = 'proactive' AND session.status = 'done'
           AND session.base_commit = ? AND session.current_commit = ?
         ORDER BY record.id DESC LIMIT 1`,
      ).get(moduleName, target, target, target);
      const semanticEvidence = parseEvidence(semanticReview, `semantic review for ${moduleName}`);
      if (semanticEvidence.kind !== "semantic_module_review"
        || semanticEvidence.reviewed !== true
        || semanticEvidence.commit !== target
        || !COMPLETED_REVIEW_OUTCOMES.has(semanticEvidence.outcome)
        || semanticEvidence.outcome !== moduleRow.last_review_outcome
        || semanticEvidence.module_fingerprint !== moduleRow.last_reviewed_fingerprint
        || semanticEvidence.module_fingerprint !== baselineEvidence.fingerprint
        || semanticReview.created_at !== moduleRow.last_meaningful_review_at) {
        throw new Error(`semantic review evidence does not match target content for ${moduleName}`);
      }
    }
    const evidence = JSON.stringify({
      session_id: session.id,
      affected_modules: affected,
      approval: approved,
    });
    db.prepare(
      `INSERT INTO review_commit_advancements
        (session_id, base_commit, target_commit, approved_job_id,
         approved_by_user_id, evidence_json, advanced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      session.id,
      base,
      target,
      approved.jobId,
      approved.approvedByUserId,
      evidence,
      advancedAt,
    );
    db.prepare(
      `INSERT INTO validation_records
        (module, check_performed, evidence_ref, commit_sha, state, run_id, created_at)
       VALUES ('repository', ?, ?, ?, 'VALIDATED', ?, ?)`,
    ).run(`last_reviewed_commit advanced from ${base} to ${target}`, evidence, target, session.id, advancedAt);
    setState(db, "last_reviewed_commit", target);
    setState(db, "last_reviewed_at", advancedAt);
    setState(db, "last_review_decision", "APPROVED");
    setState(db, "last_review_scope", `${base}..${target}`);
    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
  return { baseCommit: base, targetCommit: target, affectedModules: affected, approval: approved };
}

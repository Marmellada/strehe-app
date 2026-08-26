import { getState, openDatabase, setState } from "./sqlite.mjs";

export const DEFAULT_PROACTIVE_CADENCE_MS = 4 * 60 * 60 * 1000;
export const DEFAULT_MODULE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_FAILURE_COOLDOWN_MS = 12 * 60 * 60 * 1000;
export const CONTROL_UNAVAILABLE = Object.freeze({
  proactive_enabled: false,
  paused: true,
  cadence_minutes: 240,
  next_proactive_at: null,
  manual_review_requested_at: null,
  worker_state: "offline",
  control_available: false,
});

const CRITICALITY_WEIGHT = { high: 400, medium: 250, low: 100, deferred: -1000 };
const VALIDATION_WEIGHT = {
  FAILED: 500,
  STALE: 400,
  NEEDS_REVIEW: 300,
  UNKNOWN: 250,
  VALIDATED: 0,
  DEFERRED: -1000,
};
const RISK_WORDS = /auth|security|billing|payment|messag|notification|infra|agent|reliab/i;

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function sanitizeSnapshotValue(value) {
  if (typeof value === "string") {
    return value.replace(/\u0000/g, "\uFFFD");
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeSnapshotValue(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        sanitizeSnapshotValue(item),
      ]),
    );
  }
  return value;
}

function timeValue(value) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export function isProactiveDue({ nowMs, nextEligibleAt, enabled = true, paused = false }) {
  if (!enabled || paused) return false;
  const dueMs = timeValue(nextEligibleAt);
  return dueMs !== null && nowMs >= dueMs;
}

export function initializeNextEligibility(db, nowMs, cadenceMs = DEFAULT_PROACTIVE_CADENCE_MS) {
  const existing = getState(db, "proactive_next_eligible_at");
  if (timeValue(existing) !== null) return existing;
  const next = new Date(nowMs + cadenceMs).toISOString();
  setState(db, "proactive_next_eligible_at", next);
  return next;
}

export function selectProactiveTarget(
  modules,
  {
    nowMs,
    currentFingerprint,
    cooldownMs = DEFAULT_MODULE_COOLDOWN_MS,
    failureCooldownMs = DEFAULT_FAILURE_COOLDOWN_MS,
  } = {},
) {
  const eligible = modules
    .filter((module) => module.validation_state !== "DEFERRED" && module.criticality !== "deferred")
    .filter((module) => {
      const failedAt = timeValue(module.last_proactive_failure_at);
      if (failedAt !== null && nowMs - failedAt < failureCooldownMs) return false;
      const reviewedAt = timeValue(module.last_meaningful_review_at);
      const recentlyReviewed = reviewedAt !== null && nowMs - reviewedAt < cooldownMs;
      const fingerprint = module.current_module_fingerprint || currentFingerprint;
      const unchanged = Boolean(fingerprint) && module.last_reviewed_fingerprint === fingerprint;
      return !(recentlyReviewed && unchanged);
    })
    .map((module) => {
      const findings = parseJsonArray(module.known_findings).length;
      const tests = parseJsonArray(module.tests).length;
      const reviewedAt = timeValue(module.last_meaningful_review_at);
      const ageHours = reviewedAt === null ? 24 * 365 : Math.max(0, (nowMs - reviewedAt) / 3_600_000);
      const validationWeight = module.validation_state === "NEEDS_REVIEW"
        && module.last_review_outcome === "FINDINGS"
        && findings === 0
        ? 0
        : (VALIDATION_WEIGHT[module.validation_state] ?? 0);
      const score =
        (CRITICALITY_WEIGHT[module.criticality] ?? 0) +
        validationWeight +
        Math.min(findings, 5) * 80 +
        (tests === 0 ? 120 : 0) +
        (RISK_WORDS.test(`${module.name} ${module.purpose || ""}`) ? 90 : 0) +
        Math.min(Math.floor(ageHours), 365);
      return { ...module, proactive_score: score };
    });

  eligible.sort((a, b) => b.proactive_score - a.proactive_score || a.name.localeCompare(b.name));
  return eligible[0] || null;
}

export function loadProactiveTarget(db, options) {
  const modules = db.prepare("SELECT * FROM modules ORDER BY name").all();
  return selectProactiveTarget(modules, options);
}

export function recordProactiveOutcome(db, {
  sessionId,
  moduleName,
  commit,
  fingerprint,
  findings,
  reviewedAt,
}) {
  const safeFindings = Array.isArray(findings) ? findings.slice(0, 5) : [];
  const outcome = safeFindings.length > 0 ? "FINDINGS" : "NO_FINDINGS";
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const finding of safeFindings) {
      db.prepare(
        `INSERT INTO engineering_findings
          (session_id, module, finding, evidence, recommendation, severity, confidence, lifecycle)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'OPEN')`,
      ).run(
        sessionId,
        moduleName,
        String(finding.summary || finding.finding || "Finding").slice(0, 2000),
        JSON.stringify(finding.evidence || []),
        String(finding.recommendation || "Human review required before remediation.").slice(0, 4000),
        ["critical", "high", "medium", "low", "info"].includes(finding.severity) ? finding.severity : "info",
        ["high", "medium", "low"].includes(finding.confidence) ? finding.confidence : "medium",
      );
    }

    const openFindings = db
      .prepare("SELECT id, finding, severity FROM engineering_findings WHERE module = ? AND lifecycle = 'OPEN' ORDER BY id DESC LIMIT 10")
      .all(moduleName);
    db.prepare(
      `UPDATE modules
       SET validation_state = ?, last_validated_commit = ?, last_meaningful_review_at = ?,
           last_reviewed_fingerprint = ?, last_review_outcome = ?, known_findings = ?,
           last_proactive_attempt_at = ?, last_proactive_failure_at = NULL,
           last_proactive_failure_class = NULL, proactive_failure_count = 0, updated_at = ?
       WHERE name = ?`,
    ).run(
      safeFindings.length > 0 ? "NEEDS_REVIEW" : "VALIDATED",
      commit,
      reviewedAt,
      fingerprint,
      outcome,
      JSON.stringify(openFindings),
      reviewedAt,
      reviewedAt,
      moduleName,
    );
    db.prepare(
      `INSERT INTO validation_records
        (module, check_performed, commit_sha, state, run_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      moduleName,
      safeFindings.length > 0
        ? `bounded proactive review recorded ${safeFindings.length} finding(s)`
        : "bounded proactive review completed with explicit no-finding outcome",
      commit,
      safeFindings.length > 0 ? "NEEDS_REVIEW" : "VALIDATED",
      sessionId,
      reviewedAt,
    );
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return outcome;
}

export function recordProactiveAttempt(db, { moduleName, attemptedAt }) {
  db.prepare(
    "UPDATE modules SET last_proactive_attempt_at = ?, updated_at = ? WHERE name = ?",
  ).run(attemptedAt, attemptedAt, moduleName);
}

export function recordProactiveFailure(db, {
  sessionId = null,
  moduleName,
  commit = null,
  attemptedAt,
  failureClass,
}) {
  const safeClass = String(failureClass || "proactive_analysis_failed")
    .replace(/[^a-z0-9._-]/gi, "_")
    .slice(0, 120) || "proactive_analysis_failed";
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(
      `UPDATE modules SET validation_state = 'FAILED', last_review_outcome = 'FAILED',
         last_proactive_attempt_at = ?, last_proactive_failure_at = ?,
         last_proactive_failure_class = ?, proactive_failure_count = proactive_failure_count + 1,
         updated_at = ? WHERE name = ?`,
    ).run(attemptedAt, attemptedAt, safeClass, attemptedAt, moduleName);
    db.prepare(
      `INSERT INTO validation_records
        (module, check_performed, commit_sha, state, run_id, created_at)
       VALUES (?, ?, ?, 'FAILED', ?, ?)`,
    ).run(moduleName, `bounded proactive attempt failed (${safeClass})`, commit, sessionId, attemptedAt);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return safeClass;
}

export function updateFindingLifecycle(db, { findingId, lifecycle, decidedAt }) {
  const allowed = new Set(["OPEN", "ACKNOWLEDGED", "DEFERRED", "RESOLVED"]);
  if (!allowed.has(lifecycle)) throw new Error("invalid finding lifecycle");
  db.exec("BEGIN IMMEDIATE");
  try {
    const finding = db.prepare("SELECT id, module, lifecycle FROM engineering_findings WHERE id = ?").get(findingId);
    if (!finding) throw new Error("engineering finding not found");
    db.prepare("UPDATE engineering_findings SET lifecycle = ? WHERE id = ?").run(lifecycle, findingId);
    db.prepare(
      "INSERT INTO engineering_decisions (finding_id, decision, reason, decided_at) VALUES (?, ?, ?, ?)",
    ).run(findingId, lifecycle, "Operator lifecycle update", decidedAt);
    const openFindings = db.prepare(
      "SELECT id, finding, severity FROM engineering_findings WHERE module = ? AND lifecycle = 'OPEN' ORDER BY id DESC LIMIT 10",
    ).all(finding.module);
    db.prepare("UPDATE modules SET known_findings = ?, updated_at = ? WHERE name = ?")
      .run(JSON.stringify(openFindings), decidedAt, finding.module);
    db.exec("COMMIT");
    return { ...finding, lifecycle };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function readRecentEngineeringDecisions(db, moduleName, limit = 8) {
  const safeModuleName = String(moduleName || "").trim();
  if (!safeModuleName) return [];

  const numericLimit = Number(limit);
  const safeLimit = Number.isFinite(numericLimit)
    ? Math.max(1, Math.min(8, Math.floor(numericLimit)))
    : 8;

  return db.prepare(
    `SELECT d.decision, d.reason, d.revisit_condition, d.revisit_date, d.decided_at,
            f.finding, f.severity
     FROM engineering_decisions d
     JOIN engineering_findings f ON f.id = d.finding_id
     WHERE f.module = ?
     ORDER BY d.decided_at DESC, d.id DESC
     LIMIT ?`,
  ).all(safeModuleName, safeLimit);
}

export function buildEngineeringSnapshot(db, { model, runtimeStatus = "idle", currentJobId = null } = {}) {
  const modules = db.prepare(
    `SELECT name, criticality, validation_state, last_validated_commit,
            last_meaningful_review_at, last_review_outcome, last_proactive_attempt_at,
            last_proactive_failure_at, last_proactive_failure_class
     FROM modules ORDER BY name`,
  ).all();
  const findings = db.prepare(
    `SELECT id, module, finding AS summary, evidence, recommendation, severity, confidence,
            lifecycle, created_at
     FROM engineering_findings
     ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END,
              created_at DESC LIMIT 100`,
  ).all().map((row) => ({ ...row, evidence: parseJsonArray(row.evidence) }));
  const counts = modules.reduce((result, module) => {
    const key = module.validation_state === "VALIDATED"
      ? "validated"
      : module.validation_state === "DEFERRED"
        ? "deferred"
        : "stale";
    result[key] += 1;
    return result;
  }, { validated: 0, stale: 0, deferred: 0 });

  return sanitizeSnapshotValue({
    schema_version: 1,
    model,
    runtime_status: runtimeStatus,
    current_job_id: currentJobId,
    next_proactive_at: getState(db, "proactive_next_eligible_at"),
    counts: { ...counts, pending_findings: findings.filter((item) => item.lifecycle === "OPEN").length },
    modules,
    findings,
    generated_at: new Date().toISOString(),
  });
}

export async function readEngineeringControl(runtime) {
  try {
    const { data, error } = await runtime.supabase
      .from("agent_operator_controls")
      .select("proactive_enabled,paused,cadence_minutes,next_proactive_at,manual_review_requested_at,worker_state")
      .eq("agent_id", runtime.agentId)
      .maybeSingle();
    if (error || !data) throw new Error("control_query_failed");
    runtime.controlWarningLogged = false;
    return { ...data, control_available: true };
  } catch {
    if (!runtime.controlWarningLogged) {
      runtime.logger?.log("engineering_control_unavailable", { error_class: "control_plane_unavailable" });
      runtime.controlWarningLogged = true;
    }
    return { ...CONTROL_UNAVAILABLE };
  }
}

export async function publishEngineeringSnapshot(runtime, runtimeStatus = "idle", currentJobId = null, errorClass = null) {
  const { db } = openDatabase(runtime.config.runtimeRoot);
  let snapshot;
  try {
    snapshot = buildEngineeringSnapshot(db, {
      model: runtime.config.ollamaModel,
      runtimeStatus,
      currentJobId,
    });
  } finally {
    db.close();
  }
  const { error } = await runtime.supabase.rpc("publish_engineering_agent_snapshot", {
    status_snapshot: snapshot,
    local_model_name: runtime.config.ollamaModel,
    worker_state: runtimeStatus,
    active_job_id: currentJobId,
    worker_error_class: errorClass,
  });
  if (error) throw new Error(`engineering snapshot publish failed: ${error.message}`);
  return snapshot;
}

export async function maybeEnqueueProactiveJob(runtime, { now = new Date(), control: suppliedControl = null } = {}) {
  const { db } = openDatabase(runtime.config.runtimeRoot);
  try {
    const nowMs = now.getTime();
    const control = suppliedControl || await readEngineeringControl(runtime);
    if (!control.control_available) return { enqueued: false, reason: "control_unavailable" };

  const cadenceMs = Math.max(60, Number(control?.cadence_minutes || 240)) * 60_000;
  const cloudNext = control?.next_proactive_at || null;
  if (timeValue(cloudNext) !== null) setState(db, "proactive_next_eligible_at", cloudNext);
  const nextEligibleAt = cloudNext || initializeNextEligibility(db, nowMs, cadenceMs);
  if (!isProactiveDue({
    nowMs,
    nextEligibleAt,
    enabled: control?.proactive_enabled !== false || Boolean(control?.manual_review_requested_at),
    paused: control?.paused === true,
  })) return { enqueued: false, reason: "not_due" };

  const rev = await runtime.tools.runTool("git.rev");
  if (!rev.ok) return { enqueued: false, reason: "git_unavailable" };
  const modules = db.prepare("SELECT * FROM modules ORDER BY name").all();
  for (const targetModule of modules) {
    const failedAt = timeValue(targetModule.last_proactive_failure_at);
    const failureCooldownMs = runtime.config.proactiveFailureCooldownMs || DEFAULT_FAILURE_COOLDOWN_MS;
    if (failedAt !== null && nowMs - failedAt < failureCooldownMs) continue;
    const sourcePaths = parseJsonArray(targetModule.source_paths);
    const scoped = sourcePaths.length > 0
      ? await runtime.tools.runTool("git.scope_fingerprint", { paths: sourcePaths })
      : { ok: true, fileCount: 0 };
    if (scoped.ok && scoped.fileCount > 0) {
      targetModule.current_module_fingerprint = scoped.fingerprint;
    } else if (scoped.ok && scoped.fileCount === 0 && targetModule.validation_state !== "DEFERRED") {
      recordProactiveFailure(db, {
        moduleName: targetModule.name,
        commit: rev.commit,
        attemptedAt: now.toISOString(),
        failureClass: "zero_readable_files",
      });
      targetModule.last_proactive_failure_at = now.toISOString();
      targetModule.last_proactive_failure_class = "zero_readable_files";
      targetModule.validation_state = "FAILED";
    }
  }
  const target = selectProactiveTarget(modules, {
    nowMs,
    currentFingerprint: rev.tree,
    cooldownMs: runtime.config.proactiveModuleCooldownMs || DEFAULT_MODULE_COOLDOWN_MS,
    failureCooldownMs: runtime.config.proactiveFailureCooldownMs || DEFAULT_FAILURE_COOLDOWN_MS,
  });
  if (!target) {
    const { data: deferred, error: deferError } = await runtime.supabase.rpc("defer_engineering_proactive", {
      defer_reason: "no_eligible_target",
    });
    if (deferError) throw new Error(`proactive defer failed: ${deferError.message}`);
    const next = deferred?.next_proactive_at || new Date(nowMs + cadenceMs).toISOString();
    setState(db, "proactive_next_eligible_at", next);
    return { enqueued: false, reason: "no_eligible_target", nextEligibleAt: next };
  }

  const { data, error } = await runtime.supabase.rpc("enqueue_due_engineering_proactive", {
    target_module: target.name,
    target_commit: rev.commit,
    target_fingerprint: rev.tree,
    target_module_fingerprint: target.current_module_fingerprint || rev.tree,
  });
  if (error) throw new Error(`proactive enqueue failed: ${error.message}`);
  const result = data && typeof data === "object" ? data : {};
  if (result.next_proactive_at) setState(db, "proactive_next_eligible_at", result.next_proactive_at);
    return { ...result, target: target.name };
  } finally {
    db.close();
  }
}

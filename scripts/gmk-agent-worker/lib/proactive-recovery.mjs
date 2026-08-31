import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { assertSafeResult } from "./validate.mjs";

export const PROACTIVE_RECOVERY_PINS = Object.freeze({
  jobId: "795ec8d1-1b07-48e1-b18d-442f50ee1ff1",
  sessionId: "ENG-PROACTIVE-795ec8d1-1b07-48e1-b18d-442f50ee1ff1",
  moduleName: "Supabase infra",
  targetCommit: "d022d3a63fca2835b877235691b7d255d58e461c",
  targetTree: "1751ba633a2fdd65ec1c31595e69ccd8010bc877",
  moduleFingerprint: "d93c0866e59a2857c5dad9ff011f95456052b5e0cf2e688816f9097399c26aad",
  evidenceSha256: "d1daebe0d8582440e2cf42e70366f9e158ff759a918d79405a8b2289aeb5a513",
  findingIds: Object.freeze([50, 51, 52, 53, 54]),
  provider: "opencode",
  model: "kimi-k2.7-code",
});

const EXPECTED_TASK_KINDS = Object.freeze(["git.rev", "git.status", "proactive.analyze"]);
const PROTECTED_TABLES = Object.freeze([
  "engineering_findings",
  "validation_records",
  "review_evidence",
  "llm_usage_ledger",
]);

function invariant(condition, message) {
  if (!condition) throw new Error(`proactive recovery preflight failed: ${message}`);
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

export function stableJson(value) {
  return JSON.stringify(stableValue(value));
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hashRows(rows) {
  return sha256(stableJson(rows));
}

function queryRows(db, sql, ...params) {
  return db.prepare(sql).all(...params);
}

function snapshotProtectedTables(db) {
  return Object.fromEntries(PROTECTED_TABLES.map((table) => {
    const rows = queryRows(db, `SELECT * FROM ${table} ORDER BY id`);
    return [table, { count: rows.length, sha256: hashRows(rows) }];
  }));
}

function inspectRepository(repoPath, pins) {
  const git = (...args) => execFileSync("git", ["-C", repoPath, ...args], { encoding: "utf8" }).trim();
  return {
    targetCommit: git("rev-parse", pins.targetCommit),
    targetTree: git("rev-parse", `${pins.targetCommit}^{tree}`),
    currentHead: git("rev-parse", "HEAD"),
    currentTree: git("rev-parse", "HEAD^{tree}"),
    clean: git("status", "--porcelain=v1").length === 0,
  };
}

function buildSafeRecoveredResult({ analysis, gitRev, pins }) {
  return {
    schema_version: 1,
    agent: "engineering",
    session_id: pins.sessionId,
    review_kind: "proactive",
    git_commit: pins.targetCommit,
    git_tree: gitRev.tree,
    scope: "proactive",
    changed_files: [],
    checks_performed: EXPECTED_TASK_KINDS.map((kind) => ({ kind })),
    checks_selected: [],
    carried_forward: [],
    validated_modules: [],
    stale_modules: [pins.moduleName],
    impact: {
      directly_affected: [pins.moduleName],
      dependency_affected: [],
      deferred: [],
      known_global_paths: [],
      unmapped_paths: [],
    },
    findings: analysis.findings,
    severity: "info",
    confidence: "medium",
    questions: [],
    summary: `${pins.moduleName}: ${analysis.summary} (FINDINGS)`,
    production_changes_made: false,
    privacy: { external_ai_used: true, local_processing: false },
    runtime: {
      provider: analysis.telemetry?.provider,
      model: analysis.telemetry?.model,
      protocol: "openai_chat_completions",
      attempts: 1,
      duration_ms: 0,
      tool_calls: EXPECTED_TASK_KINDS.length,
    },
  };
}

function assertFindingMatches(row, finding, pins, expectedId) {
  invariant(row.id === expectedId, `expected finding id ${expectedId}`);
  invariant(row.session_id === pins.sessionId, `finding ${expectedId} has wrong session`);
  invariant(row.module === pins.moduleName, `finding ${expectedId} has wrong module`);
  invariant(row.finding === finding.summary, `finding ${expectedId} summary differs from evidence`);
  invariant(row.evidence === JSON.stringify(finding.evidence || []), `finding ${expectedId} evidence differs from analysis`);
  invariant(row.recommendation === finding.recommendation, `finding ${expectedId} recommendation differs from analysis`);
  invariant(row.severity === finding.severity, `finding ${expectedId} severity differs from analysis`);
  invariant(row.confidence === finding.confidence, `finding ${expectedId} confidence differs from analysis`);
  invariant(row.lifecycle === "OPEN", `finding ${expectedId} lifecycle is not OPEN`);
}

export function verifyProactiveRecovery({ dbPath, repoPath, repoState, pins = PROACTIVE_RECOVERY_PINS, now = new Date() }) {
  invariant(path.isAbsolute(dbPath), "SQLite path must be absolute");
  const repository = repoState || inspectRepository(repoPath, pins);
  invariant(repository.targetCommit === pins.targetCommit, "target commit does not resolve exactly");
  invariant(repository.targetTree === pins.targetTree, "target commit tree does not match pinned evidence");
  invariant(repository.clean === true, "repository worktree is not clean");

  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    db.exec("PRAGMA query_only = ON");
    const protectedBefore = snapshotProtectedTables(db);
    const session = db.prepare("SELECT * FROM review_sessions WHERE id = ?").get(pins.sessionId);
    invariant(session?.supabase_job_id === pins.jobId, "session is not bound to the pinned Supabase job");
    invariant(session.scope === "proactive" && session.status === "done", "session is not a completed proactive session");
    invariant(session.base_commit === pins.targetCommit && session.current_commit === pins.targetCommit, "session commit range is not pinned target commit");

    const tasks = queryRows(db, "SELECT * FROM review_tasks WHERE session_id = ? ORDER BY id", pins.sessionId);
    invariant(tasks.length === EXPECTED_TASK_KINDS.length, "session must contain exactly three tasks");
    invariant(stableJson(tasks.map((task) => task.kind).sort()) === stableJson([...EXPECTED_TASK_KINDS].sort()), "session task kinds differ from the recovery plan");
    invariant(tasks.every((task) => task.status === "done"), "every recovery task must be done");
    invariant(tasks.every((task) => task.retry_count === 0), "recovery tasks must have zero retries");

    const evidence = queryRows(db,
      `SELECT e.* FROM review_evidence e
       JOIN review_tasks t ON t.id = e.task_id
       WHERE t.session_id = ? ORDER BY e.id`, pins.sessionId);
    invariant(evidence.length === EXPECTED_TASK_KINDS.length, "session must contain exactly three evidence rows");

    const evidenceFor = (taskKind, evidenceKind = taskKind) => {
      const task = tasks.find((entry) => entry.kind === taskKind);
      const rows = evidence.filter((entry) => entry.task_id === task.id && entry.kind === evidenceKind);
      invariant(rows.length === 1, `${taskKind} must have exactly one matching evidence row`);
      invariant(stableJson(JSON.parse(task.evidence_refs || "[]")) === stableJson([rows[0].id]), `${taskKind} evidence reference is inconsistent`);
      return rows[0];
    };

    const gitRevEvidence = evidenceFor("git.rev");
    const gitRev = JSON.parse(gitRevEvidence.content);
    invariant(gitRev.commit === pins.targetCommit && gitRev.tree === pins.targetTree, "git.rev evidence does not match pinned commit/tree");
    const gitStatus = JSON.parse(evidenceFor("git.status").content);
    invariant(gitStatus.clean === true, "git.status evidence is not clean");

    const analysisEvidence = evidenceFor("proactive.analyze", "proactive.analysis");
    const rawAnalysis = Buffer.from(analysisEvidence.content, "utf8");
    invariant(sha256(rawAnalysis) === pins.evidenceSha256, "raw proactive.analysis SHA-256 does not match the pin");
    const analysis = JSON.parse(analysisEvidence.content);
    invariant(Array.isArray(analysis.findings) && analysis.findings.length === pins.findingIds.length, "analysis must contain exactly five findings");
    invariant(analysis.telemetry?.provider === pins.provider && analysis.telemetry?.model === pins.model, "analysis telemetry provider/model differs from the ledger pin");
    const recoveredResult = buildSafeRecoveredResult({ analysis, gitRev, pins });
    assertSafeResult(recoveredResult);

    const moduleRow = db.prepare("SELECT * FROM modules WHERE name = ?").get(pins.moduleName);
    invariant(moduleRow?.last_review_outcome === "FINDINGS", "module outcome is not FINDINGS");
    invariant(moduleRow.last_validated_commit === pins.targetCommit, "module validated commit does not match the target");
    invariant(moduleRow.last_reviewed_fingerprint === pins.moduleFingerprint, "module reviewed fingerprint does not match the pin");
    invariant(moduleRow.last_proactive_failure_at === null
      && moduleRow.last_proactive_failure_class === null
      && moduleRow.proactive_failure_count === 0, "module contains a proactive failure marker");

    const findings = queryRows(db, "SELECT * FROM engineering_findings WHERE session_id = ? ORDER BY id", pins.sessionId);
    invariant(findings.length === pins.findingIds.length, "expected findings must exist exactly once");
    findings.forEach((row, index) => assertFindingMatches(row, analysis.findings[index], pins, pins.findingIds[index]));

    const validations = queryRows(db, "SELECT * FROM validation_records WHERE run_id = ? ORDER BY id", pins.sessionId);
    invariant(validations.length === 1, "semantic validation record must exist exactly once");
    const validation = validations[0];
    const validationEvidence = JSON.parse(validation.evidence_ref || "null");
    invariant(validation.module === pins.moduleName
      && validation.commit_sha === pins.targetCommit
      && validation.state === "NEEDS_REVIEW"
      && validationEvidence?.kind === "semantic_module_review"
      && validationEvidence.reviewed === true
      && validationEvidence.commit === pins.targetCommit
      && validationEvidence.module_fingerprint === pins.moduleFingerprint
      && validationEvidence.outcome === "FINDINGS"
      && validationEvidence.finding_count === pins.findingIds.length,
    "semantic validation record differs from the persisted analysis");

    const ledger = queryRows(db, "SELECT * FROM llm_usage_ledger WHERE job_id = ? ORDER BY id", pins.jobId);
    invariant(ledger.length === 1, "pinned job must have exactly one historical LLM ledger row");
    invariant(ledger[0].provider === pins.provider
      && ledger[0].model === pins.model
      && ledger[0].agent_key === "engineering.local"
      && ledger[0].task_type === "engineering.proactive"
      && ledger[0].api_calls === 1,
      "historical LLM ledger provider/model/api_calls differs from the pin");

    const protectedAfter = snapshotProtectedTables(db);
    invariant(stableJson(protectedAfter) === stableJson(protectedBefore), "read-only preflight changed protected local state");

    return {
      schema_version: 1,
      mode: "dry-run",
      verified_at: now.toISOString(),
      job_id: pins.jobId,
      session_id: pins.sessionId,
      target_commit: pins.targetCommit,
      target_tree: pins.targetTree,
      target_module: pins.moduleName,
      module_fingerprint: pins.moduleFingerprint,
      evidence_sha256: pins.evidenceSha256,
      reconstructed_result_sha256: sha256(stableJson(recoveredResult)),
      repository: {
        current_head: repository.currentHead,
        current_tree: repository.currentTree,
        clean: repository.clean,
      },
      existing_findings: { ids: findings.map((row) => row.id), count: findings.length, sha256: hashRows(findings) },
      validation_records: { count: validations.length, sha256: hashRows(validations) },
      review_evidence: { count: evidence.length, sha256: hashRows(evidence) },
      llm_usage_ledger: { count: ledger.length, api_calls: ledger[0].api_calls, sha256: hashRows(ledger) },
      protected_local_state_before: protectedBefore,
      protected_local_state_after: protectedAfter,
      recovery_rpc: "operator_recover_engineering_proactive",
      recovery_rpc_payload: {
        target_job_id: pins.jobId,
        expected_session_id: pins.sessionId,
        expected_target_commit: pins.targetCommit,
        expected_module_fingerprint: pins.moduleFingerprint,
        evidence_sha256: pins.evidenceSha256,
      },
    };
  } finally {
    db.close();
  }
}

export function writeRecoveryManifest(runtimeRoot, manifest) {
  const artifactDir = path.join(runtimeRoot, "state", "artifacts");
  fs.mkdirSync(artifactDir, { recursive: true });
  const timestamp = manifest.verified_at.replaceAll(":", "").replaceAll("-", "").replace(/\.\d{3}Z$/, "Z");
  const artifactPath = path.join(artifactDir, `engineering-proactive-recovery-${manifest.job_id}-${timestamp}.json`);
  fs.writeFileSync(artifactPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  return artifactPath;
}

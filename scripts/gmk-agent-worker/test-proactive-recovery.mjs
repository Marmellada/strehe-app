import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { openDatabase } from "./lib/sqlite.mjs";
import {
  sha256,
  stableJson,
  verifyProactiveRecovery,
  writeRecoveryManifest,
} from "./lib/proactive-recovery.mjs";
import { assertNoSecrets } from "./lib/validate.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TARGET_COMMIT = "d".repeat(40);
const TARGET_TREE = "e".repeat(40);
const MODULE_FINGERPRINT = "f".repeat(64);
const JOB = "795ec8d1-1b07-48e1-b18d-442f50ee1ff1";
const SESSION = `ENG-PROACTIVE-${JOB}`;

function analysisFixture() {
  return {
    summary: "Bounded semantic review found five reviewable issues.",
    findings: Array.from({ length: 5 }, (_, index) => ({
      severity: index < 2 ? "high" : "medium",
      confidence: "high",
      summary: `Finding ${index + 1}`,
      evidence: index === 1
        ? ["Privileges revoked from anon, authenticated, and service_role."]
        : [`supabase/migrations/example-${index}.sql: deterministic evidence`],
      recommendation: `Review recommendation ${index + 1}`,
    })),
    files_reviewed: ["supabase/migrations/example.sql"],
    telemetry: { provider: "opencode", model: "kimi-k2.7-code" },
  };
}

function createFixture(mutator) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "strehe-proactive-recovery-"));
  const opened = openDatabase(root);
  const { db, dbPath } = opened;
  const analysis = analysisFixture();
  const raw = JSON.stringify(analysis);
  const pins = {
    jobId: JOB,
    sessionId: SESSION,
    moduleName: "Supabase infra",
    targetCommit: TARGET_COMMIT,
    targetTree: TARGET_TREE,
    moduleFingerprint: MODULE_FINGERPRINT,
    evidenceSha256: sha256(Buffer.from(raw, "utf8")),
    findingIds: [50, 51, 52, 53, 54],
    provider: "opencode",
    model: "kimi-k2.7-code",
  };

  db.prepare("INSERT INTO review_sessions (id, supabase_job_id, scope, base_commit, current_commit, status) VALUES (?, ?, 'proactive', ?, ?, 'done')")
    .run(SESSION, JOB, TARGET_COMMIT, TARGET_COMMIT);
  const taskRows = [
    [147, "record exact proactive review commit and tree", "git.rev", 149],
    [148, "confirm isolated worktree state", "git.status", 150],
    [149, "bounded read-only review of Supabase infra", "proactive.analyze", 151],
  ];
  for (const [id, description, kind, evidenceId] of taskRows) {
    db.prepare("INSERT INTO review_tasks (id, session_id, description, kind, status, evidence_refs) VALUES (?, ?, ?, ?, 'done', ?)")
      .run(id, SESSION, description, kind, JSON.stringify([evidenceId]));
  }
  db.prepare("INSERT INTO review_evidence (id, task_id, kind, content) VALUES (149, 147, 'git.rev', ?)")
    .run(JSON.stringify({ kind: "git.rev", commit: TARGET_COMMIT, tree: TARGET_TREE }));
  db.prepare("INSERT INTO review_evidence (id, task_id, kind, content) VALUES (150, 148, 'git.status', ?)")
    .run(JSON.stringify({ kind: "git.status", clean: true, output: "" }));
  db.prepare("INSERT INTO review_evidence (id, task_id, kind, content) VALUES (151, 149, 'proactive.analysis', ?)").run(raw);

  db.prepare(`INSERT INTO modules
    (name, validation_state, last_validated_commit, last_reviewed_fingerprint, last_review_outcome,
     last_proactive_failure_at, last_proactive_failure_class, proactive_failure_count)
    VALUES (?, 'NEEDS_REVIEW', ?, ?, 'FINDINGS', NULL, NULL, 0)`)
    .run(pins.moduleName, TARGET_COMMIT, MODULE_FINGERPRINT);
  analysis.findings.forEach((finding, index) => {
    db.prepare(`INSERT INTO engineering_findings
      (id, session_id, module, finding, evidence, recommendation, severity, confidence, lifecycle)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OPEN')`)
      .run(50 + index, SESSION, pins.moduleName, finding.summary, JSON.stringify(finding.evidence), finding.recommendation, finding.severity, finding.confidence);
  });
  db.prepare(`INSERT INTO validation_records
    (id, module, check_performed, evidence_ref, commit_sha, state, run_id)
    VALUES (259, ?, 'bounded proactive review recorded 5 finding(s)', ?, ?, 'NEEDS_REVIEW', ?)`)
    .run(pins.moduleName, JSON.stringify({
      kind: "semantic_module_review", reviewed: true, commit: TARGET_COMMIT,
      module_fingerprint: MODULE_FINGERPRINT, outcome: "FINDINGS", finding_count: 5,
    }), TARGET_COMMIT, SESSION);
  db.prepare(`INSERT INTO llm_usage_ledger
    (id, provider, model, job_id, agent_key, task_type, input_tokens, output_tokens, reasoning_tokens, api_calls)
    VALUES (6, 'opencode', 'kimi-k2.7-code', ?, 'engineering.local', 'engineering.proactive', 10, 20, 5, 1)`)
    .run(JOB);
  mutator?.(db, { analysis, pins });
  db.close();
  return { root, dbPath, pins };
}

function repoState(pins) {
  return {
    targetCommit: pins.targetCommit,
    targetTree: pins.targetTree,
    currentHead: "a".repeat(40),
    currentTree: "b".repeat(40),
    clean: true,
  };
}

test("dry-run verifies every pinned invariant, writes a manifest, and mutates no protected local state", (t) => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  const manifest = verifyProactiveRecovery({
    dbPath: fixture.dbPath,
    repoState: repoState(fixture.pins),
    pins: fixture.pins,
    now: new Date("2026-08-31T20:00:00Z"),
  });
  assert.equal(manifest.mode, "dry-run");
  assert.deepEqual(manifest.existing_findings.ids, [50, 51, 52, 53, 54]);
  assert.equal(manifest.validation_records.count, 1);
  assert.equal(manifest.review_evidence.count, 3);
  assert.equal(manifest.llm_usage_ledger.count, 1);
  assert.equal(manifest.llm_usage_ledger.api_calls, 1);
  assert.equal(stableJson(manifest.protected_local_state_before), stableJson(manifest.protected_local_state_after));
  assert.deepEqual(manifest.recovery_rpc_payload, {
    target_job_id: JOB,
    expected_session_id: SESSION,
    expected_target_commit: TARGET_COMMIT,
    expected_module_fingerprint: MODULE_FINGERPRINT,
    evidence_sha256: fixture.pins.evidenceSha256,
  });
  const artifact = writeRecoveryManifest(fixture.root, manifest);
  assert.equal(JSON.parse(fs.readFileSync(artifact, "utf8")).evidence_sha256, fixture.pins.evidenceSha256);
});

const negativeCases = [
  ["wrong session status", (db) => db.prepare("UPDATE review_sessions SET status='open' WHERE id=?").run(SESSION), /completed proactive session/],
  ["missing task", (db) => { db.prepare("DELETE FROM review_evidence WHERE task_id=147").run(); db.prepare("DELETE FROM review_tasks WHERE id=147").run(); }, /exactly three tasks/],
  ["unfinished task", (db) => db.prepare("UPDATE review_tasks SET status='pending' WHERE id=147").run(), /must be done/],
  ["wrong git revision", (db) => db.prepare("UPDATE review_evidence SET content=? WHERE id=149").run(JSON.stringify({ kind: "git.rev", commit: "a".repeat(40), tree: TARGET_TREE })), /git\.rev evidence/],
  ["dirty historical status", (db) => db.prepare("UPDATE review_evidence SET content=? WHERE id=150").run(JSON.stringify({ kind: "git.status", clean: false })), /not clean/],
  ["changed raw analysis", (db) => db.prepare("UPDATE review_evidence SET content=content || ' ' WHERE id=151").run(), /SHA-256/],
  ["module failure marker", (db) => db.prepare("UPDATE modules SET last_proactive_failure_class='test' WHERE name='Supabase infra'").run(), /failure marker/],
  ["finding mismatch", (db) => db.prepare("UPDATE engineering_findings SET finding='changed' WHERE id=50").run(), /summary differs/],
  ["duplicate validation", (db) => db.prepare(`INSERT INTO validation_records (module, evidence_ref, commit_sha, state, run_id) SELECT module,evidence_ref,commit_sha,state,run_id FROM validation_records WHERE id=259`).run(), /exactly once/],
  ["duplicate ledger", (db) => db.prepare(`INSERT INTO llm_usage_ledger (provider,model,job_id,api_calls) VALUES ('opencode','kimi-k2.7-code',?,1)`).run(JOB), /exactly one historical/],
];

for (const [name, mutate, expected] of negativeCases) {
  test(`dry-run fails closed for ${name}`, (t) => {
    const fixture = createFixture(mutate);
    t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
    assert.throws(() => verifyProactiveRecovery({ dbPath: fixture.dbPath, repoState: repoState(fixture.pins), pins: fixture.pins }), expected);
  });
}

test("recovery implementation has no model, agent spec, or proactive outcome import path", () => {
  for (const file of ["lib/proactive-recovery.mjs", "recover-proactive.mjs"]) {
    const source = fs.readFileSync(path.join(HERE, file), "utf8");
    const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
    assert.equal(imports.some((entry) => /llm|engineering\.spec|lib\/proactive\.mjs/.test(entry)), false);
    assert.doesNotMatch(source, /createLlmRegistry|recordProactiveOutcome|\.spec\.run\s*\(/);
  }
});

test("recovery safety gate allows service_role prose and still blocks credential-shaped values", () => {
  assert.doesNotThrow(() => assertNoSecrets({ evidence: "Privileges revoked from anon, authenticated, and service_role." }));
  for (const value of [
    "eyJhbGciOiJIUzI1NiJ9.synthetic.payload",
    "sk-abcdefghijklmnop",
    "ghp_abcdefghijklmnop",
    "-----BEGIN PRIVATE KEY-----",
    "sb_secret_abcdefghijklmnop",
  ]) assert.throws(() => assertNoSecrets({ value }), /disallowed secret-like value/);
});

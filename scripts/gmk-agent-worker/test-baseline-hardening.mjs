import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { KNOWN_GLOBAL_PATHS, MODULES } from "./agents/strehe-map.mjs";
import {
  discoverBaselineCatalog,
  MAX_CHANGE_AWARE_CHECKS,
  runChangeAwareReview,
  writeBaselineMap,
} from "./agents/engineering.spec.mjs";
import { directModules, mapModuleImpact } from "./lib/impact.mjs";
import { advanceLastReviewedCommit } from "./lib/review-state.mjs";
import { openDatabase, setState } from "./lib/sqlite.mjs";
import {
  EXECUTION_CLASS,
  getScriptExecutionMetadata,
  requireScriptExecutionMetadata,
} from "./lib/execution-class.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const BASE = "1".repeat(40);
const TARGET = "2".repeat(40);
const NEXT = "3".repeat(40);
const JOB = "20000000-0000-4000-8000-000000000001";
const APPROVER = "10000000-0000-4000-8000-000000000001";

function createRuntime() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "strehe-baseline-hardening-"));
  const opened = openDatabase(root);
  return { root, ...opened };
}

function catalogOutputs() {
  const declared = [...new Set(MODULES.flatMap((module) => module.tests || []))];
  const tests = declared.filter((file) => file.startsWith("tests/"));
  const dbTests = declared.filter((file) => file.startsWith("supabase/tests/"));
  const top = declared.filter((file) => /^scripts\/[^/]+\.mjs$/.test(file));
  return {
    "tests/**": [...tests, "tests/fixtures/inbox/not-a-test.json", "tests/e2e/utils.ts"],
    "supabase/tests/**": dbTests,
    "scripts/*.mjs": [
      ...top,
      "scripts/capture-manual-screenshots.mjs",
      "scripts/run-bathroom-base-shot-engine.mjs",
      "scripts/verify-founding-funnel-local.mjs",
      "scripts/generate-unrelated-report.mjs",
    ],
    "scripts/gmk-agent-worker/test-*.mjs": [
      "scripts/gmk-agent-worker/test-baseline-hardening.mjs",
      "scripts/gmk-agent-worker/test-go-ready.mjs",
      "scripts/gmk-agent-worker/test-proactive.mjs",
      "scripts/gmk-agent-worker/test-review-reconciliation.mjs",
      "scripts/gmk-agent-worker/test-router-p3.mjs",
      "scripts/gmk-agent-worker/test-router-p4.mjs",
      "scripts/gmk-agent-worker/test-router-p5.mjs",
      "scripts/gmk-agent-worker/test-router-p6.mjs",
      "scripts/gmk-agent-worker/test-router.mjs",
    ],
    "scripts/gmk-agent-worker/verify-*.mjs": [
      "scripts/gmk-agent-worker/verify-agent-flow.mjs",
      "scripts/gmk-agent-worker/verify-change-aware.mjs",
      "scripts/gmk-agent-worker/verify-resumability.mjs",
    ],
  };
}

function fakeTools({ badFingerprintModule = null, dirty = false, failedGlob = null, diffChanges = [] } = {}) {
  const outputs = catalogOutputs();
  return {
    async runTool(name, params = {}) {
      if (name === "git.rev") return { ok: true, commit: TARGET, tree: "a".repeat(40) };
      if (name === "git.status") return { ok: true, stdout: dirty ? " M dirty" : "" };
      if (name === "git.diff_names") return { ok: true, changes: diffChanges };
      if (name === "files") {
        if (params.glob === failedGlob) return { ok: false, error: "discovery failed" };
        return { ok: true, stdout: (outputs[params.glob] || []).join("\n") };
      }
      if (name === "git.scope_fingerprint") {
        const moduleDefinition = MODULES.find((entry) => JSON.stringify(entry.source_paths || []) === JSON.stringify(params.paths || []));
        if (moduleDefinition?.name === badFingerprintModule) return { ok: false, error: "fingerprint failed" };
        if ((params.paths || []).some((entry) => String(entry).startsWith("../"))) {
          return { ok: false, error: "invalid scope paths" };
        }
        const fingerprint = crypto.createHash("sha256").update(JSON.stringify(params.paths || [])).digest("hex");
        return { ok: true, fingerprint, fileCount: Math.max(1, params.paths?.length || 0) };
      }
      throw new Error(`unexpected tool ${name}`);
    },
  };
}

test("baseline mapping preserves validation and review provenance while recording non-review fingerprints", async (t) => {
  const runtime = createRuntime();
  t.after(() => { runtime.db.close(); fs.rmSync(runtime.root, { recursive: true, force: true }); });
  runtime.db.prepare(`
    INSERT INTO modules (
      name, purpose, source_paths, criticality, mapping_state, validation_state,
      last_validated_commit, last_meaningful_review_at, last_reviewed_fingerprint,
      last_review_outcome, last_proactive_attempt_at, last_proactive_failure_at,
      last_proactive_failure_class, proactive_failure_count, known_findings
    ) VALUES (?, ?, '[]', 'high', 'MAPPED', 'VALIDATED', ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "Marketing site", "old purpose", BASE, "2026-08-20T00:00:00Z", "f".repeat(64),
    "NO_FINDINGS", "2026-08-21T00:00:00Z", "2026-08-22T00:00:00Z",
    "timeout", 3, JSON.stringify([{ id: 9, finding: "preserve me" }]),
  );
  runtime.db.prepare("INSERT INTO engineering_findings(finding) VALUES (?)").run("historical finding");
  runtime.db.prepare("INSERT INTO engineering_decisions(decision,reason) VALUES (?,?)").run("accepted", "historical decision");
  runtime.db.prepare("INSERT INTO validation_records(module,check_performed,commit_sha,state,run_id) VALUES (?,?,?,?,?)")
    .run("Marketing site", "historical semantic review", BASE, "VALIDATED", "old-run");
  runtime.db.prepare("INSERT INTO test_catalog(file,target,kind) VALUES (?,?,?)")
    .run(".\\tests\\unit\\seo-discoverability.spec.ts", "Marketing site", "test");
  runtime.db.prepare("INSERT INTO test_catalog(file,target,kind) VALUES (?,?,?)")
    .run(".\\tests\\fixtures\\inbox\\stale.json", null, "test");
  setState(runtime.db, "last_mapped_commit", BASE);

  const counts = await writeBaselineMap({ db: runtime.db, tools: fakeTools() }, "baseline-hardening", TARGET);
  assert.equal(counts.modules, 26);
  assert.equal(counts.fingerprints, 26);
  const marketing = runtime.db.prepare("SELECT * FROM modules WHERE name = ?").get("Marketing site");
  assert.equal(marketing.last_validated_commit, BASE);
  assert.equal(marketing.validation_state, "VALIDATED");
  assert.equal(marketing.last_reviewed_fingerprint, "f".repeat(64));
  assert.equal(marketing.last_review_outcome, "NO_FINDINGS");
  assert.equal(marketing.proactive_failure_count, 3);
  assert.deepEqual(JSON.parse(marketing.known_findings), [{ id: 9, finding: "preserve me" }]);
  const controls = runtime.db.prepare("SELECT * FROM modules WHERE name = ?").get("Agent operator controls");
  assert.equal(controls.validation_state, "NEEDS_REVIEW");
  assert.equal(controls.last_validated_commit, null);
  assert.equal(controls.last_reviewed_fingerprint, null);
  assert.equal(runtime.db.prepare("SELECT target FROM test_catalog WHERE file = ?").get("tests/unit/seo-discoverability.spec.ts").target, "Marketing site");
  assert.equal(runtime.db.prepare("SELECT target FROM test_catalog WHERE file = ?").get("tests/unit/agent-operator.spec.ts").target, "Agent operator controls");
  assert.equal(runtime.db.prepare("SELECT execution_class FROM test_catalog WHERE file = ?").get("scripts/gmk-agent-worker/verify-change-aware.mjs").execution_class, EXECUTION_CLASS.SAFE_READ_ONLY);
  assert.equal(runtime.db.prepare("SELECT execution_class FROM test_catalog WHERE file = ?").get("scripts/verify-founding-funnel-local.mjs").execution_class, EXECUTION_CLASS.LOCAL_INTEGRATION);
  assert.equal(runtime.db.prepare("SELECT COUNT(*) n FROM test_catalog WHERE execution_class = ?").get(EXECUTION_CLASS.LIVE_INTEGRATION).n, 0);
  assert.equal(runtime.db.prepare("SELECT count(*) n FROM test_catalog WHERE file LIKE '%\\\\%'").get().n, 0);
  assert.equal(runtime.db.prepare("SELECT count(*) n FROM test_catalog WHERE file LIKE 'tests/fixtures/%'").get().n, 0);
  assert.equal(runtime.db.prepare("SELECT count(*) n FROM engineering_findings").get().n, 1);
  assert.equal(runtime.db.prepare("SELECT count(*) n FROM engineering_decisions").get().n, 1);
  assert.equal(runtime.db.prepare("SELECT count(*) n FROM validation_records WHERE run_id = ? AND check_performed LIKE ?").get("baseline-hardening", "baseline scope fingerprint observation%").n, 26);
  const observation = runtime.db.prepare("SELECT * FROM validation_records WHERE run_id = ? AND module = ?").get("baseline-hardening", "Marketing site");
  assert.equal(observation.state, "NEEDS_REVIEW");
  assert.equal(JSON.parse(observation.evidence_ref).reviewed, false);
  assert.equal(marketing.last_reviewed_fingerprint, "f".repeat(64));
  assert.equal(runtime.db.prepare("SELECT value FROM runtime_state WHERE key = ?").get("last_mapped_commit").value, TARGET);
});

test("baseline discovery includes nested worker checks and excludes fixture data", async () => {
  const catalog = await discoverBaselineCatalog(fakeTools());
  const files = new Set(catalog.map((entry) => entry.normalized));
  assert(files.has("scripts/gmk-agent-worker/test-router.mjs"));
  assert(files.has("scripts/gmk-agent-worker/test-review-reconciliation.mjs"));
  assert(files.has("scripts/gmk-agent-worker/verify-change-aware.mjs"));
  assert(!files.has("scripts/gmk-agent-worker/verify-agent-flow.mjs"));
  assert(!files.has("scripts/gmk-agent-worker/verify-resumability.mjs"));
  assert(!files.has("scripts/capture-manual-screenshots.mjs"));
  assert(!files.has("scripts/run-bathroom-base-shot-engine.mjs"));
  assert(files.has("scripts/verify-founding-funnel-local.mjs"));
  assert(!files.has("tests/fixtures/inbox/not-a-test.json"));
  assert(!files.has("tests/e2e/utils.ts"));
  assert(!files.has("scripts/generate-unrelated-report.mjs"));
  assert(files.has("tests/unit/agent-operator.spec.ts"));
  assert.equal(catalog.find((entry) => entry.normalized === "scripts/gmk-agent-worker/verify-change-aware.mjs").executionClass, EXECUTION_CLASS.SAFE_READ_ONLY);
  assert.equal(catalog.find((entry) => entry.normalized === "scripts/verify-founding-funnel-local.mjs").executionClass, EXECUTION_CLASS.LOCAL_INTEGRATION);
});

test("script execution registry classifies live and operational integrations explicitly", () => {
  for (const file of [
    "scripts/gmk-agent-worker/verify-agent-flow.mjs",
    "scripts/gmk-agent-worker/verify-resumability.mjs",
    "scripts/capture-manual-screenshots.mjs",
    "scripts/run-bathroom-base-shot-engine.mjs",
  ]) {
    assert.equal(getScriptExecutionMetadata(file)?.executionClass, EXECUTION_CLASS.LIVE_INTEGRATION, file);
  }
  assert.equal(getScriptExecutionMetadata("scripts/verify-founding-funnel-local.mjs")?.executionClass, EXECUTION_CLASS.LOCAL_INTEGRATION);
  assert.throws(() => requireScriptExecutionMetadata("scripts/gmk-agent-worker/verify-unclassified-live.mjs"), /classification missing/);
});

test("safe discovery fails closed for an unclassified worker verification script", async () => {
  const tools = fakeTools();
  const originalRunTool = tools.runTool.bind(tools);
  tools.runTool = async (name, params = {}) => {
    const result = await originalRunTool(name, params);
    if (name === "files" && params.glob === "scripts/gmk-agent-worker/verify-*.mjs") {
      return { ...result, stdout: `${result.stdout}\nscripts/gmk-agent-worker/verify-unclassified-live.mjs` };
    }
    return result;
  };
  await assert.rejects(discoverBaselineCatalog(tools), /classification missing/);
});

test("known global support paths are explicit while unknown paths remain fail-closed", () => {
  assert.equal(KNOWN_GLOBAL_PATHS.length, 19);
  const impact = mapModuleImpact([
    { status: "M", path: "package.json" },
    { status: "M", path: "tests/fixtures/inbox/k-english-inquiry.json" },
    { status: "M", path: "unexpected/control-plane.ts" },
  ], MODULES, [], KNOWN_GLOBAL_PATHS);
  assert.deepEqual(impact.known_global_paths, ["package.json", "tests/fixtures/inbox/k-english-inquiry.json"]);
  assert.deepEqual(impact.unmapped_paths, ["unexpected/control-plane.ts"]);
});

test("baseline mapping fails closed without advancing or partially changing the map", async (t) => {
  const runtime = createRuntime();
  t.after(() => { runtime.db.close(); fs.rmSync(runtime.root, { recursive: true, force: true }); });
  runtime.db.prepare("INSERT INTO modules(name,purpose,source_paths,mapping_state,validation_state,last_validated_commit) VALUES (?,?,?,?,?,?)")
    .run("Marketing site", "original", "[]", "MAPPED", "VALIDATED", BASE);
  setState(runtime.db, "last_mapped_commit", BASE);
  await assert.rejects(
    writeBaselineMap({ db: runtime.db, tools: fakeTools({ badFingerprintModule: "Marketing site" }) }, "failed-baseline", TARGET),
    /fingerprint unavailable/,
  );
  assert.equal(runtime.db.prepare("SELECT purpose FROM modules WHERE name = ?").get("Marketing site").purpose, "original");
  assert.equal(runtime.db.prepare("SELECT count(*) n FROM modules").get().n, 1);
  assert.equal(runtime.db.prepare("SELECT value FROM runtime_state WHERE key = ?").get("last_mapped_commit").value, BASE);
  await assert.rejects(
    writeBaselineMap({ db: runtime.db, tools: fakeTools({ failedGlob: "scripts/gmk-agent-worker/test-*.mjs" }) }, "failed-discovery", TARGET),
    /discovery failed/,
  );
  await assert.rejects(
    writeBaselineMap({ db: runtime.db, tools: fakeTools({ dirty: true }) }, "dirty-baseline", TARGET),
    /clean worktree/,
  );
});

function seedReviewRange(db, {
  sessionId,
  base,
  target,
  jobId = JOB,
  coverageState = "VALIDATED",
  outcome = "NO_FINDINGS",
  semanticReview = true,
  moduleReviewFields = true,
  baselineFingerprint = "e".repeat(64),
  reviewedFingerprint = baselineFingerprint,
  semanticFingerprint = reviewedFingerprint,
}) {
  const reviewedAt = "2026-08-31T00:00:00Z";
  const validationState = outcome === "NO_FINDINGS" ? "VALIDATED" : outcome === "FINDINGS" ? "NEEDS_REVIEW" : "FAILED";
  db.prepare("INSERT INTO review_sessions(id,supabase_job_id,scope,base_commit,current_commit,status) VALUES (?,?,?,?,?,?)")
    .run(sessionId, jobId, "review", base, target, "done");
  db.prepare("INSERT INTO review_tasks(session_id,description,kind,status) VALUES (?,?,?,?)").run(sessionId, "rev", "git.rev", "done");
  db.prepare("INSERT INTO review_tasks(session_id,description,kind,status) VALUES (?,?,?,?)").run(sessionId, "status", "git.status", "done");
  db.prepare("INSERT INTO validation_records(module,check_performed,commit_sha,state,run_id) VALUES (?,?,?,?,?)")
    .run("repository", "change-aware diff (1 changed files): 1 direct + 0 dependency affected", target, "VALIDATED", sessionId);
  db.prepare("INSERT INTO validation_records(module,check_performed,evidence_ref,commit_sha,state,run_id) VALUES (?,?,?,?,?,?)")
    .run("repository", "module attribution coverage: 1/1 changed paths accepted; 0 known-global; 0 unexpected unmapped", JSON.stringify({ known_global_paths: [], unmapped_paths: [] }), target, coverageState, sessionId);
  db.prepare("INSERT INTO validation_records(module,check_performed,commit_sha,state,run_id) VALUES (?,?,?,?,?)")
    .run("Agent operator controls", "STALE — affected by change; required checks not (fully) passed", target, "STALE", sessionId);
  db.prepare("INSERT INTO validation_records(module,check_performed,evidence_ref,commit_sha,state,run_id) VALUES (?,?,?,?,?,?)")
    .run(
      "Agent operator controls",
      "baseline scope fingerprint observation (structural mapping only; not a semantic review)",
      JSON.stringify({
        kind: "baseline_scope_fingerprint",
        reviewed: false,
        available: true,
        fingerprint: baselineFingerprint,
        file_count: 4,
      }),
      target,
      "NEEDS_REVIEW",
      `${sessionId}-baseline`,
    );
  db.prepare(`
    INSERT INTO modules(name,source_paths,mapping_state,validation_state,last_validated_commit,last_meaningful_review_at,last_reviewed_fingerprint,last_review_outcome)
    VALUES (?, '[]', 'MAPPED', ?, ?, ?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET validation_state=excluded.validation_state,
      last_validated_commit=excluded.last_validated_commit,
      last_meaningful_review_at=excluded.last_meaningful_review_at,
      last_reviewed_fingerprint=excluded.last_reviewed_fingerprint,
      last_review_outcome=excluded.last_review_outcome
  `).run(
    "Agent operator controls",
    validationState,
    target,
    moduleReviewFields ? reviewedAt : null,
    moduleReviewFields ? reviewedFingerprint : null,
    moduleReviewFields ? outcome : null,
  );
  if (semanticReview) {
    const semanticSession = `${sessionId}-semantic`;
    db.prepare("INSERT INTO review_sessions(id,scope,base_commit,current_commit,status) VALUES (?,?,?,?,?)")
      .run(semanticSession, "proactive", target, target, "done");
    db.prepare("INSERT INTO validation_records(module,check_performed,evidence_ref,commit_sha,state,run_id,created_at) VALUES (?,?,?,?,?,?,?)")
      .run(
        "Agent operator controls",
        outcome === "FINDINGS" ? "bounded proactive review recorded 1 finding(s)" : "bounded proactive review completed with explicit no-finding outcome",
        JSON.stringify({
          kind: "semantic_module_review",
          reviewed: true,
          commit: target,
          module_fingerprint: semanticFingerprint,
          outcome,
          finding_count: outcome === "FINDINGS" ? 1 : 0,
        }),
        target,
        validationState,
        semanticSession,
        reviewedAt,
      );
  }
  if (outcome === "FINDINGS") {
    db.prepare("INSERT INTO engineering_findings(session_id,module,finding,lifecycle) VALUES (?,?,?,'OPEN')")
      .run(`${sessionId}-semantic`, "Agent operator controls", "Reviewed finding remains open");
  }
}

test("last_reviewed_commit governance accepts completed reviews with or without findings and rejects incomplete evidence", (t) => {
  const runtimes = [];
  t.after(() => {
    for (const runtime of runtimes) {
      runtime.db.close();
      fs.rmSync(runtime.root, { recursive: true, force: true });
    }
  });
  const approved = { decision: "approved", jobId: JOB, approvedByUserId: APPROVER, approvedAt: "2026-08-31T01:00:00Z" };
  const scenario = (name, options = {}) => {
    const runtime = createRuntime();
    runtimes.push(runtime);
    setState(runtime.db, "last_reviewed_commit", BASE);
    seedReviewRange(runtime.db, { sessionId: name, base: BASE, target: TARGET, ...options });
    return runtime;
  };

  for (const outcome of ["NO_FINDINGS", "FINDINGS"]) {
    const runtime = scenario(`eligible-${outcome.toLowerCase()}`, { outcome });
    const advanced = advanceLastReviewedCommit(runtime.db, {
      sessionId: `eligible-${outcome.toLowerCase()}`,
      baseCommit: BASE,
      targetCommit: TARGET,
      approval: approved,
      advancedAt: "2026-08-31T01:01:00Z",
    });
    assert.deepEqual(advanced.affectedModules, ["Agent operator controls"]);
    assert.equal(runtime.db.prepare("SELECT value FROM runtime_state WHERE key = ?").get("last_reviewed_commit").value, TARGET);
    if (outcome === "FINDINGS") {
      assert.equal(runtime.db.prepare("SELECT validation_state FROM modules WHERE name = ?").get("Agent operator controls").validation_state, "NEEDS_REVIEW");
      assert.equal(runtime.db.prepare("SELECT COUNT(*) n FROM engineering_findings WHERE lifecycle = 'OPEN'").get().n, 1);
    }
  }

  const unreviewed = scenario("unreviewed", { semanticReview: false, moduleReviewFields: false });
  assert.throws(() => advanceLastReviewedCommit(unreviewed.db, { sessionId: "unreviewed", baseCommit: BASE, targetCommit: TARGET, approval: approved }), /semantic review coverage is incomplete/);

  const failed = scenario("failed", { outcome: "FAILED" });
  assert.throws(() => advanceLastReviewedCommit(failed.db, { sessionId: "failed", baseCommit: BASE, targetCommit: TARGET, approval: approved }), /semantic review coverage is incomplete/);

  const baselineOnly = scenario("baseline-only", { semanticReview: false });
  assert.throws(() => advanceLastReviewedCommit(baselineOnly.db, { sessionId: "baseline-only", baseCommit: BASE, targetCommit: TARGET, approval: approved }), /semantic review.*missing or invalid/);

  const staleFingerprint = scenario("stale-fingerprint", { reviewedFingerprint: "f".repeat(64), semanticFingerprint: "f".repeat(64) });
  assert.throws(() => advanceLastReviewedCommit(staleFingerprint.db, { sessionId: "stale-fingerprint", baseCommit: BASE, targetCommit: TARGET, approval: approved }), /does not match target content/);

  const missingApproval = scenario("missing-approval");
  assert.throws(() => advanceLastReviewedCommit(missingApproval.db, { sessionId: "missing-approval", baseCommit: BASE, targetCommit: TARGET }), /approval is required/);

  const wrongRange = scenario("wrong-range");
  assert.throws(() => advanceLastReviewedCommit(wrongRange.db, { sessionId: "wrong-range", baseCommit: "0".repeat(40), targetCommit: TARGET, approval: approved }), /does not cover/);
});

test("review submission SQL derives requester from auth.uid and exposes no arbitrary requester parameter", () => {
  const migration = fs.readFileSync(path.join(ROOT, "supabase", "migrations", "20260831120000_engineering_review_submission_hardening.sql"), "utf8");
  const action = fs.readFileSync(path.join(ROOT, "app", "operator", "agents", "actions.ts"), "utf8");
  assert.match(migration, /caller_id uuid := \(select auth\.uid\(\)\)/);
  assert.match(migration, /requested_by_user_id[\s\S]*caller_id/);
  assert.doesNotMatch(migration, /order by created_at\s+limit 1/i);
  assert.match(migration, /create unique index idx_engineering_review_session_id/);
  assert.match(migration, /create unique index idx_one_active_engineering_review_job/);
  assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\('engineering\.review\.active'/);
  assert.match(migration, /max_attempts[\s\S]*true, 1,/);
  assert.match(action, /operator_enqueue_engineering_review/);
  assert.doesNotMatch(action, /requested_by_user_id/);
});

test("Agent operator control paths and their test are attributed to the dedicated module", () => {
  const changed = [
    "app/operator/agents/AgentControlButton.tsx",
    "app/operator/agents/actions.ts",
    "app/operator/agents/page.tsx",
    "lib/agents/operator-view.ts",
    "tests/unit/agent-operator.spec.ts",
  ].map((file) => ({ status: "M", path: file }));
  const direct = directModules(changed, MODULES);
  assert(direct.includes("Agent operator controls"));
  assert(!direct.includes("Operator Inbox"));
});

test("change-aware review requires exact clean HEAD and a bounded check set", async (t) => {
  const runtime = createRuntime();
  t.after(() => { runtime.db.close(); fs.rmSync(runtime.root, { recursive: true, force: true }); });
  const logger = { log() {} };
  await assert.rejects(
    runChangeAwareReview(
      { db: runtime.db, tools: fakeTools(), logger },
      { sessionId: "mismatch", jobId: JOB, baseCommit: BASE, commit: NEXT },
    ),
    /target mismatch/,
  );
  const diffChanges = Array.from({ length: MAX_CHANGE_AWARE_CHECKS + 1 }, (_, index) => ({
    status: "M",
    path: `scripts/gmk-agent-worker/generated/check-${index}.mjs`,
  }));
  await assert.rejects(
    runChangeAwareReview(
      { db: runtime.db, tools: fakeTools({ diffChanges }), logger },
      { sessionId: "unbounded", jobId: JOB, baseCommit: BASE, commit: TARGET },
    ),
    /exceeds bounded check limit/,
  );

  const knownGlobal = await runChangeAwareReview(
    { db: runtime.db, tools: fakeTools({ diffChanges: [{ status: "M", path: "package.json" }] }), logger },
    { sessionId: "known-global", jobId: JOB, baseCommit: BASE, commit: TARGET },
  );
  assert.deepEqual(knownGlobal.impact.known_global_paths, ["package.json"]);
  assert.deepEqual(knownGlobal.impact.unmapped_paths, []);
  assert.equal(runtime.db.prepare("SELECT state FROM validation_records WHERE run_id = ? AND check_performed LIKE 'module attribution coverage:%'").get("known-global").state, "VALIDATED");

  const unknown = await runChangeAwareReview(
    { db: runtime.db, tools: fakeTools({ diffChanges: [{ status: "M", path: "unexpected/runtime-control.json" }] }), logger },
    { sessionId: "unknown-global", jobId: JOB, baseCommit: BASE, commit: TARGET },
  );
  assert.deepEqual(unknown.impact.known_global_paths, []);
  assert.deepEqual(unknown.impact.unmapped_paths, ["unexpected/runtime-control.json"]);
  assert.equal(runtime.db.prepare("SELECT state FROM validation_records WHERE run_id = ? AND check_performed LIKE 'module attribution coverage:%'").get("unknown-global").state, "STALE");
});

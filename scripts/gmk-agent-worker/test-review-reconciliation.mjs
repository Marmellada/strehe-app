import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { processWorkerPass } from "./lib/worker-pass.mjs";
import { getState, openDatabase, setState } from "./lib/sqlite.mjs";

const BASE = "1".repeat(40);
const TARGET = "2".repeat(40);
const NEXT = "3".repeat(40);
const JOB = "20000000-0000-4000-8000-000000000001";
const OTHER_JOB = "20000000-0000-4000-8000-000000000002";
const APPROVER = "10000000-0000-4000-8000-000000000001";
const OTHER_APPROVER = "10000000-0000-4000-8000-000000000002";
const SESSION = "REVIEW-RECONCILIATION-001";
const REVIEWED_AT = "2026-09-02T08:00:00.000Z";
const ADVANCED_AT = new Date("2026-09-02T08:05:00.000Z");

function createScenario({ current = BASE, includeCoverage = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "strehe-review-reconciliation-"));
  const { db } = openDatabase(root);
  setState(db, "last_reviewed_commit", current);
  db.prepare("INSERT INTO review_sessions(id,supabase_job_id,scope,base_commit,current_commit,status) VALUES (?,?,?,?,?,'done')")
    .run(SESSION, JOB, "review", BASE, TARGET);
  db.prepare("INSERT INTO review_tasks(session_id,description,kind,status) VALUES (?,?,?,'done')")
    .run(SESSION, "record exact commit", "git.rev");
  db.prepare("INSERT INTO review_tasks(session_id,description,kind,status) VALUES (?,?,?,'done')")
    .run(SESSION, "record clean status", "git.status");
  db.prepare("INSERT INTO validation_records(module,check_performed,commit_sha,state,run_id) VALUES (?,?,?,?,?)")
    .run("repository", "change-aware diff (1 changed files): 1 direct + 0 dependency affected", TARGET, "VALIDATED", SESSION);
  if (includeCoverage) {
    db.prepare("INSERT INTO validation_records(module,check_performed,evidence_ref,commit_sha,state,run_id) VALUES (?,?,?,?,?,?)")
      .run(
        "repository",
        "module attribution coverage: 1/1 changed paths accepted; 0 known-global; 0 unexpected unmapped",
        JSON.stringify({ known_global_paths: [], unmapped_paths: [] }),
        TARGET,
        "VALIDATED",
        SESSION,
      );
  }
  db.prepare("INSERT INTO validation_records(module,check_performed,commit_sha,state,run_id) VALUES (?,?,?,?,?)")
    .run("Agent operator controls", "STALE — affected by change; required checks not (fully) passed", TARGET, "STALE", SESSION);
  const fingerprint = "e".repeat(64);
  db.prepare("INSERT INTO validation_records(module,check_performed,evidence_ref,commit_sha,state,run_id) VALUES (?,?,?,?,?,?)")
    .run(
      "Agent operator controls",
      "baseline scope fingerprint observation (structural mapping only; not a semantic review)",
      JSON.stringify({
        kind: "baseline_scope_fingerprint",
        reviewed: false,
        available: true,
        fingerprint,
        file_count: 4,
      }),
      TARGET,
      "NEEDS_REVIEW",
      `${SESSION}-baseline`,
    );
  db.prepare(`
    INSERT INTO modules(
      name,source_paths,mapping_state,validation_state,last_validated_commit,
      last_meaningful_review_at,last_reviewed_fingerprint,last_review_outcome
    ) VALUES (?, '[]', 'MAPPED', 'VALIDATED', ?, ?, ?, 'NO_FINDINGS')
  `).run("Agent operator controls", TARGET, REVIEWED_AT, fingerprint);
  db.prepare("INSERT INTO review_sessions(id,scope,base_commit,current_commit,status) VALUES (?, 'proactive', ?, ?, 'done')")
    .run(`${SESSION}-semantic`, TARGET, TARGET);
  db.prepare("INSERT INTO validation_records(module,check_performed,evidence_ref,commit_sha,state,run_id,created_at) VALUES (?,?,?,?,?,?,?)")
    .run(
      "Agent operator controls",
      "bounded proactive review completed with explicit no-finding outcome",
      JSON.stringify({
        kind: "semantic_module_review",
        reviewed: true,
        commit: TARGET,
        module_fingerprint: fingerprint,
        outcome: "NO_FINDINGS",
        finding_count: 0,
      }),
      TARGET,
      "VALIDATED",
      `${SESSION}-semantic`,
      REVIEWED_AT,
    );
  db.close();
  return root;
}

function reviewedJob(overrides = {}) {
  const base = {
    id: JOB,
    job_type: "engineering.review",
    required_capability: "engineering.local",
    workspace_type: "system",
    status: "completed",
    requires_review: true,
    review_decision: "approved",
    reviewed_by_user_id: APPROVER,
    reviewed_at: REVIEWED_AT,
    completed_at: REVIEWED_AT,
    payload: {
      type: "review",
      session_id: SESSION,
      base_commit: BASE,
      commit_sha: TARGET,
      scope: "repository",
      implementation: false,
      writes_code: false,
    },
    result: {
      schema_version: 1,
      agent: "engineering",
      session_id: SESSION,
      review_kind: "review",
      scope: "review",
      base_commit: BASE,
      git_commit: TARGET,
      production_changes_made: false,
    },
  };
  return {
    ...base,
    ...overrides,
    payload: { ...base.payload, ...(overrides.payload || {}) },
    result: { ...base.result, ...(overrides.result || {}) },
  };
}

function fakeSupabase(job) {
  return {
    from(table) {
      const filters = new Map();
      return {
        select() { return this; },
        eq(column, value) { filters.set(column, value); return this; },
        async maybeSingle() {
          if (table === "agent_jobs") {
            return { data: job, error: null };
          }
          if (table === "agent_operator_controls") {
            return {
              data: {
                proactive_enabled: false,
                paused: true,
                cadence_minutes: 240,
                next_proactive_at: null,
                manual_review_requested_at: null,
                worker_state: "paused",
              },
              error: null,
            };
          }
          return { data: null, error: new Error(`unexpected table ${table}`) };
        },
      };
    },
  };
}

async function runPass(root, job) {
  return processWorkerPass({
    supabase: fakeSupabase(job),
    agentId: "30000000-0000-4000-8000-000000000001",
    config: { runtimeRoot: root },
    logger: { log() {} },
  }, { capability: "engineering.local" }, { engineering: true, now: ADVANCED_AT });
}

function inspect(root) {
  const { db } = openDatabase(root);
  try {
    return {
      commit: getState(db, "last_reviewed_commit"),
      reviewedAt: getState(db, "last_reviewed_at"),
      decision: getState(db, "last_review_decision"),
      scope: getState(db, "last_review_scope"),
      advancements: db.prepare("SELECT COUNT(*) AS n FROM review_commit_advancements").get().n,
      advancementEvidence: db.prepare(
        "SELECT COUNT(*) AS n FROM validation_records WHERE check_performed LIKE 'last_reviewed_commit advanced from %'",
      ).get().n,
    };
  } finally {
    db.close();
  }
}

function scenarioTest(name, options, body) {
  test(name, async (t) => {
    const root = createScenario(options);
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    await body(root);
  });
}

scenarioTest("trusted worker pass advances a valid approval exactly once and replays as a clean no-op", {}, async (root) => {
  const first = await runPass(root, reviewedJob());
  assert.equal(first.reconciledReviews.length, 1);
  assert.equal(first.reconciledReviews[0].advanced, true);
  assert.equal(first.reconciledReviews[0].replayed, false);
  assert.deepEqual(inspect(root), {
    commit: TARGET,
    reviewedAt: ADVANCED_AT.toISOString(),
    decision: "APPROVED",
    scope: `${BASE}..${TARGET}`,
    advancements: 1,
    advancementEvidence: 1,
  });

  const replay = await runPass(root, reviewedJob());
  assert.equal(replay.reconciledReviews.length, 1);
  assert.equal(replay.reconciledReviews[0].advanced, false);
  assert.equal(replay.reconciledReviews[0].replayed, true);
  assert.equal(inspect(root).advancements, 1);
  assert.equal(inspect(root).advancementEvidence, 1);
});

scenarioTest("trusted worker pass never advances a rejected review", {}, async (root) => {
  const rejected = reviewedJob({ status: "failed", review_decision: "rejected" });
  const pass = await runPass(root, rejected);
  assert.equal(pass.reconciledReviews[0].decision, "rejected");
  assert.equal(pass.reconciledReviews[0].advanced, false);
  assert.deepEqual(inspect(root), {
    commit: BASE,
    reviewedAt: null,
    decision: null,
    scope: null,
    advancements: 0,
    advancementEvidence: 0,
  });
});

scenarioTest("trusted worker pass rejects a replay whose recorded approval provenance changed", {}, async (root) => {
  await runPass(root, reviewedJob());
  await assert.rejects(
    runPass(root, reviewedJob({ reviewed_by_user_id: OTHER_APPROVER })),
    /replay conflicts with recorded provenance/,
  );
  assert.equal(inspect(root).commit, TARGET);
  assert.equal(inspect(root).advancements, 1);
  assert.equal(inspect(root).advancementEvidence, 1);
});

scenarioTest("trusted worker pass fails closed for the wrong reviewed job", {}, async (root) => {
  await assert.rejects(runPass(root, reviewedJob({ id: OTHER_JOB })), /does not match the local review session/);
  assert.equal(inspect(root).commit, BASE);
  assert.equal(inspect(root).advancements, 0);
});

scenarioTest("trusted worker pass fails closed for the wrong commit range", {}, async (root) => {
  await assert.rejects(
    runPass(root, reviewedJob({ payload: { base_commit: NEXT }, result: { base_commit: NEXT } })),
    /payload does not match the local review session/,
  );
  assert.equal(inspect(root).commit, BASE);
  assert.equal(inspect(root).advancements, 0);
});

scenarioTest("trusted worker pass fails closed when required validation evidence is missing", { includeCoverage: false }, async (root) => {
  await assert.rejects(runPass(root, reviewedJob()), /module attribution coverage is incomplete/);
  assert.equal(inspect(root).commit, BASE);
  assert.equal(inspect(root).advancements, 0);
  assert.equal(inspect(root).advancementEvidence, 0);
});

scenarioTest("trusted worker pass fails closed on reviewed-job provenance mismatch", {}, async (root) => {
  await assert.rejects(
    runPass(root, reviewedJob({ required_capability: "other.capability" })),
    /reviewed job provenance is invalid/,
  );
  assert.equal(inspect(root).commit, BASE);
  assert.equal(inspect(root).advancements, 0);
});

scenarioTest("trusted worker pass fails closed when local review state is already ahead", { current: NEXT }, async (root) => {
  await assert.rejects(runPass(root, reviewedJob()), /approved review range is stale/);
  assert.equal(inspect(root).commit, NEXT);
  assert.equal(inspect(root).advancements, 0);
  assert.equal(inspect(root).advancementEvidence, 0);
});

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import {
  assertNoActiveRuntimeWork,
  assertOperatorPauseState,
  controlledInboxJob,
  GO_RESET_JOB_ID,
  inspectOpenCodeBudget,
} from "./lib/go-ready.mjs";

function database(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "strehe-go-ready-"));
  const db = new DatabaseSync(path.join(root, "test.sqlite3"));
  db.exec(`
    CREATE TABLE runtime_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE coordinator_reservations (job_id TEXT PRIMARY KEY);
    CREATE TABLE overnight_sessions (session_id TEXT PRIMARY KEY, final_status TEXT);
    CREATE TABLE llm_usage_ledger (
      provider TEXT, input_tokens INTEGER, output_tokens INTEGER, reported_cost_usd REAL,
      estimated_cost_usd REAL, cost_status TEXT, api_calls INTEGER, created_at TEXT
    );
  `);
  t.after(() => {
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  return db;
}

const budget = {
  opencode: {
    rolling_5h: { max_tokens: 1000, max_usd_estimate: 5 },
    rolling_7d: { max_tokens: 5000, max_usd_estimate: 20 },
    rolling_30d: { max_tokens: 10000, max_usd_estimate: 60 },
  },
  hard_threshold_pct: 100,
};

test("Go reset operator state requires explicit unpaused attestation", () => {
  assert.deepEqual(assertOperatorPauseState("unpaused"), {
    readable: true, paused: false, source: "explicit_operator_attestation",
  });
  assert.throws(() => assertOperatorPauseState(null), (error) => error.code === "operator_pause_state_unreadable");
  assert.throws(() => assertOperatorPauseState("paused"), (error) => error.code === "operator_paused");
});

test("Go reset job IDs and payload remain unmistakably synthetic", () => {
  assert.equal(GO_RESET_JOB_ID.test("go-reset-inbox-draft-reset-001"), true);
  assert.equal(GO_RESET_JOB_ID.test("123e4567-e89b-42d3-a456-426614174000"), false);
  const fixture = JSON.parse(fs.readFileSync(path.resolve("tests/fixtures/inbox/k-english-inquiry.json"), "utf8"));
  const job = controlledInboxJob(fixture, "go-reset-inbox-draft-reset-001");
  assert.equal(job.requires_review, true);
  assert.deepEqual(Object.keys(job.payload), ["conversation_fixture"]);
});

test("Go reset preflight reads clean local runtime and budget state", (t) => {
  const db = database(t);
  assert.deepEqual(assertNoActiveRuntimeWork(db), { reservations: 0, sessions: 0 });
  const state = inspectOpenCodeBudget(db, budget, new Date("2026-08-30T20:00:00Z"));
  assert.equal(state.metering_hold, false);
  assert.deepEqual(Object.keys(state.windows), ["rolling_5h", "rolling_7d", "rolling_30d"]);
});

test("Go reset preflight fails closed for reservations, sessions, metering holds, and unmetered calls", (t) => {
  const db = database(t);
  db.prepare("INSERT INTO coordinator_reservations(job_id) VALUES (?)").run("busy");
  assert.throws(() => assertNoActiveRuntimeWork(db), (error) => error.code === "active_execution_reservations");
  db.exec("DELETE FROM coordinator_reservations");
  db.prepare("INSERT INTO overnight_sessions(session_id,final_status) VALUES (?,NULL)").run("active");
  assert.throws(() => assertNoActiveRuntimeWork(db), (error) => error.code === "active_overnight_sessions");
  db.exec("DELETE FROM overnight_sessions");
  db.prepare("INSERT INTO runtime_state(key,value) VALUES (?,?)").run("budget_opencode_metering_hold", "held");
  assert.throws(() => inspectOpenCodeBudget(db, budget), (error) => error.code === "opencode_metering_hold_active");
  db.exec("DELETE FROM runtime_state");
  db.prepare("INSERT INTO llm_usage_ledger(provider,cost_status,api_calls,created_at) VALUES ('opencode','unknown',1,datetime('now'))").run();
  assert.throws(() => inspectOpenCodeBudget(db, budget), (error) => error.code === "opencode_unmetered_usage_detected");
});

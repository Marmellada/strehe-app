import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

// Engineering Agent operational memory — local SQLite, not application data.
// This is D:-resident, rebuilt from source if lost, and never holds secrets.

const SCHEMA = `
CREATE TABLE IF NOT EXISTS modules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  purpose TEXT,
  source_paths TEXT NOT NULL DEFAULT '[]',
  db_dependencies TEXT NOT NULL DEFAULT '[]',
  rpc_dependencies TEXT NOT NULL DEFAULT '[]',
  upstream_dependencies TEXT NOT NULL DEFAULT '[]',
  downstream_dependents TEXT NOT NULL DEFAULT '[]',
  external_services TEXT NOT NULL DEFAULT '[]',
  tests TEXT NOT NULL DEFAULT '[]',
  criticality TEXT NOT NULL DEFAULT 'low',
  mapping_state TEXT NOT NULL DEFAULT 'UNKNOWN',
  validation_state TEXT NOT NULL DEFAULT 'UNKNOWN',
  last_validated_commit TEXT,
  known_findings TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS module_dependencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module_from TEXT NOT NULL,
  module_to TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'depends',
  notes TEXT,
  UNIQUE(module_from, module_to, kind)
);

CREATE TABLE IF NOT EXISTS critical_flows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  steps TEXT NOT NULL DEFAULT '[]',
  notes TEXT
);

CREATE TABLE IF NOT EXISTS test_catalog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file TEXT NOT NULL,
  target TEXT,
  kind TEXT,
  last_run_at TEXT,
  last_commit TEXT,
  status TEXT
);

CREATE TABLE IF NOT EXISTS validation_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module TEXT,
  flow TEXT,
  check_performed TEXT,
  evidence_ref TEXT,
  commit_sha TEXT,
  state TEXT NOT NULL DEFAULT 'VALIDATED',
  run_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS engineering_findings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  finding TEXT NOT NULL,
  evidence TEXT,
  recommendation TEXT,
  severity TEXT NOT NULL DEFAULT 'info',
  confidence TEXT NOT NULL DEFAULT 'medium',
  lifecycle TEXT NOT NULL DEFAULT 'OPEN',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS engineering_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  finding_id INTEGER REFERENCES engineering_findings(id),
  decision TEXT NOT NULL,
  reason TEXT,
  revisit_condition TEXT,
  revisit_date TEXT,
  decided_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS review_sessions (
  id TEXT PRIMARY KEY,
  supabase_job_id TEXT,
  scope TEXT,
  base_commit TEXT,
  current_commit TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS review_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES review_sessions(id),
  description TEXT NOT NULL,
  kind TEXT NOT NULL,
  params TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  evidence_refs TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS review_evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES review_tasks(id),
  kind TEXT,
  content TEXT,
  summary_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS runtime_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_test_catalog_file ON test_catalog(file);
`;

export function ensureRuntimeDirs(runtimeRoot) {
  const dirs = [
    path.join(runtimeRoot, "state"),
    path.join(runtimeRoot, "state", "artifacts"),
    path.join(runtimeRoot, "worktree"),
  ];
  for (const dir of dirs) fs.mkdirSync(dir, { recursive: true });
  return dirs;
}

export function openDatabase(runtimeRoot) {
  ensureRuntimeDirs(runtimeRoot);
  const dbPath = path.join(runtimeRoot, "state", "engineering.sqlite3");
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  return { db, dbPath };
}

export function getState(db, key) {
  const row = db.prepare("SELECT value FROM runtime_state WHERE key = ?").get(key);
  return row ? row.value : null;
}

export function setState(db, key, value) {
  db.prepare(
    "INSERT INTO runtime_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(key, String(value));
}

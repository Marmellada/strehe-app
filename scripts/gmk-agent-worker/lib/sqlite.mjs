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
  last_meaningful_review_at TEXT,
  last_reviewed_fingerprint TEXT,
  last_review_outcome TEXT,
  last_proactive_attempt_at TEXT,
  last_proactive_failure_at TEXT,
  last_proactive_failure_class TEXT,
  proactive_failure_count INTEGER NOT NULL DEFAULT 0,
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
  module TEXT,
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

CREATE TABLE IF NOT EXISTS llm_usage_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  job_id TEXT,
  run_id TEXT,
  agent_key TEXT,
  task_type TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cache_read_tokens INTEGER,
  cache_write_tokens INTEGER,
  reasoning_tokens INTEGER,
  api_calls INTEGER NOT NULL DEFAULT 1,
  estimated_cost_usd REAL,
  reported_cost_usd REAL,
  cost_status TEXT NOT NULL DEFAULT 'unknown',
  duration_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS routing_outcomes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_type TEXT NOT NULL,
  scope_fingerprint TEXT,
  model TEXT NOT NULL,
  outcome TEXT NOT NULL,
  failure_class TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS coordinator_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS job_lifecycle_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL,
  state TEXT NOT NULL,
  model_handle TEXT,
  iteration_count INTEGER NOT NULL DEFAULT 0,
  iteration_ceiling INTEGER,
  deadline_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS coordinator_reservations (
  job_id TEXT PRIMARY KEY,
  resource_class TEXT NOT NULL CHECK(resource_class IN ('heavy', 'light')),
  provider TEXT NOT NULL,
  process_kind TEXT NOT NULL DEFAULT 'worker',
  owner_pid INTEGER NOT NULL,
  worker_pid INTEGER,
  worker_bound_at TEXT,
  reserved_at TEXT NOT NULL,
  deadline_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS overnight_sessions (
  session_id TEXT PRIMARY KEY,
  mode_version TEXT NOT NULL,
  owner_pid INTEGER,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  heartbeat_at TEXT NOT NULL,
  starting_commit TEXT NOT NULL,
  current_commit TEXT,
  operator_paused INTEGER NOT NULL DEFAULT 0,
  jobs_attempted INTEGER NOT NULL DEFAULT 0,
  jobs_succeeded INTEGER NOT NULL DEFAULT 0,
  jobs_blocked INTEGER NOT NULL DEFAULT 0,
  jobs_failed INTEGER NOT NULL DEFAULT 0,
  retry_count INTEGER NOT NULL DEFAULT 0,
  provider_usage_json TEXT NOT NULL DEFAULT '{}',
  codex_runs INTEGER NOT NULL DEFAULT 0,
  health_blocks INTEGER NOT NULL DEFAULT 0,
  budget_blocks INTEGER NOT NULL DEFAULT 0,
  last_completed_job TEXT,
  current_job TEXT,
  stop_reason TEXT,
  final_status TEXT,
  blocked_artifact TEXT,
  summary_artifact TEXT,
  last_failure_signature TEXT,
  identical_failure_count INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_test_catalog_file ON test_catalog(file);
CREATE INDEX IF NOT EXISTS idx_validation_records_module_created
  ON validation_records(module, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_usage_provider_created
  ON llm_usage_ledger(provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_routing_outcomes_signature_created
  ON routing_outcomes(job_type, scope_fingerprint, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_lifecycle_job_created
  ON job_lifecycle_log(job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coordinator_reservations_deadline
  ON coordinator_reservations(deadline_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_overnight_single_active
  ON overnight_sessions((1)) WHERE final_status IS NULL;
CREATE INDEX IF NOT EXISTS idx_overnight_started
  ON overnight_sessions(started_at DESC);
`;

function ensureColumn(db, table, column, declaration) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((entry) => entry.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${declaration}`);
  }
}

function migrateExistingDatabase(db) {
  ensureColumn(db, "modules", "last_meaningful_review_at", "TEXT");
  ensureColumn(db, "modules", "last_reviewed_fingerprint", "TEXT");
  ensureColumn(db, "modules", "last_review_outcome", "TEXT");
  ensureColumn(db, "modules", "last_proactive_attempt_at", "TEXT");
  ensureColumn(db, "modules", "last_proactive_failure_at", "TEXT");
  ensureColumn(db, "modules", "last_proactive_failure_class", "TEXT");
  ensureColumn(db, "modules", "proactive_failure_count", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "engineering_findings", "module", "TEXT");
  ensureColumn(db, "llm_usage_ledger", "reported_cost_usd", "REAL");
  ensureColumn(db, "job_lifecycle_log", "iteration_ceiling", "INTEGER");
  ensureColumn(db, "coordinator_reservations", "worker_pid", "INTEGER");
  ensureColumn(db, "coordinator_reservations", "worker_bound_at", "TEXT");
  ensureColumn(db, "overnight_sessions", "last_failure_signature", "TEXT");
  ensureColumn(db, "overnight_sessions", "identical_failure_count", "INTEGER NOT NULL DEFAULT 0");
  db.exec(`CREATE INDEX IF NOT EXISTS idx_engineering_findings_module_lifecycle
    ON engineering_findings(module, lifecycle)`);
}

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
  db.exec("PRAGMA busy_timeout = 2000;");
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  migrateExistingDatabase(db);
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

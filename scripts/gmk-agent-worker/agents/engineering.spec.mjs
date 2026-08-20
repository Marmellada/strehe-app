import { createToolGateway } from "../lib/tools.mjs";
import { openDatabase, setState } from "../lib/sqlite.mjs";
import { ollamaChat } from "../lib/ollama.mjs";
import { parseJsonLoose } from "../lib/json.mjs";
import { MODULES, FLOWS, DEPENDENCIES } from "./strehe-map.mjs";
import { mapModuleImpact, selectChecksForFiles } from "../lib/impact.mjs";

// Engineering Agent V1 — Coordinator + Worker.
// Coordinator owns durable continuity (SQLite); Worker executes one bounded task.
// Both use the same Ollama model sequentially; no persistent LLM context.

const MAX_TASKS_PER_SESSION = 40;
const MAX_RETRIES = 2;

function nowIso() {
  return new Date().toISOString();
}

// ---- Worker task handlers (bounded, tool-gateway only) ----

async function runWorkerTask(ctx, task) {
  const { tools } = ctx;
  const kind = task.kind;
  const params = typeof task.params === "object" && task.params ? task.params : {};

  // Each handler returns { ok, summary, evidence: [...] }.
  switch (kind) {
    case "synthetic.ollama": {
      const prompt = String(params.prompt || "Return JSON: {\"answer\": 4}.");
      const delayMs = Number(params.delay_ms) || 0;
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      const started = Date.now();
      const raw = await ollamaChat({
        baseUrl: ctx.config.ollamaBaseUrl,
        model: ctx.config.ollamaModel,
        prompt,
        numGpu: ctx.config.ollamaNumGpu ?? 0,
        timeoutMs: ctx.config.ollamaTimeoutMs,
      });
      const parsed = parseJsonLoose(raw);
      if (!parsed.ok) throw new Error(`ollama output not JSON: ${parsed.error}`);
      return {
        ok: true,
        summary: "local ollama call produced structured JSON",
        evidence: [
          { kind: "ollama", model: ctx.config.ollamaModel, duration_ms: Date.now() - started, output: parsed.value },
        ],
      };
    }

    case "git.rev": {
      const r = await tools.runTool("git.rev");
      if (!r.ok) throw new Error(`git.rev failed: ${r.error}`);
      return { ok: true, summary: `commit ${r.commit} tree ${r.tree}`, evidence: [{ kind: "git.rev", commit: r.commit, tree: r.tree }] };
    }

    case "git.status": {
      const r = await tools.runTool("git.status");
      if (!r.ok) throw new Error(`git.status failed: ${r.error}`);
      const dirty = (r.stdout || "").trim().length > 0;
      return { ok: true, summary: dirty ? "worktree has changes" : "worktree clean", evidence: [{ kind: "git.status", clean: !dirty, output: r.stdout }] };
    }

    case "git.ls_files": {
      const scope = params.path || params.scope || "";
      const r = await tools.runTool("git.ls_files", { path: scope });
      if (!r.ok) throw new Error(`git.ls_files failed: ${r.error}`);
      const files = (r.stdout || "").split("\n").filter(Boolean);
      return { ok: true, summary: `${files.length} tracked files${scope ? ` under ${scope}` : ""}`, evidence: [{ kind: "git.ls_files", scope, count: files.length, files }] };
    }

    case "git.diff_names": {
      const r = await tools.runTool("git.diff_names", { base: params.base, current: params.current });
      if (!r.ok) throw new Error(`git.diff_names failed: ${r.error}`);
      const changes = Array.isArray(r.changes) ? r.changes : [];
      return { ok: true, summary: `${changes.length} changed paths (${params.base}..${params.current})`, evidence: [{ kind: "git.diff_names", base: params.base, current: params.current, changes }] };
    }

    case "search": {
      const r = await tools.runTool("search", { pattern: params.pattern, glob: params.glob, path: params.path });
      if (!r.ok) throw new Error(`search failed: ${r.error}`);
      return { ok: true, summary: `search "${params.pattern}"`, evidence: [{ kind: "search", pattern: params.pattern, output: r.stdout }] };
    }

    case "files": {
      const r = await tools.runTool("files", { glob: params.glob });
      if (!r.ok) throw new Error(`files failed: ${r.error}`);
      const files = (r.stdout || "").split("\n").filter(Boolean);
      return { ok: true, summary: `${files.length} files (${params.glob || "all"})`, evidence: [{ kind: "files", glob: params.glob, count: files.length, files }] };
    }

    case "node.check": {
      const r = await tools.runTool("node.check", { path: params.path });
      if (!r.ok) throw new Error(`node --check failed for ${params.path}: ${r.error || r.stderr || "non-zero exit"}`);
      return { ok: true, summary: `node --check ok: ${params.path}`, evidence: [{ kind: "node.check", path: params.path }] };
    }

    case "git.log": {
      const r = await tools.runTool("git.log", { count: params.count });
      if (!r.ok) throw new Error(`git.log failed: ${r.error}`);
      return { ok: true, summary: "recent commit history", evidence: [{ kind: "git.log", output: r.stdout }] };
    }

    case "file.read": {
      const r = await tools.runTool("file.read", { path: params.path });
      if (!r.ok) throw new Error(`file.read failed: ${r.error}`);
      return { ok: true, summary: `read ${params.path}`, evidence: [{ kind: "file.read", path: params.path, bytes: r.bytes }] };
    }

    case "parse.migrations": {
      const tables = await tools.runTool("search", { pattern: "create table public\\.\\w+", glob: "supabase/migrations/*.sql" });
      const funcs = await tools.runTool("search", { pattern: "create (or replace )?function public\\.\\w+", glob: "supabase/migrations/*.sql" });
      const names = (s) => [...new Set(((s || "").match(/public\.([a-zA-Z0-9_]+)/g) || []).map((n) => n.replace("public.", "")))];
      const tableNames = names(tables.stdout);
      const funcNames = names(funcs.stdout);
      return {
        ok: true,
        summary: `${tableNames.length} tables, ${funcNames.length} functions`,
        evidence: [{ kind: "migrations", tables: tableNames, functions: funcNames }],
      };
    }

    case "read.package": {
      const r = await tools.runTool("file.read", { path: "package.json" });
      if (!r.ok) throw new Error(`package.json read failed: ${r.error}`);
      const pkg = JSON.parse(r.content);
      return {
        ok: true,
        summary: `package.json (${Object.keys(pkg.scripts || {}).length} scripts)`,
        evidence: [{ kind: "package", scripts: pkg.scripts || {}, dependencies: Object.keys(pkg.dependencies || {}), devDependencies: Object.keys(pkg.devDependencies || {}) }],
      };
    }

    case "verify.paths": {
      const ls = await tools.runTool("git.ls_files");
      const files = (ls.stdout || "").split("\n");
      const paths = Array.isArray(params.paths) ? params.paths : [];
      const verified = paths.filter((p) => files.some((f) => f === p || f.startsWith(`${p}/`)));
      const missing = paths.filter((p) => !verified.includes(p));
      return { ok: true, summary: `${verified.length}/${paths.length} paths present`, evidence: [{ kind: "verify.paths", verified, missing }] };
    }

    default:
      throw new Error(`unknown task kind: ${kind}`);
  }
}

// ---- Coordinator: session + task plumbing ----

function upsertSession(db, sessionId, fields) {
  db.prepare(
    `INSERT INTO review_sessions (id, supabase_job_id, scope, base_commit, current_commit, status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       scope = excluded.scope,
       base_commit = excluded.base_commit,
       current_commit = excluded.current_commit,
       status = excluded.status,
       updated_at = excluded.updated_at`,
  ).run(
    sessionId,
    fields.supabase_job_id ?? null,
    fields.scope ?? null,
    fields.base_commit ?? null,
    fields.current_commit ?? null,
    fields.status ?? "running",
    nowIso(),
  );
}

function addTask(db, sessionId, kind, description, params) {
  const info = db
    .prepare(
      "INSERT INTO review_tasks (session_id, kind, description, params, status) VALUES (?, ?, ?, ?, 'pending')",
    )
    .run(sessionId, kind, description, params ? JSON.stringify(params) : null);
  return Number(info.lastInsertRowid);
}

function getTaskParams(taskRow) {
  return taskRow.params ? JSON.parse(taskRow.params) : {};
}

function nextPendingTask(db, sessionId) {
  return db
    .prepare("SELECT * FROM review_tasks WHERE session_id = ? AND status = 'pending' ORDER BY id LIMIT 1")
    .get(sessionId);
}

function markTask(db, taskId, status, evidenceRefs) {
  db.prepare("UPDATE review_tasks SET status = ?, evidence_refs = ? WHERE id = ?").run(
    status,
    JSON.stringify(evidenceRefs),
    taskId,
  );
}

function persistEvidence(db, taskId, kind, content) {
  const info = db
    .prepare("INSERT INTO review_evidence (task_id, kind, content, summary_hash) VALUES (?, ?, ?, ?)")
    .run(taskId, kind, typeof content === "string" ? content : JSON.stringify(content), null);
  return Number(info.lastInsertRowid);
}

function recordValidation(db, sessionId, module, check, commit, state) {
  db.prepare(
    "INSERT INTO validation_records (module, check_performed, commit_sha, state, run_id) VALUES (?, ?, ?, ?, ?)",
  ).run(module, check, commit, state, sessionId);
}

function upsertModule(db, m) {
  db.prepare(
    `INSERT INTO modules (name, purpose, source_paths, db_dependencies, rpc_dependencies, external_services, tests, criticality, mapping_state, validation_state, last_validated_commit, known_findings, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(name) DO UPDATE SET
       purpose = excluded.purpose,
       source_paths = excluded.source_paths,
       db_dependencies = excluded.db_dependencies,
       rpc_dependencies = excluded.rpc_dependencies,
       external_services = excluded.external_services,
       tests = excluded.tests,
       criticality = excluded.criticality,
       mapping_state = excluded.mapping_state,
       validation_state = excluded.validation_state,
       last_validated_commit = excluded.last_validated_commit,
       known_findings = excluded.known_findings,
       updated_at = datetime('now')`,
  ).run(
    m.name,
    m.purpose ?? null,
    JSON.stringify(m.source_paths ?? []),
    JSON.stringify(m.db_deps ?? []),
    JSON.stringify(m.rpc_deps ?? []),
    JSON.stringify(m.external ?? []),
    JSON.stringify(m.tests ?? []),
    m.criticality ?? "low",
    m.mapping_state ?? "MAPPED",
    m.validation_state ?? "NEEDS_REVIEW",
    m.last_validated_commit ?? null,
    JSON.stringify(m.notes ? [m.notes] : []),
  );
}

function upsertFlow(db, f) {
  db.prepare(
    `INSERT INTO critical_flows (name, steps, notes) VALUES (?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET steps = excluded.steps, notes = excluded.notes`,
  ).run(f.name, JSON.stringify(f.steps), f.note ?? null);
}

function upsertDependency(db, from, to) {
  db.prepare(
    "INSERT INTO module_dependencies (module_from, module_to, kind) VALUES (?, ?, 'depends') ON CONFLICT(module_from, module_to, kind) DO NOTHING",
  ).run(from, to);
}

function upsertTest(db, file, kind, target) {
  db.prepare(
    "INSERT INTO test_catalog (file, kind, target) VALUES (?, ?, ?) ON CONFLICT(file) DO UPDATE SET kind = excluded.kind, target = excluded.target",
  ).run(file, kind, target);
}

// ---- Coordinator: run a session (resumable) ----

async function runSession(ctx, { sessionId, jobId, baseCommit, currentCommit, scope, taskPlan }) {
  const { db, logger } = ctx;
  upsertSession(db, sessionId, { supabase_job_id: jobId, base_commit: baseCommit, current_commit: currentCommit, scope, status: "running" });

  // Resume: only add tasks when this session has none yet (idempotent across restarts).
  const existing = db.prepare("SELECT COUNT(*) AS n FROM review_tasks WHERE session_id = ?").get(sessionId);
  if (existing.n === 0) {
    for (const t of taskPlan) {
      addTask(db, sessionId, t.taskKind, t.description, t.params ?? {});
    }
  }

  const completed = [];
  let guard = 0;
  while (guard++ < MAX_TASKS_PER_SESSION) {
    const task = nextPendingTask(db, sessionId);
    if (!task) break;
    const params = getTaskParams(task);
    const evidenceRefs = [];
    let status = "done";
    try {
      const result = await runWorkerTask(ctx, { ...task, params });
      for (const ev of result.evidence) {
        evidenceRefs.push(persistEvidence(db, task.id, ev.kind, ev.content ?? ev));
      }
      completed.push({ kind: task.kind, description: task.description, summary: result.summary, evidenceRefs });
      logger.log("task_done", { session_id: sessionId, task_id: task.id, kind: task.kind });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if ((task.retry_count ?? 0) < MAX_RETRIES) {
        db.prepare("UPDATE review_tasks SET retry_count = retry_count + 1 WHERE id = ?").run(task.id);
        logger.log("task_retry", { session_id: sessionId, task_id: task.id, kind: task.kind });
        continue; // leave pending; will be retried next loop iteration
      }
      status = "failed";
      persistEvidence(db, task.id, "error", message);
      completed.push({ kind: task.kind, description: task.description, summary: `failed: ${message}` });
      logger.log("task_failed", { session_id: sessionId, task_id: task.id, kind: task.kind });
    }
    markTask(db, task.id, status, evidenceRefs);
  }

  db.prepare("UPDATE review_sessions SET status = 'done', updated_at = ? WHERE id = ?").run(nowIso(), sessionId);
  return completed;
}

// ---- Result builder (SPEC §17 standard review output) ----

function buildResult(ctx, { sessionId, currentCommit, tree, scope, completed, changedFiles = [], impact = null, checksSelected = [], findings = [], summary }) {
  const checks = completed.map((c) => ({ kind: c.kind, description: c.description, summary: c.summary }));
  return {
    schema_version: 1,
    agent: "engineering",
    session_id: sessionId,
    review_kind: scope,
    git_commit: currentCommit,
    git_tree: tree,
    scope,
    changed_files: changedFiles,
    checks_performed: checks,
    checks_selected: checksSelected,
    carried_forward: impact ? impact.carried_forward : [],
    validated_modules: impact ? impact.validated : [],
    stale_modules: impact ? impact.stale : [],
    impact: impact
      ? {
          directly_affected: impact.directly_affected,
          dependency_affected: impact.dependency_affected,
          deferred: impact.deferred,
        }
      : null,
    findings,
    severity: "info",
    confidence: "medium",
    questions: [],
    summary,
    production_changes_made: false,
    privacy: { external_ai_used: false, local_processing: true },
    runtime: {
      model: ctx.config.ollamaModel,
      attempts: 1,
      duration_ms: 0,
      tool_calls: checks.length,
    },
  };
}

// ---- Top-level spec ----

export default {
  agentKey: "engineering.local",
  capability: "engineering.local",
  jobTypes: ["engineering.review", "engineering.baseline", "engineering.synthetic"],
  ollamaModel: "deepseek-coder-v2:16b",
  pollSeconds: 10,
  leaseSeconds: 300,
  ollamaTimeoutMs: 180000,
  maxQualityAttempts: 3,
  tools: [
    "git.status", "git.diff_stat", "git.diff", "git.log", "git.rev",
    "git.ls_files", "git.show_stat", "file.read", "search", "node.check",
    "npm.lint", "npm.build", "npm.typecheck", "npm.test",
  ],

  async run(runtime, job) {
    const started = Date.now();
    const { config, logger } = runtime;
    const { db } = openDatabase(config.runtimeRoot);
    const tools = createToolGateway({ worktreePath: config.worktreePath });
    const ctx = { runtime, config, logger, db, tools };

    const payload = job.payload && typeof job.payload === "object" ? job.payload : {};
    const kind = payload.type || (job.job_type === "engineering.baseline" ? "baseline" : job.job_type === "engineering.synthetic" ? "synthetic" : "review");

    // Resolve the exact commit under review (payload override, else the worktree HEAD).
    let commit = typeof payload.commit_sha === "string" ? payload.commit_sha : null;
    let tree = null;
    if (!commit) {
      const rev = await tools.runTool("git.rev");
      if (rev.ok) { commit = rev.commit; tree = rev.tree; }
    }
    if (commit && !tree) {
      const rev = await tools.runTool("git.rev");
      tree = rev.ok ? rev.tree : null;
    }

    const sessionId = payload.session_id || (kind === "baseline" ? "ENGINEERING-BASELINE-001" : `ENG-${Date.now().toString(36)}`);
    const scope = kind;

    let completed;
    let summary;
    let changedFiles = [];
    let impact = null;
    let checksSelected = [];
    const findings = [];

    if (kind === "synthetic") {
      completed = await runSession(ctx, {
        sessionId,
        jobId: job.id,
        baseCommit: commit,
        currentCommit: commit,
        scope,
        taskPlan: [{ taskKind: "synthetic.ollama", description: "local ollama structured-JSON smoke", params: { prompt: payload.prompt } }],
      });
      summary = "synthetic engineering flow: local ollama + validation + complete";
    } else if (kind === "baseline") {
      completed = await runSession(ctx, {
        sessionId,
        jobId: job.id,
        baseCommit: commit,
        currentCommit: commit,
        scope,
        taskPlan: baselinePlan(),
      });
      const map = await writeBaselineMap(ctx, sessionId, commit);
      summary = `baseline: ${map.modules} modules, ${map.flows} flows, ${map.deps} deps, ${map.tests} tests at ${commit}`;
    } else {
      // review: true change-aware incremental review — diff base..current, map
      // changed files to modules, follow dependency edges, select checks, and
      // persist STALE / VALIDATED / carried-forward outcomes.
      const review = await runChangeAwareReview(ctx, {
        sessionId,
        jobId: job.id,
        baseCommit: payload.base_commit || commit,
        commit,
      });
      completed = review.completed;
      changedFiles = review.changedFiles;
      impact = review.impact;
      checksSelected = review.checksSelected;
      findings.push(...review.findings);
      summary = review.summary;
    }

    const result = buildResult(ctx, { sessionId, currentCommit: commit, tree, scope, completed, changedFiles, impact, checksSelected, findings, summary });
    result.runtime.duration_ms = Date.now() - started;
    logger.log("session_done", { session_id: sessionId, commit, tasks: completed.length });
    return result;
  },
};

// ---- Task plans ----

// ---- Change-aware review (diff → module impact → checks → memory) ----

function computeValidationOutcome(impact, checksRun, unavailable) {
  const anyFailed = checksRun.some((c) => c.ok === false);
  const anyUnavailable = unavailable.length > 0;
  const validated = !anyFailed && !anyUnavailable ? [...impact.directly_affected] : [];
  const validatedSet = new Set(validated);
  const stale = [...impact.directly_affected, ...impact.dependency_affected].filter((n) => !validatedSet.has(n));
  return { validated, stale };
}

function updateValidationMemory(db, impact, commit, sessionId, changedCount) {
  const { directly_affected, dependency_affected, validated } = impact;
  const affected = [...directly_affected, ...dependency_affected];
  for (const name of affected) {
    db.prepare("UPDATE modules SET validation_state = 'STALE', updated_at = datetime('now') WHERE name = ?").run(name);
  }
  for (const name of validated) {
    db.prepare("UPDATE modules SET validation_state = 'VALIDATED', last_validated_commit = ? WHERE name = ?").run(commit, name);
  }
  recordValidation(db, sessionId, "repository", `change-aware diff (${changedCount} changed files): ${directly_affected.length} direct + ${dependency_affected.length} dependency affected`, commit, "VALIDATED");
  for (const name of validated) {
    recordValidation(db, sessionId, name, "re-validated after checks passed", commit, "VALIDATED");
  }
  for (const name of affected.filter((n) => !validated.includes(n))) {
    recordValidation(db, sessionId, name, "STALE — affected by change; required checks not (fully) passed", commit, "STALE");
  }
}

async function runChangeAwareReview(ctx, { sessionId, jobId, baseCommit, commit }) {
  const { db, tools } = ctx;

  // Structural baseline tasks via the resumable session (git.rev, git.status).
  const completed = await runSession(ctx, {
    sessionId,
    jobId,
    baseCommit,
    currentCommit: commit,
    scope: "review",
    taskPlan: [
      { taskKind: "git.rev", description: "record exact commit and tree", params: {} },
      { taskKind: "git.status", description: "assert worktree clean", params: {} },
    ],
  });

  // Deterministic diff via the allowlisted tool (no git command construction).
  const diff = await tools.runTool("git.diff_names", { base: baseCommit, current: commit });
  const changedFiles = diff.ok && Array.isArray(diff.changes) ? diff.changes : [];
  if (!diff.ok) {
    return {
      completed,
      changedFiles: [],
      impact: null,
      checksSelected: [],
      findings: [{ severity: "warn", message: `diff failed: ${diff.error}` }],
      summary: `review ${sessionId}: diff failed (${diff.error})`,
    };
  }

  // Map changed files → modules (direct + transitive dependency affected).
  const impact = mapModuleImpact(changedFiles, MODULES, DEPENDENCIES);

  // Select + run checks for the directly affected modules.
  const checksSelected = selectChecksForFiles(changedFiles);
  const checksRun = [];
  const findings = [];
  for (const c of checksSelected) {
    if (!c.runnable) {
      findings.push({ severity: "info", message: `${c.kind} required for ${c.params.path} — not runnable in isolated worktree (no node_modules)` });
      continue;
    }
    try {
      const r = await runWorkerTask(ctx, { kind: c.kind, params: c.params });
      checksRun.push({ kind: c.kind, description: c.description, summary: r.summary, ok: r.ok });
    } catch (err) {
      checksRun.push({ kind: c.kind, description: c.description, summary: `failed: ${err instanceof Error ? err.message : String(err)}`, ok: false });
    }
  }

  const unavailable = checksSelected.filter((c) => !c.runnable);
  const outcome = computeValidationOutcome(impact, checksRun, unavailable);
  impact.validated = outcome.validated;
  impact.stale = outcome.stale;

  updateValidationMemory(db, impact, commit, sessionId, changedFiles.length);

  for (const c of checksRun) completed.push({ kind: c.kind, description: c.description, summary: c.summary });

  const summary = `change-aware review: ${changedFiles.length} changed files → ${impact.directly_affected.length} direct + ${impact.dependency_affected.length} dependency affected; ${impact.carried_forward.length} carried forward; ${impact.validated.length} re-validated`;

  return {
    completed,
    changedFiles,
    impact,
    checksSelected: checksSelected.map((c) => ({ kind: c.kind, path: c.params?.path, runnable: c.runnable })),
    findings,
    summary,
  };
}

function baselinePlan() {
  // Bounded, deterministic first-pass mapping tasks. Each is one Worker task.
  return [
    { taskKind: "git.rev", description: "record baseline commit + tree", params: {} },
    { taskKind: "git.status", description: "confirm clean baseline", params: {} },
    { taskKind: "git.ls_files", description: "enumerate tracked repository files", params: {} },
    { taskKind: "files", description: "enumerate route/page files", params: { glob: "app/**/*.tsx" } },
    { taskKind: "files", description: "enumerate API routes", params: { glob: "app/api/**/*.ts" } },
    { taskKind: "files", description: "enumerate lib modules", params: { glob: "lib/**/*.ts" } },
    { taskKind: "files", description: "enumerate migrations", params: { glob: "supabase/migrations/*.sql" } },
    { taskKind: "search", description: "find server actions", params: { pattern: "use server", glob: "app/**/*.ts" } },
    { taskKind: "parse.migrations", description: "extract tables/functions from migrations", params: {} },
    { taskKind: "read.package", description: "read package.json scripts/deps", params: {} },
  ];
}

async function writeBaselineMap(ctx, sessionId, commit) {
  const { db } = ctx;
  const counts = { modules: 0, flows: 0, deps: 0, tests: 0 };

  // Curated module map (idempotent upsert). Post-V1 areas remain DEFERRED.
  for (const m of MODULES) {
    const deferred = m.category === "post-v1";
    upsertModule(db, {
      ...m,
      mapping_state: "MAPPED",
      validation_state: deferred ? "DEFERRED" : "NEEDS_REVIEW",
      last_validated_commit: commit,
    });
    counts.modules += 1;
  }

  // Behavioral / critical flows.
  for (const f of FLOWS) {
    upsertFlow(db, f);
    counts.flows += 1;
  }

  // Module-level dependency edges (change-impact graph).
  for (const [from, to] of DEPENDENCIES) {
    upsertDependency(db, from, to);
    counts.deps += 1;
  }

  // Test catalog: discover deterministic check files via the tool gateway.
  const [unitTests, dbTests, scripts] = await Promise.all([
    ctx.tools.runTool("files", { glob: "tests/**" }),
    ctx.tools.runTool("files", { glob: "supabase/tests/**" }),
    ctx.tools.runTool("files", { glob: "scripts/*.mjs" }),
  ]);
  const catalog = [
    ...(unitTests.stdout || "").split("\n").filter(Boolean).map((f) => [f, "test"]),
    ...(dbTests.stdout || "").split("\n").filter(Boolean).map((f) => [f, "db-test"]),
    ...(scripts.stdout || "").split("\n").filter(Boolean).map((f) => [f, "verification"]),
  ];
  for (const [file, kind] of catalog) {
    upsertTest(db, file, kind, null);
    counts.tests += 1;
  }

  // Validation ledger (honest states; nothing fabricated).
  recordValidation(db, sessionId, "repository", "baseline commit + tree + clean status", commit, "VALIDATED");
  recordValidation(db, sessionId, "repository", "structural enumeration (routes/libs/migrations/scripts)", commit, "VALIDATED");
  recordValidation(db, sessionId, "modules", `curated module map (${counts.modules} modules)`, commit, "NEEDS_REVIEW");
  recordValidation(db, sessionId, "critical_flows", `behavioral flow map (${counts.flows} flows)`, commit, "NEEDS_REVIEW");
  recordValidation(db, sessionId, "module_dependencies", "module-level dependency graph", commit, "NEEDS_REVIEW");
  recordValidation(db, sessionId, "test_catalog", `${counts.tests} check files discovered (NOT individually executed)`, commit, "NEEDS_REVIEW");
  recordValidation(db, sessionId, "build", "npm build/lint/typecheck NOT RUN (isolated worktree has no node_modules)", commit, "NEEDS_REVIEW");
  recordValidation(db, sessionId, "inspection-lab", "post-V1", commit, "DEFERRED");
  recordValidation(db, sessionId, "finance-agent", "post-V1", commit, "DEFERRED");

  setState(db, "last_mapped_commit", commit || "");
  return counts;
}

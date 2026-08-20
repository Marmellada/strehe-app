import { createToolGateway } from "../lib/tools.mjs";
import { openDatabase, setState } from "../lib/sqlite.mjs";
import { ollamaChat } from "../lib/ollama.mjs";
import { parseJsonLoose } from "../lib/json.mjs";

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
      const r = await tools.runTool("git.ls_files");
      if (!r.ok) throw new Error(`git.ls_files failed: ${r.error}`);
      const files = (r.stdout || "").split("\n").filter(Boolean);
      return { ok: true, summary: `${files.length} tracked files`, evidence: [{ kind: "git.ls_files", count: files.length, files }] };
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

function buildResult(ctx, { sessionId, currentCommit, tree, scope, completed, findings = [], summary }) {
  return {
    schema_version: 1,
    agent: "engineering",
    session_id: sessionId,
    review_kind: scope,
    git_commit: currentCommit,
    git_tree: tree,
    scope,
    checks_performed: completed.map((c) => ({ kind: c.kind, description: c.description, summary: c.summary })),
    carried_forward: [],
    validated_modules: [],
    stale_modules: [],
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
      tool_calls: completed.length,
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
      // Bounded baseline mapping plan (Phase 2 runs this incrementally).
      completed = await runSession(ctx, {
        sessionId,
        jobId: job.id,
        baseCommit: commit,
        currentCommit: commit,
        scope,
        taskPlan: baselinePlan(ctx, commit),
      });
      // Persist a coarse structural map from the evidence we collected.
      persistBaselineMap(ctx, sessionId, commit, completed);
      summary = `baseline mapping: ${completed.length} bounded tasks executed at ${commit}`;
    } else {
      // review: change-aware incremental review (Phase 1 read-only proof uses a
      // narrow scope; full change-aware diffing is exercised during baseline+).
      completed = await runSession(ctx, {
        sessionId,
        jobId: job.id,
        baseCommit: payload.base_commit || commit,
        currentCommit: commit,
        scope,
        taskPlan: reviewPlan(ctx, payload),
      });
      summary = `review ${sessionId}: ${completed.length} checks at ${commit}`;
    }

    const result = buildResult(ctx, { sessionId, currentCommit: commit, tree, scope, completed, findings, summary });
    result.runtime.duration_ms = Date.now() - started;
    logger.log("session_done", { session_id: sessionId, commit, tasks: completed.length });
    return result;
  },
};

// ---- Task plans ----

function reviewPlan(ctx, payload) {
  const scope = typeof payload.scope === "string" && payload.scope ? payload.scope : null;
  const plan = [
    { taskKind: "git.rev", description: "record exact commit and tree", params: {} },
    { taskKind: "git.status", description: "assert worktree clean", params: {} },
    {
      taskKind: "git.ls_files",
      description: scope ? `list tracked files under ${scope}` : "enumerate tracked files",
      params: scope ? { path: scope } : {},
    },
  ];
  if (typeof payload.check_file === "string" && payload.check_file) {
    plan.push({
      taskKind: "node.check",
      description: `deterministic syntax check: ${payload.check_file}`,
      params: { path: payload.check_file },
    });
  }
  return plan;
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
    { taskKind: "search", description: "find cron routes", params: { pattern: "cron", glob: "app/api/cron/**" } },
  ];
}

function persistBaselineMap(ctx, sessionId, commit, completed) {
  const { db } = ctx;
  for (const c of completed) {
    if (c.kind === "git.ls_files") {
      recordValidation(db, sessionId, "repository.files", "enumerated tracked files", commit, "VALIDATED");
    } else if (c.kind === "search" || c.kind === "files") {
      recordValidation(db, sessionId, c.description, "structured search", commit, "VALIDATED");
    }
  }
  setState(db, "last_mapped_commit", commit || "");
}

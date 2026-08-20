# STREHË Engineering Agent V1 — Specification

- **Type:** Documentation/design only (no code, no migrations, no config/DB/credential
  changes, no merge/cherry-pick/rebase/push).
- **Date:** 2026-08-20
- **Parent SPEC:** `docs/architecture/GMK-AGENT-WORKER-V1-SPEC.md` (this is the
  Engineering-specific companion; the worker SPEC is the runtime contract).
- **Scope:** the Engineering Agent for the GMK Agent Worker V1.

---

## 1. Purpose and scope

The Engineering Agent is STREHË's local engineering-support agent. It maintains durable
technical understanding of the codebase and executes bounded, evidence-based reviews and
investigations — always READ / ANALYZE / TEST / RECOMMEND / PLAN / VERIFY, never
mutating application code, configuration, or production state.

Post-V1 areas (Inspection/Photo-Comparison, Finance) are mapped but marked DEFERRED.

---

## 2. Role model — two logical roles

The Engineering Agent is **two logical roles**, not necessarily two processes or models:

### Engineering Coordinator
Owns continuity and technical understanding:
- system map, dependency graph, critical-workflow map
- validation ledger, decision/finding ledger
- review planning and change-impact analysis
- deciding which checks/tasks are necessary
- deciding when a review is complete
- preparing final findings / recommendations / questions

### Engineering Worker
Executes bounded technical tasks the Coordinator assigns:
- repository search/read, dependency/reference tracing
- `git status` / `diff` / `log`
- targeted tests, lint, typecheck (where applicable), build
- evidence collection, failure investigation

The Worker needs **no long-term memory**. In V1, Coordinator and Worker may use the same
Ollama model sequentially (they are roles, not separate models/processes).

---

## 3. Memory architecture — structured state, not LLM context

Model context is ephemeral. Durable continuity comes from structured state.

The Engineering Agent must remember:
- what STREHË contains and where each module lives
- how modules depend on one another
- important end-to-end workflows
- what has been tested/reviewed, against which Git commit/fingerprint
- findings previously raised, and which recommendations were accepted/rejected/deferred
  and why
- what review/task was in progress before interruption

None of this may depend on retained model context. It all lives in the local runtime
database (§4).

---

## 4. Local storage on D: (backed up, separate from source)

Persistent Engineering state lives on the protected D: drive (already within the
existing backup strategy), separate from the application source worktree.

Proposed runtime-data root (clean, git-ignored, outside any app worktree):

```
D:\Personal\Projects\Strehe-Prona\STREHE-ENGINEERING-RUNTIME\
  state\engineering.sqlite3        # operational memory (single SQLite DB)
  state\artifacts\                 # large logs / test outputs (paths referenced from DB)
  worktree\strehe-app-engineering\ # isolated, controlled git worktree (read/analyze/test)
```

- SQLite is the V1 store unless inspection later reveals a concrete reason to change.
- Large logs/test artifacts are stored as files under `state\artifacts\` with their
  paths referenced from SQLite.
- The production repository remains versioned in Git; this DB is operational memory,
  not source of truth for code.
- **No new production Supabase schema** is required for this memory in V1.

---

## 5. SQLite logical stores (tables)

- `modules` — module name/purpose, source paths, DB/RPC/API deps, upstream/downstream
  deps, external services, relevant tests, criticality, mapping state, validation state,
  last validated commit/fingerprint, known findings.
- `module_dependencies` — (module_from, module_to, kind, notes).
- `critical_flows` — named end-to-end workflows with ordered module/step traces.
- `test_catalog` — test file/suite, target module/flow, kind, last run, last commit, status.
- `validation_records` — module/flow, check performed, evidence ref, commit/fingerprint,
  state, timestamp, run id.
- `engineering_findings` — finding, evidence, recommendation, severity, confidence,
  lifecycle state, timestamps.
- `engineering_decisions` — recommendation, human decision (accepted/rejected/deferred),
  reason, revisit condition/date, timestamps.
- `review_sessions` — session id, scope, base commit, current commit, status, created/updated.
- `review_tasks` — session id, task description/kind, status (pending/running/done/
  failed/needs_human), retry count, assigned role, evidence refs.
- `review_evidence` — task id, kind, path/ref, summary hash.
- `runtime_state` — key/value for agent runtime (last polled commit, current model,
  freshness config, safety counters).

---

## 6. Secret boundary

Persistent backed-up state is **separate from credentials**.

- No plaintext production secrets are ever written into `STREHE-ENGINEERING-RUNTIME\`.
- Agent credentials use Windows-secure/OS-protected credential storage (e.g. Windows
  Credential Manager / DPAPI) — never the runtime-data directory, never git.
- The Engineering runtime must **never** receive: Supabase service-role key, Meta
  secrets/tokens, Vercel credentials, DNS credentials, billing credentials, or
  production deployment credentials.
- The Supabase anon key is not a secret (public by design) and may live in the runtime
  env; the agent password is stored via OS-protected storage, not plaintext on disk.

---

## 7. First assignment — ENGINEERING-BASELINE-001 (authoritative system map)

Before routine reviewing begins, the first real Engineering job is:

**ENGINEERING-BASELINE-001 — Build authoritative STREHË system map.**

The Coordinator splits it into bounded Worker tasks covering, at minimum:
- routes/pages, server actions, libraries/services
- Supabase tables, RPCs, migrations
- queues/workers, crons
- authentication/RBAC
- external integrations, configuration dependencies
- test coverage, important operational modules, major end-to-end workflows

Per module, capture approximately:
- name/purpose, source paths, database dependencies, RPC/API dependencies
- upstream dependencies, downstream dependents, external services
- relevant tests, criticality/risk level, mapping completeness, validation state
- last validated commit/fingerprint, known findings

**Mapping states:** `UNKNOWN`, `PARTIALLY_MAPPED`, `MAPPED`.
**Validation states:** `UNKNOWN`, `NEEDS_REVIEW`, `VALIDATED`, `STALE`, `FAILED`, `DEFERRED`.

Post-V1 areas (Inspection/Photo-Comparison, Finance) are mapped but marked `DEFERRED`
rather than exhaustively validated.

---

## 8. Structural map + behavioral map

Two complementary maps in memory:

**Structural map** (what exists and where): routes, components, libraries, DB objects,
RPCs, queues, integrations, tests.

**Behavioral / critical-flow map** (how real processes traverse the system), e.g.:
- inbound Meta message → webhook → journal → ingestion queue → normalize → identity →
  conversation → notification → Operator Inbox
- inquiry → qualification → lead → offer → contract → payment/client
- other major flows discovered during baseline mapping.

The behavioral map enables cross-module regression reasoning (a change to one step is
understood in terms of the flows it breaks).

---

## 9. Change-aware incremental validation

After baseline, routine reviews are incremental. At the start of a review:

1. Load system map and last validation state.
2. Determine previous reviewed Git commit.
3. Determine current commit.
4. Inspect the diff.
5. Map changed files/config/schema/dependencies to affected modules/flows.
6. Carry forward still-valid validations for unaffected areas.
7. Mark affected validations `STALE`.
8. Create only the required review/test tasks.
9. Execute them.
10. Update validation memory.

Core principle: **never spend compute re-proving something merely because the agent woke
up — first determine whether previous evidence remains valid.**

---

## 10. Dependency-aware invalidation

A module is revalidated not only when its own files change, but when relevant
dependencies change. Examples:

- an auth change may invalidate Contracts/Inbox/Admin validation
- a schema/RLS change may invalidate every dependent workflow
- a shared messaging-normalization change may invalidate Inbox + notifications
- a dependency/package/config upgrade may invalidate previously green modules

`module_dependencies` and `critical_flows` must carry enough information to support this
transitive invalidation.

---

## 11. Validation freshness

A `VALIDATED` result is not permanent. Support periodic revalidation based on criticality
even when Git is unchanged. Example policy (configurable, not hard-coded into prompts):

- low-risk stable modules: longer freshness
- customer messaging / auth / security: shorter freshness
- high-risk financial/security areas (later): stricter freshness

Exact intervals live in `runtime_state`/config, not in model prompts.

---

## 12. Decision memory

Remember previous recommendations and Milot's decisions. Finding lifecycle:

`OPEN → ACCEPTED / REJECTED / DEFERRED → (IMPLEMENTED → VERIFIED) | OBSOLETE`

Record: finding, evidence, recommendation, expected benefit, risk/complexity, human
decision, reason, revisit condition/date (if deferred).

The agent must **not** repeatedly rediscover/recommend a rejected or deferred item unless
materially new evidence exists.

---

## 13. Review-session resumability

One top-level Engineering review (Supabase job) may contain multiple bounded internal
tasks, e.g. ENG-042: inspect changed files → trace dependency impact → run targeted
tests → inspect security implications → run downstream smoke check.

Persist task state locally so that after model-context reset, worker restart, Ollama
restart, or PC reboot/crash, the Coordinator reloads the session and continues from the
next incomplete task rather than starting over. The Coordinator may create additional
tasks when evidence requires.

Bounded safety limits:
- maximum tasks per review
- maximum retries per task
- maximum runtime / model calls per session
- explicit `HUMAN_INPUT_REQUIRED` state when limits/ambiguity are reached

---

## 14. Relationship to Supabase agent_jobs

Keep the existing Supabase `agent_jobs` as the authoritative top-level cloud/runtime job
contract. For Engineering V1:

- **one Supabase Engineering job = one review/investigation session**
- local SQLite `review_tasks`/`review_evidence` hold the Coordinator's internal bounded
  subtasks (no Supabase migration for internal task decomposition).

This preserves future compatibility with true agent-to-agent Supabase jobs.

---

## 15. Permissions (V1)

Strictly: READ / ANALYZE / TEST / RECOMMEND / PLAN / VERIFY.

Allowed: repo read/search, `git status`, `git diff`, `git log`, tests, lint, typecheck
(where applicable), build, controlled dependency inspection.

Not allowed: editing application code, creating patches, commit, merge, rebase, push,
tags, deployments, migrations, production DB writes, configuration/secrets changes.

**No `patch.prepare` capability in V1.**

---

## 16. Isolated worktree

The Engineering Agent operates against its own controlled worktree on D:
(`STREHE-ENGINEERING-RUNTIME\worktree\strehe-app-engineering`), separate from the
human/Codex production worktree.

Synchronization (remote-read only, no remote mutation):
- `git -C <worktree> fetch origin` (read-only remote fetch; no push, no merge)
- `git -C <worktree> checkout --detach <commit-sha>` then `git reset --hard <commit-sha>`
  (local operations in the isolated worktree only)
- never `push`, never branch mutation, never touch remotes' state

Every result states the exact Git commit reviewed (full SHA + tree fingerprint).

---

## 17. Standard review output

Standardized findings (jsonb in `job.result`), approximately:

- review/session ID
- Git commit reviewed (+ fingerprint)
- scope
- tests/checks performed
- carried-forward validations
- newly validated modules
- stale/failed modules
- findings (with evidence, severity, confidence)
- recommended solution + implementation plan + risks
- tests required after implementation
- questions requiring human decision
- explicit statement that no production changes were made

If no defects are found, still report PASS and surface genuinely useful improvement
opportunities.

---

## 18. Baseline acceptance criteria (ENGINEERING-BASELINE-001)

PASS only when:
- major production modules are mapped
- important DB/RPC/queue/integration dependencies are mapped
- major behavioral workflows are mapped
- existing tests are catalogued
- criticality is assigned
- unknown/deferred areas are explicitly identified
- baseline build/lint/test status is recorded
- current production commit is recorded
- initial validation ledger exists
- state survives agent/process restart
- the Coordinator can create and resume Worker tasks from local memory

Deep validation of every postponed/non-V1 module is not required.

---

## 19. Coordinator / Worker execution lifecycle

1. Worker claims one Supabase `agent_jobs` (one Engineering review session).
2. Coordinator boots → loads local SQLite state (system map, validation ledger, decision
   memory, any prior session).
3. Coordinator determines scope: previous reviewed commit vs current commit, inspect
   diff, map to affected modules/flows (change-aware, dependency-aware).
4. Coordinator plans: carries forward valid validations, marks affected `STALE`, creates
   bounded `review_tasks`.
5. Coordinator dispatches each task to the Worker (same process/model, role-prompted).
   Worker executes a bounded technical task through the tool gateway (read-only git,
   search, tests/lint/typecheck/build) and returns evidence.
6. Coordinator records evidence (`review_evidence`), updates `validation_records`,
   `modules`, `engineering_findings`; decides the next task or completion.
7. On completion, Coordinator writes the final review result and calls
   `complete_agent_job` (→ `awaiting_review`).
8. On interruption (context reset/restart/crash), Coordinator reloads the session from
   SQLite and resumes from the next incomplete task.

---

## 20. Deferred / out of scope

- Engineering patch-writing / `patch.prepare` (a later, explicit permission increase).
- Autonomous deployment or any production mutation.
- Inspection/Photo-Comparison and Finance agents (mapped as `DEFERRED` only).
- Agent Council / multi-agent meetings.

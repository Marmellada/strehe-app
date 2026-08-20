# STREHË GMK Agent Worker V1 — Implementation Specification

- **Type:** Documentation-only implementation specification (no code, no migrations, no
  config/DB changes, no merge/cherry-pick/rebase/push).
- **Date:** 2026-08-20
- **Status:** SPEC — awaiting Founder authorization before implementation.
- **Authoritative inputs:**
  - Production agent DB substrate (`supabase/migrations/20260611120000…`,
    `20260612110000…`).
  - `docs/architecture/STREHE-AGENTIC-ARCHITECTURE-AUDIT.md`
  - `docs/architecture/GMK-AGENT-WORKER-DESIGN-INPUT.md`
  - Reference implementation: `scripts/local-inspection-agent.mjs`,
    `scripts/provision-inspection-agent.mjs`, `scripts/provision-finance-agent.mjs`
    (unmerged branch `codex/household-agent-foundations` / `qwen-inspection-lab-drafts`).

**Core decision:** Do NOT merge/cherry-pick the old agent branch. Build clean on
`release/strehe-meta-gateway-production`, manually porting only the reusable patterns.

---

## 1. Goals and non-goals

**Goals (V1 does):**
- Run one local Node runtime (the "GMK Agent Worker") that authenticates as a dedicated
  Supabase agent identity, discovers/claims/renews agent jobs, invokes a local Ollama
  model, validates output, and completes/fails jobs — all against the existing
  `agent_*` DB substrate with no schema change.
- Support three agent roles through per-agent specs: **Inbox** (active),
  **Growth** (spec present, disabled until reporting exists), **Engineering**
  (local, read/analyze/test only).
- Inbox Agent: produce structured draft analysis (classification, summary, urgency,
  intent, recommended state/action, suggested reply) for a human to review. READ /
  ANALYZE / PREPARE only.
- Preserve the human-in-the-loop guarantee: every customer-facing side effect continues
  to flow through the existing human operator path (`lib/actions/inbox.ts` `sendReply`).

**Non-goals (V1 deliberately does NOT):**
- Send customer messages, publish content, spend money, or deploy anything.
- Autonomous Engineering code changes/pushes (read/analyze/test only; patch-writing is
  a later permission increase).
- Inspection/Photo-Comparison Agent and Finance Agent (their old implementations are
  references only).
- Agent-to-agent meetings / Agent Council (future scope only — see §13).
- Cloud LLM fallback (loopback Ollama only, unless separately approved).

---

## 2. Runtime architecture

Smallest practical Node (`.mjs`, ESM) design — a single worker process with a shared
core and a thin per-agent spec. No framework, no plugin registry.

```
gmk-agent-worker/
  worker.mjs              # entrypoint: parse --agent <key> [--once], load spec, boot, loop
  lib/
    env.mjs              # readEnv (ported from reference) + requireValue
    supabase.mjs         # createClient(anonKey) + signInWithPassword
    ollama.mjs           # ollamaChat(model, prompt, images?) loopback-only, format=json
    json.mjs             # cleanJsonText, metadataRecord (ported from reference)
    validate.mjs         # forbiddenKeys + privacy assertion helpers (generalized)
    claim-loop.mjs       # discovery + by-id claim + lease renewal + dispatch
    tools.mjs            # engineering tool gateway (allowlist) — empty for non-eng agents
    logging.mjs          # structured single-line JSON logs (no message content)
  agents/
    inbox.spec.mjs
    growth.spec.mjs
    engineering.spec.mjs
  provision-agent.mjs    # generalized provisioning (service_role, offline admin step)
  verify-agent-flow.mjs  # end-to-end synthetic-job verification (like verify-*-flow.mjs)
```

Component behaviors:

- **Supabase authentication** — `createClient(url, anonKey, {autoRefreshToken:true,
  persistSession:false})` then `signInWithPassword(email, password)`. User-scoped JWT;
  the RPCs resolve identity via `auth.uid()`. Never service_role at runtime.
- **Job discovery** — SELECT `agent_jobs` WHERE `required_capability = <spec.capability>`
  AND `status='queued'` AND `available_at <= now()` AND `expires_at > now()`,
  ORDER BY `priority ASC, created_at ASC`, LIMIT 5 (same as reference).
- **By-ID claiming** — `claim_agent_job(target_job_id, lease_seconds)`. On error, treat
  as a lost race and `continue`; never fail the job for a claim error.
- **Lease renewal** — while a job is processing, renew on an interval
  (`renew_agent_job_lease(id, lease_seconds)`) at `lease/3` cadence. Reference worker
  omitted this; V1 adds it so long Engineering builds can't outlive the lease.
- **Dispatch** — map `job.required_capability` → spec; if no spec matches, fail with
  `unsupported_capability` (defensive; should not happen given discovery filter).
- **Ollama invocation** — via `lib/ollama.mjs`; `format:"json"`, `stream:false`,
  `think:false`, per-spec model, timeout from spec.
- **Validation** — spec's `outputValidator` plus shared `forbiddenKeys`/privacy checks;
  bounded retry (spec.maxQualityAttempts, default 3) feeding errors back into the prompt.
- **complete/fail** — `complete_agent_job(id, result)` (→ `awaiting_review` if
  `requires_review`), else `fail_agent_job(id, code, message)`.
- **Shutdown/recovery** — SIGINT/SIGTERM handler stops claiming and exits cleanly
  between jobs; on crash, DB lease-expiry re-enables claim. No partial-write recovery
  beyond the DB state machine.
- **Logging** — one JSON line per event (`{ts, agent, capability, job_id, model,
  event, duration_ms, attempt, tool, error_class}`). No message text, PII, or
  conversation content is ever logged.

---

## 3. Agent identity model

- **One Supabase Auth identity per agent.** Each agent is a distinct `auth.users` row
  with a matching `agent_principals` row (`agent_principals.id = auth.users.id`). The
  DB trigger enforces mutual exclusivity between `agent_principals` and `app_users`.
- **`agent_capabilities`** grant exactly the capabilities an agent needs
  (e.g. `inbox.analyze`, `growth.recommend`, `engineering.local`). Capability is the
  routing/authorization key checked by both `claim_agent_job` and the eligible-jobs
  SELECT policy.
- **Local credential handling** — per-agent `.env` file (`.env.gmk-<agent>.local`):
  `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_AGENT_EMAIL`,
  `SUPABASE_AGENT_PASSWORD`, `OLLAMA_BASE_URL` (loopback), `OLLAMA_MODEL`,
  `GMK_POLL_SECONDS`. Never committed to git; gitignored.
- **Provisioning** — a single `provision-agent.mjs` (generalized from the two existing
  provision scripts): service_role creates/updates the `auth.users` identity with
  `user_metadata {identity_type:"agent", agent_key}` → deletes the auto-created
  `app_users` row → upserts `agent_principals` + `agent_capabilities` → writes the
  local `.env`. This is an offline, operator-run step, not part of the runtime.
- **No runtime service_role.** service_role appears only in `provision-agent.mjs` and
  the verification script. The worker process holds only the anon key + agent
  credentials.

---

## 4. Agent spec contract

Each spec exports one object (no class hierarchy):

```js
export default {
  agentKey: "inbox",                       // matches agent_principals.agent_key
  capability: "inbox.analyze",             // required_capability it claims
  jobTypes: ["inbox.analyze"],             // accepted job_type values
  ollamaModel: "qwen3.5:2b",               // per-agent model (must be installed locally)
  pollSeconds: 10,
  leaseSeconds: 300,
  ollamaTimeoutMs: 180000,
  maxQualityAttempts: 3,
  tools: [],                               // engineering.spec populates this
  promptBuilder(job, context) -> string,   // prompt text (no images by default)
  inputLoader(supabase, job) -> context,   // read payload/artifacts; no table reads beyond own scope
  outputValidator(result) -> string[],     // returns validation error messages (empty = pass)
  resultShape(job, context, output) -> object, // final job.result to persist
};
```

No more abstraction than this. `worker.mjs` drives discovery → claim → load → prompt →
ollama → validate (retry) → shape → complete/fail.

---

## 5. Job lifecycle

```
queued ──discover──> claimed ──claim_agent_job──> running
   │                    │                              │
   │            (claim error → skip)          lease renewal loop (renew/3)
   │                    │                              │
   │                    └──(lost race)──> another agent│
   │                                                   ▼
   │                                     output validation (bounded retry)
   │                                                   │
   │                          ┌────────────────────────┴───────────────┐
   │                          ▼                                        ▼
   │                  complete_agent_job                         fail_agent_job
   │                          │                                        │
   │              (requires_review?) ──yes──> awaiting_review      status='failed'
   │                          └─no──> completed                    (error_code/msg)
   └────────────────────────────────────────────────────────────────────────────
```

- **Claim races:** `claim_agent_job` is by-id with `FOR UPDATE`; a concurrent worker
  loses with a `'not claimable'` exception. The loser MUST `continue` (skip), never
  fail the job.
- **Expired leases:** a `running` job whose lease expired is reclaimable by the next
  `claim_agent_job` (which marks the prior run `failed(lease_expired)`). A single worker
  per capability keeps this rare; crash recovery relies on this reclaim.
- **Lease renewal:** long jobs renew via `renew_agent_job_lease` on a timer so the lease
  never lapses mid-processing. If renewal fails, the worker aborts and fails the job
  rather than risk a double-claim.

---

## 6. Inbox Agent V1 contract

- **Trigger/input:** an Inbox analysis job is enqueued (future app-side step) with
  `payload = { conversation_id, channel, identity_label, attention_state, recent_messages:
  [{direction, message_type, text_content, occurred_at}] }`. V1 uses the
  **context-in-payload** pattern: the enqueuer (admin/service_role) bundles the
  conversation context into `payload`, so the agent never needs a grant on messaging
  tables and the "messaging tables are authenticated SELECT-only to admin/office" posture
  is preserved. (A narrow agent read RPC is a possible later enhancement — deferred.)
- **Data it may read:** only its own `agent_jobs` payload/result, `agent_artifacts`, and
  its own `agent_principals`/`agent_capabilities`. It does NOT read
  `conversations`/`conversation_messages` directly.
- **Structured output** (`job.result`, `schema_version: 1`):
  ```
  {
    schema_version: 1,
    agent: "inbox",
    conversation_id, channel,
    classification: { category, urgency: "low|normal|urgent", intent, summary },
    recommended: { attention_state, action, suggested_reply, rationale },
    privacy: { external_ai_used: false, local_processing: true },
    runtime: { model, attempts, duration_ms, tool_calls: [] }
  }
  ```
  `suggested_reply` is a **draft**, never sent by the agent.
- **Approval behavior:** the job completes to `awaiting_review` (`requires_review=true`).
  A human operator reviews the draft and, if accepted, sends it through the EXISTING
  human path (`lib/actions/inbox.ts` `sendReply`, admin/office only). The agent has no
  path to `sendMetaMessage` and holds no Meta tokens.
- **Hard prohibition:** the Inbox spec has `tools: []` and no outbound capability. The
  runtime denies any attempt to call the messaging send functions; there is no code
  path from the worker to `lib/messaging/send/*`.
- **Relationship to Operator Inbox:** V1 surfaces the draft in the operator inbox
  conversation view (a read-only panel + "copy/edit draft" into the existing reply box).
  Human approval happens BEFORE any customer-facing side effect.

---

## 7. Growth Agent V1 contract

- **Interface:** identical spec shape; `capability = "growth.recommend"`,
  `jobTypes = ["growth.recommend"]`, `tools: []`.
- **Data dependencies (future):** reads reporting/funnel data (`leads`, `lead_events`,
  attribution, `lib/funnel/reporting.ts`, the future social-media reporting layer).
  Until that reporting layer exists, no Growth jobs are enqueued.
- **Output (future):** `{ schema_version: 1, agent: "growth", recommendations: [...],
  rationale, privacy, runtime }` — recommendations only.
- **Disabled by default:** no spec-driven enqueue, no capability granted at provisioning
  until the reporting layer lands. The runtime already supports it; only activation
  (provision identity + start enqueuing) is deferred.
- **Hard prohibitions:** MUST NOT publish content or spend money; no Meta
  publishing/ad-spend credentials are ever provisioned.

---

## 8. Engineering Agent V1 contract

- **Isolated worktree:** runs against a dedicated git clone/worktree under a
  `GMK_ENGINEERING_ROOT` (e.g. `D:\Personal\Projects\Strehe-Prona\gmk-engineering-worktree`),
  created by the operator, NEVER the production worktree. The worker refuses to run if
  cwd equals a production worktree path.
- **Initial tool categories (read/analyze/test):**
  - repo read/search: `rg`/`grep`-style file search (read-only).
  - `git status`, `git diff`, `git diff --stat`, `git log`, `git show` (read-only).
  - tests: `npm test` / `npx playwright test <subset>` / `python -m pytest` (whitelisted).
  - lint/build: `npm run lint`, `npm run build` (whitelisted, output captured).
- **Allowlist/deny principles:** every command runs through `lib/tools.mjs` which
  enforces (a) a fixed allowlist of command prefixes; (b) an explicit deny-list of any
  `push|merge|rebase|tag|fetch|clone|remote|checkout|commit|cherry-pick|reset|clean`
  mutation forms; (c) a timeout per tool; (d) stdout/stderr captured to bounded buffers.
- **Output capture:** tool stdout/stderr are returned into `job.result` and validated
  by `forbiddenKeys` (no secrets/paths leak). No tool output is written to disk by the
  worker.
- **Filesystem boundaries:** the worker's only writable location is its own `.env` read
  (none at runtime) and in-memory buffers. It does not create/modify repo files in V1.
- **Secret/environment isolation:** the Engineering agent identity has NO service_role,
  NO Meta/Vercel/DNS/billing/deployment credentials, and NO gh token. Tool subprocesses
  inherit a scrubbed environment (no `SUPABASE_*`, `META_*`, `GH_*`, `VERCEL_*`).
- **Artifact/result behavior:** results are jsonb in `job.result`; no files written.
- **Patch-writing:** explicitly a LATER permission increase. V1 is read/analyze/test
  only; there is no `write_file`/`patch`/`commit` tool in V1.

---

## 9. Ollama / model layer

- A single model-agnostic adapter (`lib/ollama.mjs`): `ollamaChat({ model, prompt,
  images?, timeoutMs })` → POST `{OLLAMA_BASE_URL}/api/chat` with `format:"json"`,
  `stream:false`, `think:false`, `options:{temperature, num_ctx}`. Returns parsed text;
  JSON coercion via `cleanJsonText`.
- **Agents are roles, not models.** `model` is a per-spec field. Inbox, Growth, and
  Engineering may each select a different installed Ollama model without coupling
  STREHË to any single model.
- **Loopback-only:** `ensureLocalOllamaUrl` (ported) hard-rejects any host other than
  `127.0.0.1`/`localhost`/`::1`. Public AI endpoints remain unreachable.

---

## 10. Security boundaries (enforceable controls, not prompt-only rules)

- **DB capability checks:** the existing `claim_agent_job` already rejects claims where
  `agent_has_capability(required_capability)` is false, and the eligible-jobs SELECT
  policy scopes visible jobs to the agent's capabilities. The worker adds no privilege.
- **Separate credentials:** one identity per agent; no shared principal; no runtime
  service_role.
- **Tool gateway:** Engineering tools only through `lib/tools.mjs` allowlist + deny-list
  + timeout + env scrubbing.
- **Filesystem/worktree isolation:** dedicated clone; production-worktree path is a
  hard-fail guard.
- **No dangerous secrets:** the worker never receives service_role, Meta, Vercel, DNS,
  billing, or deployment credentials. Provisioning writes only anon key + agent password
  to a gitignored local `.env`.
- **No public Ollama endpoint:** loopback enforcement in code, not config.
- **Prompt-injection:** `payload`/context are treated as untrusted data; they are
  interpolated into prompts only within delimited "data" blocks, and output is validated
  against a strict schema (`outputValidator` + `forbiddenKeys`). No payload field may
  instruct the agent to call tools or change its role (the tool list is fixed in the
  spec, not influenced by prompts).
- **Output/privacy validation:** every result passes `forbiddenKeys`
  (`storage_path`, `signed_url`, `image_bytes`, `base64`, `source_photo_id`) and a
  privacy block (`external_ai_used:false`, `local_processing:true`) before completion.

---

## 11. Approval model

The existing `review_agent_job` is **post-hoc**: `complete_agent_job` returns
`awaiting_review` AFTER work is done. V1 does not misrepresent it as a pre-action gate.

For Inbox V1 the correct flow is:

```
agent produces draft/recommendation (job.result)
        → complete_agent_job → status 'awaiting_review'
        → human operator reviews the draft
        → human invokes the EXISTING human-authorized send path (sendReply)
        → side effect occurs
```

The agent is never the party that sends. The review RPC records the human decision over
the completed result; the actual customer-facing side effect always originates from the
operator session.

---

## 12. Observability

Minimum per-run record (in `job.result.runtime` and/or structured logs):

- `agent` (agent_key), `capability`, `job_id`, `run_id` (if obtainable — note:
  `claim_agent_job` does not return the `agent_runs` id today; log `job_id` and derive
  the run via the agent's own `agent_runs` SELECT, or defer run-id correlation).
- `model`, `duration_ms`, `attempts` (validation/retry count), `tool_calls`
  (count + command class, never full output), `status` (completed/failed),
  `error_class` (a bounded taxonomy, e.g. `claim`, `input`, `ollama`, `validation`,
  `tool`, `complete`).
- `agent_runs.error_code`/`error_message` capture failure reason (≤120/≤4000 chars).

Retention rule: do NOT persist customer message text, PII, or full tool output beyond
what is required for review; keep logs generic-class only.

---

## 13. Agent-to-agent future compatibility

V1 does NOT implement agent meetings/councils. The architecture must not block future:

- **Agent-created/delegated jobs** — a job is just a row; nothing prevents an agent
  (with a future enqueue capability) from inserting a follow-up `agent_jobs` row.
- **Parent/child jobs** — `agent_jobs` has `subject_type`/`subject_id`; add a
  convention (e.g. `subject_type='agent_job'`, `subject_id=parent_id`) without schema
  change.
- **Structured inter-agent results** — results are validated jsonb; a future convention
  (a shared `schema_version` + `agent` + `kind` envelope) keeps them machine-readable.
- **Multi-round Agent Council** — a future orchestrator can enqueue N jobs and read N
  results; V1's spec contract and validation keep results structured enough for that.

All explicitly future scope; no Council code or schema is added in V1.

---

## 14. Implementation phases (safest order)

1. **Shared runtime core** — `worker.mjs` + `lib/*` (env, supabase auth, claim loop +
   lease renewal, ollama, json, validate, logging). No agent logic.
2. **Provision + prove mechanics with a synthetic/Engineering test agent** —
   `provision-agent.mjs` creates one identity; a `verify-agent-flow.mjs` enqueues a
   synthetic job, runs the worker `--once`, asserts claim → complete → `awaiting_review`
   with a valid result and no forbidden keys. This proves auth, claiming, lease, ollama,
   validation, complete/fail end-to-end before any production data is touched.
3. **Engineering Agent** — first real spec (read/analyze/test tools); safest because it
   is local-only, touches no customer data, and exercises the tool gateway + worktree
   isolation.
4. **Inbox Agent integration** — inbox spec + the enqueue helper (bundle conversation
   context into payload) + surface the draft in the operator inbox view.
5. **Approval UI integration** — wire the operator inbox conversation page to show the
   agent draft and pre-fill `sendReply` (human-authorized send unchanged).
6. **Growth Agent** — activate after the social-media reporting layer exists.

Rationale: each phase de-risks the next; the synthetic test agent validates the entire
DB/RPC contract before any agent touches real data or local tools.

---

## 15. Files expected (production branch, future)

```
scripts/gmk-agent-worker/
  worker.mjs
  lib/env.mjs
  lib/supabase.mjs
  lib/ollama.mjs
  lib/json.mjs
  lib/validate.mjs
  lib/claim-loop.mjs
  lib/tools.mjs
  lib/logging.mjs
  agents/inbox.spec.mjs
  agents/growth.spec.mjs
  agents/engineering.spec.mjs
  provision-agent.mjs
  verify-agent-flow.mjs
docs/architecture/GMK-AGENT-WORKER-V1-SPEC.md   (this file)
```

Per-agent local env (gitignored, operator-created): `.env.gmk-inbox.local`,
`.env.gmk-growth.local`, `.env.gmk-engineering.local`.

No migrations, no app-code changes are required by V1 itself. Future app-side touch
points (only when phase 4–5 begin): an Inbox enqueue helper (bundles context into
payload) and a draft panel in `app/operator/inbox/[id]/page.tsx`.

---

## 16. Acceptance criteria (PASS/FAIL)

- **Worker authentication** — PASS: worker signs in with agent email/password and
  `claim_agent_job` succeeds with `auth.uid()` = that agent. FAIL: service_role/anon
  key alone can claim (must throw "Active agent identity required").
- **Capability isolation** — PASS: an agent with capability X cannot see or claim jobs
  requiring capability Y; `claim_agent_job` rejects on capability mismatch.
- **Job claiming** — PASS: two concurrent workers racing the same job → exactly one
  claims, the other skips without failing it.
- **Lease renewal** — PASS: a job running longer than its lease does not get reclaimed
  while the worker renews; a crashed worker's lease lapses and the job is reclaimable.
- **Local Ollama use** — PASS: result `runtime.local_model` set, `external_ai_used:false`,
  Ollama host forced to loopback.
- **Inbox draft generation** — PASS: given a context payload, the job completes to
  `awaiting_review` with a validated `classification` + `suggested_reply`; FAIL if any
  outbound send is attempted.
- **No unauthorized side effects** — PASS: no `sendMetaMessage`, no Meta tokens in the
  agent env, no tool can publish/spend/deploy.
- **Engineering worktree isolation** — PASS: tool commands run only inside the dedicated
  clone; production worktree path triggers a hard-fail; no `push/merge/rebase/tag/commit`
  command executes.
- **Crash/restart recovery** — PASS: kill -9 mid-job → after lease expiry the job is
  reclaimable and not double-completed; `--once`/SIGTERM exits cleanly between jobs.
- **Auditability** — PASS: every run records agent/job/model/duration/attempts/
  error_class in `job.result.runtime` and logs, with no customer content retained.

---

## 17. Explicit deferred scope

- Autonomous customer sending (always human-authorized).
- Autonomous deployment (never in V1).
- Finance Agent (separate legacy project; out of scope).
- Inspection/Photo-Comparison Agent (legacy reference only).
- Full Agent Council / strategy meetings.
- Autonomous spending / publishing (Growth is recommend-only).
- Cloud LLM fallback (unless separately approved).
- Engineering patch-writing (a later, explicit permission increase).

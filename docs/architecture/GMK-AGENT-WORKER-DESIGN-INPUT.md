# GMK Agent Worker — Design Input

- **Type:** Design-input note (read-only inspection product; no implementation)
- **Date:** 2026-08-20
- **Predecessor:** `docs/architecture/STREHE-AGENTIC-ARCHITECTURE-AUDIT.md` (full inventory)
- **Authoritative downstream SPEC:** `docs/architecture/GMK-AGENT-WORKER-V1-SPEC.md`
  (this note is design INPUT only; the SPEC is the implementation contract).
- **Source of truth:** `supabase/migrations/20260611120000_add_household_and_agent_foundations.sql`
  and `supabase/migrations/20260612110000_harden_agent_identity_boundary.sql`

Purpose: consolidate the dormant STREHË agent framework contract into the facts and
open decisions needed to design a local, outbound-only GMK Agent Worker.

---

## Contract (as-is)

**Tables** — `agent_principals` (id = `auth.users.id`, `agent_key`, `is_active`,
`last_seen_at`), `agent_capabilities` (`agent_id`, `capability_key`, `constraints jsonb`,
unique on agent+key), `agent_jobs` (`job_type`, `required_capability`, `workspace_type`
household|business|inspection|system, `subject_type`/`subject_id`, `status`
queued|running|awaiting_review|completed|failed|cancelled|expired, `priority`,
`payload`/`result jsonb` ≤1 MB, `requires_review`, `available_at`, `claimed_at`,
`lease_expires_at`, `processed_at`, `completed_at`, `review_decision`/`reviewed_by`/
`reviewed_at`/`review_notes`, `expires_at` 14-day, `attempt_count`, `max_attempts`),
`agent_runs` (`job_id`, `agent_id`, `status`, `error_code`, `error_message`, `metrics`),
`agent_artifacts` (`storage_path` forced to agent-uid prefix, bucket `agent-artifacts`).

**RPCs** (all SECURITY DEFINER, GRANT to `authenticated`, gate on `auth.uid()`):
- `heartbeat_agent()` → timestamptz
- `claim_agent_job(uuid, lease_seconds int DEFAULT 300)` → agent_jobs
- `renew_agent_job_lease(uuid, int DEFAULT 300)` → timestamptz
- `complete_agent_job(uuid, jsonb)` → agent_jobs
- `fail_agent_job(uuid, text, text)` → agent_jobs
- `review_agent_job(uuid, text, text DEFAULT null)` → agent_jobs

**Authentication:** an agent is a Supabase Auth user whose uid has an
`agent_principals` row. RPCs resolve the caller via `auth.uid()`. Only a user-scoped
JWT works — service_role/anon keys yield `auth.uid() = NULL` and every RPC throws
"Active agent identity required". `agent_key` is a label only, never used in auth.
Trigger enforces agent ↔ human identity exclusivity.

**Capabilities:** attached by admin (RLS); checked via `agent_has_capability(text)` in
both `claim_agent_job` and the "eligible jobs" SELECT policy — capability is the
routing key that determines which jobs a worker can see and claim.

---

## Verdict for a local outbound-only worker

**No schema change required.** `workspace_type='system'` needs no household scope;
`job_type`/`required_capability` are free validated strings (e.g.
`outbound.message` + `outbound.send`). The loop is: SELECT eligible → claim by id →
perform send in worker code → complete/fail. The send itself is worker-local (Meta
Graph API, per existing `lib/messaging/send/*`). Only provisioning (agent user +
principal + capability row) and worker code are needed.

---

## Open decisions (resolve before design)

1. **Claim model.** `claim_agent_job` is by-id only; no "claim next" primitive. Decide:
   by-id claim with retry on the "not claimable" exception, or add a claim-next RPC
   (schema change).
2. **Auth & provisioning.** Workers need a user-scoped JWT for a uid with a principal
   row. A proven pattern exists on the unmerged branch (see Reconciliation below):
   service_role creates an `auth.users` identity → delete the auto-created `app_users`
   row → upsert `agent_principals` + `agent_capabilities` → write credentials to a
   local `.env`; the worker signs in with `signInWithPassword`. Remaining decision:
   reuse that pattern/branch or re-implement on the production line.
3. **Review timing.** `complete_agent_job` sets `awaiting_review` *after* work is done;
   `review_agent_job` reviews a completed result, not a pending action. If outbound
   messages need human pre-approval, the current gate does not block the send — a
   draft→approve→send split (two job types / status convention) must be specified.
4. **Lease vs. duration.** Default 300 s, max 3600 s; must complete or renew in-lease.
   No background sweeper re-queues a 'running' job with an expired lease unless another
   claim occurs — stuck jobs can linger.
5. **Enqueue side.** Admin holds "all" on `agent_jobs`; household editors can insert
   only `workspace_type='household'`. For system/business outbound jobs there is no
   non-admin enqueue path — relevant if app code must submit work.
6. **Limits.** `payload`/`result` 1 MB; `error_code` ≤120, `error_message` ≤4000;
   artifacts inserted directly under RLS with agent-uid path prefix, no RPC wrapper.

---

## Reconciliation — agent login/runtime (2026-08-20)

A follow-up inspection of git history found the dormant framework is partially
exercised on an **unmerged branch**, not production.

- **Branch:** `codex/household-agent-foundations` (mirrored on
  `qwen-inspection-lab-drafts`, the `strehe-app` worktree). NOT merged into
  `release/strehe-meta-gateway-production`; do not treat as production functionality.
- **Production reference:** exactly one production file references `agent_principals` —
  `app/operator/inbox/[id]/page.tsx` (filters agent principals out of inbox-assignment
  candidates). Zero production code calls the agent RPCs.
- **Provisioning pattern (proven):** service_role creates an `auth.users` identity with
  `user_metadata { identity_type: "agent", agent_key }` → deletes the auto-created
  `app_users` row (agents must not be app users) → upserts `agent_principals` +
  `agent_capabilities` → writes `SUPABASE_AGENT_EMAIL`/`SUPABASE_AGENT_PASSWORD` to a
  local `.env`.
- **Worker auth (proven):** `signInWithPassword` (agent email + password) → user-scoped
  JWT → `claim_agent_job` / `complete_agent_job` / `fail_agent_job`.
- **Existing local worker:** `scripts/local-inspection-agent.mjs` — a local Ollama
  worker (`qwen3.5:2b`, `public_ai_apis: false`) polling the claim RPC. Reusable
  template for the GMK worker.
- **Identities found:** `agent_photo-comp@streheprona.com` (`inspection.local`,
  `inspection.photo.compare`); `agent.finance@streheprona.com` (`finance.local`,
  `finance.receipt.ingest`, `finance.report.generate`, `finance.plan.propose`).
- **Spacemail/aliases:** external infrastructure; no `spacemail` reference in the repo.
- **Open decision (new):** branch/merge strategy — reuse
  `codex/household-agent-foundations` (and merge it) vs. re-implement the
  provisioning/worker pattern fresh on the production line. Unresolved.

---

## Non-goals

No schema/migration, code, config, or DB changes. Documentation-only design input.

# STREHË — Agentic Architecture Audit

- **Type:** Read-only architecture audit (no code, migration, config, or DB changes)
- **Date:** 2026-08-20
- **Scope:** `D:\Personal\Projects\Strehe-Prona\strehe-app-launch-meta-gateway-release`
  (branch `release/strehe-meta-gateway-production`)
- **Method:** Filesystem + migration inspection only. No production queries, no writes.

---

## Purpose

Inventory everything in the current STREHË codebase that is AI-, agent-,
automation-, orchestration-, queue-, approval-, or task-runtime-related, so that
a future STREHË Agent Runtime can be scoped against what already exists.

This document records findings only. **It does not design or implement anything.**

---

## 1. What already exists

### 1.1 Agent framework — fully specified, currently DORMANT (DB/runtime foundations only)

A complete review-gated job-queue substrate with agent identity, capability gating,
lease-based claiming, retries, and human approval. Every function is implemented in
SQL. **No application code calls any of it** — a repository-wide search for the RPC
names (`claim_agent_job`, `heartbeat_agent`, `complete_agent_job`, `review_agent_job`,
`fail_agent_job`, `agent_jobs`, etc.) across `.ts`/`.tsx`/`.mjs` returns zero hits.

**Tables**
- `agent_principals` — one row per agent identity (`id` = `auth.users.id`), `agent_key`,
  `display_name`, `is_active`, `last_seen_at`.
- `agent_capabilities` — `(agent_id, capability_key)` + `constraints jsonb`.
- `agent_jobs` — the job record: `job_type`, `required_capability`, `workspace_type`
  (`household|business|inspection|system`), `subject_type`/`subject_id`, `status`
  (`queued|running|awaiting_review|completed|failed|cancelled|expired`), `priority`,
  `payload`/`result jsonb` (1 MB cap), `requires_review`, `review_decision`
  (`approved|rejected`), `reviewed_by/at`, `lease_expires_at`, `claimed_at`,
  `attempt_count`, `max_attempts`, `available_at`, `expires_at` (14-day default).
- `agent_runs` — one row per claim/attempt (`status`, `error_code`, `error_message`,
  `metrics jsonb`).
- `agent_artifacts` — `storage_bucket 'agent-artifacts'`, `storage_path`, `artifact_kind`
  (`input|output|preview|log`), `byte_size`, `expires_at`.

**RPCs (SECURITY DEFINER, all granted to `authenticated`)**
- `heartbeat_agent()`
- `claim_agent_job(uuid, integer)` — capability-checked, lease 30–3600 s, marks prior
  lease-expired run as failed.
- `renew_agent_job_lease(uuid, integer)`
- `complete_agent_job(uuid, jsonb)` — → `awaiting_review` (if `requires_review`) else `completed`.
- `fail_agent_job(uuid, text, text)`
- `review_agent_job(uuid, text, text)` — human approve/reject of `awaiting_review` jobs.
- `is_active_agent()`, `agent_has_capability(text)`, `can_read_agent_job(uuid)`,
  `is_agent_assigned_to_job(uuid)`, `can_read_agent_artifact(text)`.

**Storage** — `agent-artifacts` bucket (private, RLS-gated, 15 MB/file, image/pdf/json/text).

**Identity boundary** — `enforce_separate_human_agent_identity()` trigger makes
`agent_principals` and `app_users` mutually exclusive: a principal cannot also be a
human app user and vice-versa. `is_active_app_user()`, `is_active_business_user()`,
`is_app_admin()` all explicitly exclude rows present in `agent_principals`.

**Migrations**
- `supabase/migrations/20260611120000_add_household_and_agent_foundations.sql`
- `supabase/migrations/20260612110000_harden_agent_identity_boundary.sql`

### 1.2 Messaging ingestion — LIVE event-driven pipeline

- **Webhook entry:** `app/api/meta/webhook/route.ts` (`GET` verify_token handshake;
  `POST` ingest).
- **Handlers:** `lib/meta/create-handlers.ts`, `lib/meta/persist.ts`, `lib/meta/schema.ts`.
- **Verification:** `lib/meta/verify.ts` — HMAC-SHA256, timing-safe, union of
  `META_APP_SECRET` + `META_INSTAGRAM_APP_SECRET`, fail-closed, 1 MB body cap.
- **Raw journal:** `meta_webhook_events` (service_role INSERT-only, no SELECT).
- **Enqueue:** `meta_webhook_events_enqueue_trigger` → `meta_ingestion_queue`.
- **Worker orchestrator:** `lib/messaging/ingest.ts` (`runMetaIngest`), pure helpers in
  `lib/messaging/parser.ts`, `normalize.ts`, `resolution.ts`, `notify.ts`, `types.ts`.
- **Cron drain entry:** `app/api/cron/meta-ingest/route.ts`,
  `lib/server/meta-ingest-handler.ts` (Bearer `CRON_SECRET`).

**Tables**
- `meta_ingestion_queue` — `status pending|processing|completed|failed`, `outcome`,
  `attempt_count`, `available_at`, `claimed_at`, `lease_expires_at`, `last_error_class`,
  `last_error_step`.
- `contact_channel_identities` — `(channel, channel_account_id, external_id)` unique,
  `lead_id`/`client_id`, `resolution_status unresolved|resolved|needs_review`.
- `conversations` — `status open|resolved|archived`, `attention_state
  needs_reply|waiting_customer|none`, `assigned_user_id`, `unread_count`.
- `conversation_messages` — dedup key `(channel, channel_account_id, external_message_id)`,
  `direction inbound|outbound`, `message_type`, `text_content`, `content jsonb`.

**RPCs (SECURITY DEFINER)**
- `claim_meta_ingestion_batch(integer)` — `FOR UPDATE SKIP LOCKED`, 5-min lease, ≤100 rows.
- `meta_ingestion_mark_completed`, `meta_ingestion_mark_failure` (exponential backoff
  `30s·2^attempt` capped 15 min; dead-letter on 5th failure).
- `upsert_contact_channel_identity`, `resolve_contact_identity_whatsapp` (deterministic
  phone match; ambiguous → `needs_review`; never fabricates a lead),
  `ensure_conversation`, `ingest_conversation_message` (idempotent `ON CONFLICT`).
- `can_manage_messaging()` — admin/office, **excluding agent principals**.

**Migrations**
- `20260816180000_create_messaging_ingestion_tables.sql`
- `20260816180100_create_messaging_ingestion_processing.sql`
- `20260816190000_remediate_messaging_privileges.sql`
- `20260817100000_operator_conversation_actions.sql`
- `20260817110000_identity_assignment_actions.sql`
- `20260817120000_settle_outbound_message.sql`

### 1.3 Operator Inbox (human)

- **UI:** `app/operator/inbox/page.tsx`, `app/operator/inbox/[id]/page.tsx`.
- **Actions:** `lib/actions/inbox.ts` — `setConversationState` (mark_read, needs_reply,
  waiting_customer, clear_attention, resolve, reopen), `setIdentityResolution`
  (link_lead, link_client, unlink, needs_review), `setConversationAssignment`,
  `searchLeads`, `searchClients`, `sendReply`.
- **RPCs:** `operator_set_conversation_state`, `operator_set_identity_resolution`,
  `operator_set_conversation_assignment`, `settle_outbound_message`.
- Outbound is strictly human-authored; no auto-responder exists.

### 1.4 Inbox notification queue (best-effort email alert worker)

- **Table:** `inbox_notification_queue` (`pending|processing|sent|failed`).
- **RPCs:** `enqueue_inbox_notification` (per-conversation 5-min throttle via advisory
  lock), `claim_inbox_notification_batch`, `inbox_notification_mark_sent`,
  `inbox_notification_mark_failure`.
- **Worker:** `lib/messaging/notify.ts` (`drainInboxNotifications`),
  `lib/email/inbox-notification-email.ts`.
- **Migrations:** `20260818160000_inbox_notification_queue.sql`,
  `20260818170000_fix_inbox_notification_claim.sql`.

### 1.5 Cron infrastructure

- **Vercel cron:** `vercel.json` → `/api/cron/generate-tasks` on `0 8 * * 0` (Sun 08:00).
- **Task generator:** `lib/actions/task-generator.ts` — **deterministic**
  subscription→task due-date calculation; not AI.
- **meta-ingest cron:** route ready; scheduled via Supabase `pg_cron` + `net.http_post`
  fallback (see `docs/operations/messaging-ingestion-v1-rollout.md`). Manual activation
  (Vault secret + `cron.schedule`), no Vercel entry in `vercel.json`.

### 1.6 AI / model integration (the ONLY one in the codebase)

- **Engine:** `lib/inspection-lab/bathroom-base-shot-engine.mjs` — raw `fetch` to
  `https://api.openai.com/v1/responses` (no SDK). Models: `gpt-4.1-mini` (default),
  `gpt-4.1` (baseline), overridable via `OPENAI_INSPECTION_MODEL` /
  `OPENAI_INSPECTION_BASELINE_MODEL`; key `OPENAI_API_KEY`.
- **Wrapper / runner:** `lib/inspection-lab/bathroom-base-shot-engine-wrapper.ts`,
  `lib/inspection-lab/bathroom-base-shot-runner.ts`.
- **Caller:** `app/inspection-lab/bathroom-base-shot/actions.ts`
  (`seedBaselineTrackedObjects` — vision object detection on inspection photos).
- **CLI:** `scripts/run-bathroom-base-shot-engine.mjs`.
- No `openai`/`@anthropic-ai`/`langchain`/`ai` npm packages; no prompt templates, no
  tool-calling harness, no provider abstraction.

### 1.7 Audit / logging infrastructure

- `lead_events` — audit log (`event_type` enum, `summary`, `metadata jsonb`).
- `lead_interactions` — human-authored summaries (not a raw message store).
- `keys` / `key_logs` — `lib/key-log.ts`, `lib/key-status.ts`.
- Inspection AI trail — `inspection_lab_case_photos.seed_model`, `seed_debug_result`,
  `seeded_candidate_count`.
- Queue error taxonomy — `last_error_class` / `last_error_step` / `error_class` store
  generic classes only (never message text, PII, phone numbers, or external IDs).

### 1.8 RBAC / roles

- Roles: `admin|office|field|contractor|household` (`app_users.role`).
- `lib/auth/*` — `require-role`, `get-current-user`, `roles`, `require-workers-access`.

---

## 2. How it currently works

**Agent framework (latent):** An agent is an `auth.users` identity with a row in
`agent_principals` (mutually exclusive with `app_users`). Jobs are enqueued with a
`required_capability`. An agent with that capability claims a job (`claim_agent_job`),
processes it, and either completes it (`complete_agent_job` → `awaiting_review` or
`completed`) or fails it (`fail_agent_job`). A human reviews (`review_agent_job`).
Expired leases are reclaimed; attempts are capped; jobs expire after 14 days. **No
code path invokes these functions today.**

**Messaging ingestion (live):** Meta POSTs to `/api/meta/webhook`; the payload is
HMAC-verified (fail-closed), persisted to `meta_webhook_events`, and a trigger enqueues
`meta_ingestion_queue`. `runMetaIngest` (cron, plus a best-effort `after()` on POST)
claims a batch, normalizes, resolves identity (deterministic phone match, ambiguous →
`needs_review`), idempotently inserts messages, flips the conversation to `needs_reply`
and increments `unread_count`, and enqueues a throttled email notification.

---

## 3. Reusable for a STREHË Agent Runtime

- **`agent_jobs` + claim/lease/complete/fail/review RPCs** — a ready, security-hardened,
  review-gated job queue. The single biggest reuse asset.
- **`agent_principals` + `agent_capabilities`** — agent identity and capability-gated
  access, with `workspace_type` already spanning system/business/household/inspection.
- **Claim-batch queue pattern** (`FOR UPDATE SKIP LOCKED` + lease + exponential backoff +
  dead-letter) — proven twice (`meta_ingestion_queue`, `inbox_notification_queue`); copy
  it for any new agent work queue.
- **webhook → journal → queue → worker → normalized store** — template for event-driven
  agents (e.g. an Inbox agent consuming new inbound `conversation_messages`).
- **`resolve_contact_identity_whatsapp` + `resolution_status needs_review`** — an existing
  deterministic route-to-human gate.
- **`can_manage_messaging()` / `is_active_*()`** — already exclude agent principals; the
  security model anticipates agents as separate identities.
- **`bathroom-base-shot-engine.mjs`** — the established pattern for calling a hosted LLM
  with no SDK.
- **`lead_events` + queue error taxonomy + `seed_debug_result`** — audit substrate for
  agent runs.
- **`conversations.attention_state` / `unread_count` / `assigned_user_id`** — the Inbox
  agent's workspace is already modeled.

---

## 4. Genuinely missing

- **No agent runtime/loop** — nothing claims `agent_jobs`, calls an LLM, or
  completes/reviews jobs. Schema + RPCs only.
- **No LLM SDK / prompt management / tool-calling harness / provider abstraction.**
  The only AI call is one hand-rolled OpenAI vision fetch.
- **No Inbox auto-responder or reply-drafting agent** — messaging is human-only
  (`sendReply`).
- **No Growth agent runtime** — no campaign/audience/content automation in this repo
  (the social-assets repo holds prompts but no execution runtime).
- **No Engineering agent runtime** — no in-app code-gen/review; the Codex flow is
  external/offline via git.
- **No approval UI/endpoint** — `review_agent_job` exists but nothing exposes it.
- **No agent worker scheduler** — no cron polls `agent_jobs`.
- **No MCP/tool gateway, RAG/vector store, LLM cost/rate-limit/usage tracking, prompt
  versioning, or queue observability UI** (diagnostics are SQL-only).

---

## 5. Future agent targets (recorded, not designed)

The following are the proposed first three agents for the STREHË Agent Runtime. They are
recorded here as direction only — **no design or implementation has begun.**

1. **Inbox Agent** — consumes inbound `conversation_messages` / `attention_state`,
   drafts or sends replies subject to the existing review/approval gate and identity
   resolution.
2. **Growth Agent** — campaign, audience, and content generation/execution against the
   CRM (`leads`, `lead_events`, attribution) and marketing surfaces.
3. **Engineering Agent** — code/review/ops automation aligned with the existing
   governance flow (SPEC → implement → REVIEW → PREFLIGHT → RELEASE).

---

## 6. Non-goals of this audit

- No new design, no implementation, no schema/migration changes.
- No production code, config, or database modifications.
- Documentation-only artifact.

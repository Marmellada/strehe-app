# Engineering Agent proactive checker and Agents UI

## Runtime contract

- Job type: `engineering.proactive`
- Capability: `engineering.local`
- Workspace: `system`
- Default cadence: 240 minutes while the daemon is available
- One queued/running proactive job maximum
- One module per job, at most eight files and 56 KiB of source prompt material
- Local Ollama loopback only; no public AI endpoint
- Read/analyze/test/recommend only; every result requires human review

SQLite under `STREHE-ENGINEERING-RUNTIME/state/engineering.sqlite3` remains the source
of truth for modules, validations, findings, sessions, and scheduling continuity. The
Supabase `agent_operator_controls.status_snapshot` value is a redacted projection for
the authenticated UI.

## Operator controls

- **Run proactive check now** sets a one-shot manual module investigation request. It
  is distinct from an `engineering.review` change-aware repository review. The local Coordinator
  still chooses exactly one target and creates the bounded job after higher-priority
  work clears.
- **Enable/disable proactive checking** affects cadence work. A manual review request is
  still allowed while cadence work is disabled.
- **Pause/resume** prevents or permits new claims. An already leased job is allowed to
  finish so state is not corrupted.

Only an active `admin` can invoke controls. Active `admin` and `office` users can view
the page. Agent principals and public users cannot use operator RPCs.

If the control table/RPC is temporarily unavailable, the worker logs one bounded
`engineering_control_unavailable` event, treats proactive checking as disabled and
pause as false, and continues claiming existing baseline/change-aware work. Repeated
analysis failures are persisted in local SQLite and cool that module down for 12 hours;
a later successful finding/no-finding result clears the failure state. Finding history
is retained with `OPEN`, `ACKNOWLEDGED`, `DEFERRED`, and `RESOLVED` lifecycle states.

## Deployment order (do not run without approval)

1. Back up the production Supabase database and record the current app/worker commit.
2. Apply `supabase/migrations/20260821120000_engineering_proactive_operator_controls.sql`
   through the normal reviewed migration pipeline.
3. Verify the new table, partial unique index, RLS policies, and six narrow RPCs.
4. Deploy the application containing `/operator/agents` through the normal Vercel
   release workflow.
5. Update the protected Engineering Agent worktree to the same approved commit.
6. Restart the existing self-healing Engineering Agent task (do not create a second
   daemon instance).
7. Confirm a fresh heartbeat, local model name, module snapshot, and next eligibility
   on `/operator/agents`.
8. As admin, request one proactive check; confirm one `engineering.proactive` job, normal
   claim/lease/awaiting-review lifecycle, and no production changes.
9. Confirm an office account can view but cannot render/invoke controls, and a non-
   operator account is redirected by existing RBAC.

Rollback is application-first: pause the agent, roll back the app/worker release, then
leave the additive table/RPC migration in place until a separately reviewed cleanup
migration is approved. Do not drop control state during an incident.

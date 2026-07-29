# Backup and Recovery Checklist

Current production-execution status: **BLOCKED**

## Directly verified evidence

Read-only Supabase backup inspection on 2026-07-29 returned:

- `pitr_enabled: false`
- `backups: null`
- `walg_enabled: true`
- project status: `ACTIVE_HEALTHY`

This does not prove that a usable physical backup exists. PITR is not available.
Project plan, retention, last successful backup time, restore entitlement, and
restore duration were not exposed by the evidence.

The repository has no authenticated Vercel binding. Current public routes return
HTTP 200 from Vercel and unauthorized cron POST returns 401, but deployment
promotion/rollback access is not proven. The last documented healthy deployment
is production commit `a308b63a5fad0521057b42ecd763dff22c00e716`
from 2026-07-22.

## Founder/operator evidence required

Complete every item and attach screenshots or exported metadata without secrets.

- [ ] Open the correct Supabase production project and record project name/ref.
- [ ] Record plan and backup entitlement.
- [ ] Record latest successful physical backup timestamp and retention.
- [ ] Confirm the backup completed within 24 hours of migration.
- [ ] Confirm restore controls are enabled for an authorized operator.
- [ ] Record whether restore is in-place or to a new project.
- [ ] Record expected recovery time and any support dependency.
- [ ] Confirm PITR is disabled, or attach new evidence if its status changed.
- [ ] Name the Founder-approved person authorized to initiate recovery.
- [ ] Perform or reference a recent restore drill; if none exists, mark it.
- [ ] If no verified recoverable platform backup exists, separately authorize an
      encrypted logical backup immediately before migration.
- [ ] For a logical backup, record scope, timestamp, hash, encrypted location,
      retention, and a tested restore command. Do not store it in Git.
- [ ] Open the correct Vercel project and record project, team, production
      branch, latest production deployment ID, source commit, and status.
- [ ] Confirm an authorized operator can promote the last healthy deployment.
- [ ] Record the last healthy deployment ID and commit.
- [ ] Confirm runtime environment variables can be restored without exposing
      their values.

## Recovery procedure

### Database

1. Stop application writes or enable maintenance handling.
2. Preserve error, migration-history, lock, and schema evidence.
3. Do not run migration repair or manually edit migration history.
4. Prefer a reviewed forward migration when the database is internally
   consistent and data is intact.
5. If data or schema integrity cannot be recovered forward, the authorized
   Supabase project administrator initiates restoration from the verified
   physical backup.
6. If platform restore is unavailable, use the separately authorized logical
   backup, preferably restoring into an isolated recovery project first.
7. Validate migration history, row counts, RLS, grants, identities, and
   application connectivity before reopening writes.

### Application

1. Do not roll back the database merely because a Vercel deployment fails.
2. Promote the recorded last healthy production deployment.
3. Confirm the production domains and login route serve the expected deployment.
4. Keep newly added database objects in place; the prior application does not
   depend on their absence.

## Go/no-go rule

No production migration may begin while the checklist lacks a current,
recoverable database backup and a named authorized recovery operator. The
present evidence therefore requires **NO-GO**.

# Backup and Recovery Checklist

Current production-execution status: **FOUNDER RISK DECISION REQUIRED**
Recovery classification:
**RECOVERY PARTIALLY PROVEN — TEMPORARILY ACCEPTED FOR PRE-CLIENT RELEASE CONSIDERATION**

## Directly verified evidence

Read-only Supabase backup inspection on 2026-07-29 returned:

- `pitr_enabled: false`
- `backups: null`
- `walg_enabled: true`
- project status: `ACTIVE_HEALTHY`

This does not prove that a usable physical platform backup exists. PITR is not
available. Separately, the Founder-authorized encrypted logical safeguard
contains complete database exports and all 27 hash-reconciled Storage objects
on BitLocker-protected `D:`. Storage integrity is verified with two documented
source-format defects. The isolated database restore remains incomplete, so
recovery is only partially proven.

Authenticated Vercel evidence now proves the current healthy production
deployment is `dpl_E1YgwMrbRMjaDHPN5MFPXXwxTT4x`, READY at baseline
`a308b63a5fad0521057b42ecd763dff22c00e716`. The authenticated account is a
confirmed team OWNER with logs and rollback/promotion controls. Application
rollback readiness is therefore proven independently of database recovery.

## Founder/operator evidence required

Complete every item and attach screenshots or exported metadata without secrets.

- [x] Open the correct Supabase production project and record project name/ref.
- [ ] Record plan and backup entitlement.
- [ ] Record latest successful physical backup timestamp and retention.
- [ ] Confirm the backup completed within 24 hours of migration.
- [ ] Confirm restore controls are enabled for an authorized operator.
- [ ] Record whether restore is in-place or to a new project.
- [ ] Record expected recovery time and any support dependency.
- [x] Confirm PITR is disabled, or attach new evidence if its status changed.
- [ ] Name the Founder-approved person authorized to initiate recovery.
- [ ] Perform or reference a recent restore drill; if none exists, mark it.
- [ ] If no verified recoverable platform backup exists, separately authorize an
      encrypted logical backup immediately before migration.
- [ ] For a logical backup, record scope, timestamp, hash, encrypted location,
      retention, and a tested restore command. Do not store it in Git.
- [x] Open the correct Vercel project and record project, team, production
      branch, latest production deployment ID, source commit, and status.
- [x] Confirm an authorized operator can promote the last healthy deployment.
- [x] Record the last healthy deployment ID and commit.
- [x] Confirm runtime environment variables can be restored without exposing
      their values.

The bounded encrypted logical backup was executed under STREHE-BACKUP-001.
Do not alter or overwrite its evidence. Its incomplete database restore must be
included in any Founder migration-risk decision.

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

Technical preflight success does not remove the recovery limitation. A later
database migration may be considered only if the Founder explicitly accepts
the partial-restore risk and then separately authorizes migration execution.
Neither decision has been recorded by this read-only work order.

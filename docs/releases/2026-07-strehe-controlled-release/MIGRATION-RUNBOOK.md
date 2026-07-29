# Production Migration Runbook

This runbook is executable only after a new, explicit Founder production
authorization. Nothing in this document authorizes execution.

## 1. Freeze and communicate

1. Announce a release freeze and migration window.
2. Pause merges, deployments, operator CRM edits, and background administrative
   work for the window.
3. Name the migration operator, observer, Founder decision-maker, and recovery
   operator.
4. Open an evidence folder outside Git with UTC timestamps.

## 2. Verify Git state

Require:

- `origin/main` still equals
  `a308b63a5fad0521057b42ecd763dff22c00e716`;
- release candidate equals
  `eb30d0ec0f698bfd3a7c0404b519e67e38718f97`;
- RC is zero commits behind main;
- the exact ten-commit range matches `RELEASE-MANIFEST.md`;
- working tree is clean.

STOP if main or RC differs. Regenerate and re-review the package.

## 3. Verify migration inventory

Run the read-only linked migration comparison:

```powershell
npx --yes supabase@2.109.1 migration list --linked
```

Require exactly these pending versions, in order:

1. `20260728120000`
2. `20260729000000`
3. `20260729001000`

STOP on any additional, missing, or remotely recorded version.

## 4. Confirm backup and recovery

Complete `BACKUP-RECOVERY-CHECKLIST.md`. Require a current recoverable database
backup, named recovery operator, documented restore path, and Vercel rollback
access. STOP if any is unproven.

## 5. Run read-only preflight

1. Confirm production target without printing credentials.
2. Execute `scripts/production-release-preflight.sql` with `psql`.
3. Preserve the JSON output and process exit code.
4. Require `stop_count=0`.
5. Inspect current locks and long-running transactions.

STOP on a nonzero count, query error, unexpected lock, identity overlap, object
collision, policy drift, or migration-history change.

## 6. Decide traffic handling

The altered tables are small, but `ALTER TABLE` and normal index creation can
block writes. Use a low-traffic window. Pause CRM operators. If current database
activity cannot be bounded, use maintenance handling before migration.

## 7. Final authorization checkpoint

The Founder explicitly records GO for database migration only. The application
deployment remains a separate decision after database verification.

## 8. Intended migration command

Only after authorization, from the frozen RC checkout:

```powershell
npx --yes supabase@2.109.1 db push --linked
```

Do not add `--include-all`, do not use migration repair, and do not use
`db reset --linked`. Confirm the prompt lists only the three expected files.
Cancel if it lists anything else.

Expected output applies the three versions in timestamp order and reports
successful completion. A lock wait over 30 seconds, SQL error, connection
change, or unexpected prompt is a STOP.

## 9. Immediate history check

Rerun:

```powershell
npx --yes supabase@2.109.1 migration list --linked
```

Require Local and Remote equality through `20260729001000`. Preserve output.
Never manually mark a version applied.

## 10. Read-only database verification

Run every safe query in `POST-MIGRATION-VERIFICATION.md`. Verify:

- columns, constraints, indexes, sequence;
- functions and trigger definitions;
- singleton capacity state;
- RLS and policies;
- task-attachment restrictive policy;
- CRM grants;
- human/agent identity boundaries.

No synthetic records are permitted at this stage.

## 11. Stop conditions

STOP before application deployment if:

- any migration is missing or unexpected;
- any statement failed or migration history is inconsistent;
- capacity is not exactly `3/0`;
- RLS, policy, function security, or role grants differ;
- anonymous access is effective;
- task attachments are unexpectedly denied or exposed;
- identity overlap exists;
- monitoring shows database errors or sustained lock contention.

Follow `ROLLBACK-AND-FORWARD-REPAIR.md`.

## 12. Evidence capture

Capture UTC timestamp, operator, RC SHA, main SHA, backup evidence, preflight
JSON, migration-list before/after, command output, verification output, lock
observations, and the Founder database decision. Redact all credentials.

## 13. Deployment decision

Only after database verification passes does the Founder decide whether to
authorize the application release. A successful migration does not itself
authorize deployment, public launch, customer onboarding, or paid acquisition.

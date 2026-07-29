# Release Evidence Index

## Authoritative package

- [Release manifest](RELEASE-MANIFEST.md)
- [Pending migrations](PENDING-MIGRATIONS.md)
- [Production preflight](PRODUCTION-PREFLIGHT.md)
- [Backup and recovery checklist](BACKUP-RECOVERY-CHECKLIST.md)
- [Migration runbook](MIGRATION-RUNBOOK.md)
- [Application deployment runbook](APPLICATION-DEPLOYMENT-RUNBOOK.md)
- [Post-migration verification](POST-MIGRATION-VERIFICATION.md)
- [Post-deployment smoke](POST-DEPLOYMENT-SMOKE.md)
- [Rollback and forward repair](ROLLBACK-AND-FORWARD-REPAIR.md)
- [Go/no-go checklist](GO-NO-GO-CHECKLIST.md)
- [Commercial/legal gates](COMMERCIAL-LEGAL-GATES.md)

## Existing authoritative references

- `docs/operations/production-release-baseline.md`
- `docs/operations/migration-replay-and-production-drift-reconciliation.md`
- `docs/operations/founding-customer-funnel-architecture.md`
- `docs/operations/founding-customer-commercial-offer.md`
- `docs/operations/written-offer-lifecycle.md`
- `docs/operations/campaign-attribution-definitions.md`
- `docs/operations/founding-consultation-checklist.md`
- `docs/operations/paid-acquisition-privacy-placeholder.md`
- `docs/operations/phase-1-launch-security.md`

## Read-only evidence gathered 2026-07-29

- `origin/main`:
  `a308b63a5fad0521057b42ecd763dff22c00e716`
- Frozen RC:
  `eb30d0ec0f698bfd3a7c0404b519e67e38718f97`
- Git relation: 0 behind, 10 ahead, no merge commits
- Linked migration comparison: exactly three pending versions
- Linked project: active/healthy
- Supabase backup response: no listed backups; PITR disabled
- Production table estimates: leads 18, campaigns 29, app users 14,
  properties 39
- Public/current checks: English public route 200, contact 200, login 200,
  unauthorized cron POST 401, Vercel response headers present
- Local Vercel binding: absent
- Vercel authenticated project/deployment/firewall evidence: unresolved
- Read-only preflight script: `scripts/production-release-preflight.sql`
- Local-only script validation: machine-readable `STOP`, 23 checks, 9 expected
  stops on the already-migrated isolated database, process exit 3

The preflight script was not executed against production.

## Preserved external evidence

Preservation root:

`D:\Personal\Projects\Strehe-Prona\STREHE-PRESERVATION\STREHE-LAUNCH-003-2026-07-28`

Relevant artifacts include original corrected migrations, remote-only migration
copies, production public/storage schema-only dumps, final local schema dumps,
database-backed funnel JSON, and rendered offer PDF.

Do not copy production data, credentials, or environment values into this
package.

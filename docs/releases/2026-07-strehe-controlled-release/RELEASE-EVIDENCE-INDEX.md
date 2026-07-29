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
- [Authenticated production evidence](PRODUCTION-EVIDENCE-2026-07-29.md)

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
- Authenticated Supabase identity: project `evrravcuhrryiyywofwe`,
  organization `Strehe-Prona`, active/healthy, read-only transaction proven
- Production preflight: exit 0, `has_stops=false`, `stop_count=0`, all 23
  aggregate-only checks PASS
- Hermes-reviewed preflight SHA:
  `dd3e3b501781b722ea229857989d8e31302ce140cb91602a525d4c4f16527e22`
- Management API transport SHA:
  `4a04828763dff46704713d410137a5033772461af55b7aa7c432f41a717f4cf7`
- Vercel: authenticated OWNER; correct GitHub project; production branch
  `main`; baseline deployment READY; RC not deployed
- Production environment names/scopes: inspected without values; effective
  required set present
- Contact rate limit: active/live, POST localized contact paths, 10/IP/60s
- Read-only preflight script: `scripts/production-release-preflight.sql`
- Local-only script validation: machine-readable `STOP`, 23 checks, 9 expected
  stops on the already-migrated isolated database, process exit 3

The repaired reviewed preflight ran against production in a strict read-only
transaction and returned all 23 checks as PASS. An independent linked migration
comparison again found exactly three local-only pending migrations.

## Preserved external evidence

Preservation root:

`D:\Personal\Projects\Strehe-Prona\STREHE-PRESERVATION\STREHE-LAUNCH-003-2026-07-28`

Relevant artifacts include original corrected migrations, remote-only migration
copies, production public/storage schema-only dumps, final local schema dumps,
database-backed funnel JSON, and rendered offer PDF.

Do not copy production data, credentials, or environment values into this
package.

STREHE-RELEASE-004 evidence root:

`D:\Personal\Projects\Strehe-Prona\STREHE-PRESERVATION\STREHE-RELEASE-004-2026-07-29`

The external `EVIDENCE-MANIFEST.json` contains hashes, sizes, sources, purposes,
sensitivity, and commit eligibility.

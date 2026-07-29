# Production Database Migration Result — 2026-07-30

Authority: `STREHE-RELEASE-005`

Result:
**DATABASE MIGRATION PASS — READY FOR FOUNDER APPLICATION GO/NO-GO**

Exactly the three Founder-authorized migrations were applied to the linked
production project and passed immediate read-only verification. The application
was not deployed.

## Starting state and backup

- Branch: `release/strehe-controlled-production-plan`
- Starting HEAD: `f16b8c5027655f14fdc95dc10a202fb78957be3e`
- Worktree: clean
- `origin/main`: `a308b63a5fad0521057b42ecd763dff22c00e716`
- Frozen RC: `eb30d0ec0f698bfd3a7c0404b519e67e38718f97`
- Linked project: `evrravcuhrryiyywofwe`
- Project status: `ACTIVE_HEALTHY`
- Fresh backup:
  `D:\Personal\Projects\Strehe-Prona\STREHE-BACKUPS\pre-migration-retry-2026-07-30_20260729_222219Z`
- Backup result: `FRESH DATABASE BACKUP PASS`
- All 39 backup artifacts and recorded hashes revalidated before migration.

## Immediate preflight

Reviewed source SHA-256:
`dd3e3b501781b722ea229857989d8e31302ce140cb91602a525d4c4f16527e22`.

Previously verified read-only transport SHA-256:
`4a04828763dff46704713d410137a5033772461af55b7aa7c432f41a717f4cf7`.

The immediate production execution returned:

- exit code `0`;
- `transaction_read_only=on`;
- `has_stops=false`;
- `stop_count=0`;
- 23 of 23 checks `PASS`;
- zero blocking table locks;
- zero long-running transactions.

## Final inventory and dry run

Immediately before execution, exactly these versions remained local-only:

1. `20260728120000_add_founding_customer_funnel.sql`
2. `20260729000000_restore_business_identity_task_attachment_policy.sql`
3. `20260729001000_restore_crm_runtime_privileges.sql`

There was no remote-only version. All three migration hashes matched the
approved package. The pinned dry run listed exactly the same three files in
timestamp order and exited `0`.

## Migration execution

CLI: `2.109.1`

Command:

```text
npx --yes supabase@2.109.1 db push --linked
```

- Start: `2026-07-29T22:58:51.5995558Z`
- Finish: `2026-07-29T22:58:56.0590707Z`
- Duration: `4.460` seconds
- Exit code: `0`

Each approved migration emitted an `Applying migration` result. The only
warnings were the known local `[inbucket]` configuration deprecation and notice
that a newer CLI exists. The pinned CLI was not changed.

## Immediate read-only verification

The post-migration verification ran with `transaction_read_only=on` and passed
21 of 21 aggregate and metadata checks.

- Local and Remote histories reconcile across all 40 versions.
- The three approved versions are recorded remotely.
- Lead and campaign additions, consultation and offer tables, capacity table,
  offer sequence, constraints, indexes, functions, and triggers exist.
- The capacity and funnel-authorization functions are security definer with
  fixed search paths; the first-touch function has its approved security mode.
- Consultations, offers, and capacity have RLS enabled.
- Exactly the approved consultation and offer policies exist.
- The access predicate supports active admin/office users and excludes field
  and agent identities.
- Human/agent overlap and incompatible application-role counts are zero.
- The restrictive `Business identities gate task attachments` policy exists
  with its approved `ALL`, authenticated, task-bucket definition.
- All 26 unrelated Storage policy names remain unchanged.
- Authenticated and service-role CRM CRUD grants exist on all six approved
  tables.
- The anonymous grant inventory on those original six CRM tables remains at
  its preflight count of 42; the CRM grant migration added no anonymous grant.
- New funnel tables have Supabase default ACL entries, but effective anonymous
  and field access is denied by enabled RLS and the authenticated-only policies.
- Capacity is exactly one row with `maximum_places=3` and
  `reserved_places=0`.
- Active founding offers reconcile to zero.
- Consultations and offers remain empty; no synthetic or business row was
  created.
- The offer sequence starts at one and remains unused.

## Safety closure

No application deployment, Vercel mutation, Git push, Git merge, remote branch,
synthetic production record, production form submission, manual application
data change, public launch, onboarding, service delivery, or paid acquisition
occurred.

External evidence:

`D:\Personal\Projects\Strehe-Prona\STREHE-PRESERVATION\STREHE-RELEASE-005-2026-07-30`

Hermes should independently rehash the evidence, reconcile the three migration
versions, review all 23 preflight and 21 post-migration checks, verify the
effective RLS/policy interpretation, and confirm no application deployment
occurred.

The Founder decision now possible is:
**APPLICATION GO/NO-GO**. Database migration evidence is PASS, but application
deployment remains unauthorized until that separate decision.

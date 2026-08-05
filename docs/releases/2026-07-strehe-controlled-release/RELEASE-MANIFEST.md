# STREHË Controlled Production Release Manifest

Status: frozen release candidate; production execution not authorized
Prepared: 2026-07-29
Authority: STREHE-RELEASE-003

## Release identity

| Field | Frozen value |
| --- | --- |
| Product | STREHË |
| Purpose | Founding-customer inquiry, consultation, written-offer, conversion, payment-backed funnel, and reporting release |
| Planning branch | `release/strehe-controlled-production-plan` |
| Release-candidate source branch | `fix/local-migration-replay-and-funnel-verification` |
| Release-candidate commit | `eb30d0ec0f698bfd3a7c0404b519e67e38718f97` |
| Production baseline | `a308b63a5fad0521057b42ecd763dff22c00e716` |
| Release baseline | `47b4fa5dca0e7661009b5e7974d7608b4d3917c4` |
| Audited range | `a308b63a5fad0521057b42ecd763dff22c00e716..eb30d0ec0f698bfd3a7c0404b519e67e38718f97` |
| Remote main at freeze | `a308b63a5fad0521057b42ecd763dff22c00e716` |
| Behind/ahead at freeze | 0 behind, 10 ahead |
| History shape | Linear; no merge commits in the audited range |

The release candidate is immutable for this package. Any code or migration
change requires a new candidate SHA, a regenerated manifest, and renewed review.
Planning-document commits are not part of the application release candidate.

## Exact commit inventory

1. `47b4fa5dca0e7661009b5e7974d7608b4d3917c4` — Record STREHË production release baseline
2. `962e4bea0589cc9556a8391cd8ffa7113a71bf7d` — feat: define founding customer funnel model
3. `cf386fb7a85addb9c1f89c38d96c36353605b3e9` — feat: implement funnel consultation offer and reporting workflows
4. `3e11a4388a4b15c2e8817e31c7a1b4b7cf56cf78` — test: cover founding funnel attribution and security
5. `69dc701bbd65473e76222b48c34a69b0ec83ba8a` — fix: enforce founding customer capacity
6. `ad4cf0f95181896959a1239b659ac3b8ddadbf2e` — fix: reconcile historical migration replay
7. `2072213a1f0de58428ec5689892e32d5cc51f5dc` — fix: reconstruct inspection photo migration history
8. `e8bdda07913e67c7ef366f7de07336804a17140f` — fix: enforce founding funnel concurrency
9. `610949fcebcd3dd4a2a74cdc7711f02fcb5617ea` — fix: restore CRM runtime replay behavior
10. `eb30d0ec0f698bfd3a7c0404b519e67e38718f97` — test: verify local launch funnel

## Changed-file inventory

The frozen candidate changes exactly 45 files relative to production baseline.

### Application and runtime source

- `app/leads/LeadForm.tsx`
- `app/leads/[id]/FunnelPanel.tsx`
- `app/leads/[id]/page.tsx`
- `app/leads/offers/[id]/pdf/route.ts`
- `app/leads/page.tsx`
- `app/leads/reports/page.tsx`
- `app/settings/promotions/page.tsx`
- `components/marketing/ContactRequestForm.tsx`
- `lib/actions/funnel.ts`
- `lib/actions/leads.ts`
- `lib/actions/promotions.ts`
- `lib/funnel/attribution.ts`
- `lib/funnel/definitions.ts`
- `lib/funnel/offer-pdf.ts`
- `lib/funnel/paying-customer.ts`
- `lib/funnel/reporting.ts`
- `lib/funnel/transitions.ts`
- `lib/security/public-contact.ts`

### Migrations

- `supabase/migrations/20260402135706_cleanup_property_contacts_and_duplicates.sql`
- `supabase/migrations/20260417133000_add_inspection_photo_processing_status.sql`
- `supabase/migrations/20260611115900_add_household_app_role.sql`
- `supabase/migrations/20260611120000_add_household_and_agent_foundations.sql`
- `supabase/migrations/20260612110000_harden_agent_identity_boundary.sql`
- `supabase/migrations/20260728120000_add_founding_customer_funnel.sql`
- `supabase/migrations/20260729000000_restore_business_identity_task_attachment_policy.sql`
- `supabase/migrations/20260729001000_restore_crm_runtime_privileges.sql`

### Tests and verification

- `scripts/verify-founding-funnel-local.mjs`
- `tests/e2e/auth.setup.ts`
- `tests/e2e/leads-smoke.spec.ts`
- `tests/unit/founding-funnel.spec.ts`
- `tests/unit/public-contact.spec.ts`
- `playwright.entry-security.config.ts`
- `package.json`

### Documentation and repository metadata

- `.gitignore`
- `README.md`
- `docs/operations/campaign-attribution-definitions.md`
- `docs/operations/founding-consultation-checklist.md`
- `docs/operations/founding-customer-commercial-offer.md`
- `docs/operations/founding-customer-funnel-architecture.md`
- `docs/operations/founding-funnel-dry-run.md`
- `docs/operations/funnel-stage-definitions.md`
- `docs/operations/migration-replay-and-production-drift-reconciliation.md`
- `docs/operations/paid-acquisition-privacy-placeholder.md`
- `docs/operations/production-release-baseline.md`
- `docs/operations/written-offer-lifecycle.md`

## Migration classification

### 1. Already recorded remotely — replay/history only

- `20260611115900_add_household_app_role.sql`
- `20260611120000_add_household_and_agent_foundations.sql`
- `20260612110000_harden_agent_identity_boundary.sql`

These files reconcile local history with versions already recorded remotely.
They are not pending production migrations and must not be applied manually.

### 2. Corrected locally — already recorded remotely and must not rerun

- `20260402135706_cleanup_property_contacts_and_duplicates.sql`
- `20260417133000_add_inspection_photo_processing_status.sql`

The corrections restore deterministic fresh replay. Production already records
both versions, so their local file differences are not production DDL.

### 3. New and pending production application

- `20260728120000_add_founding_customer_funnel.sql`
- `20260729000000_restore_business_identity_task_attachment_policy.sql`
- `20260729001000_restore_crm_runtime_privileges.sql`

The linked migration list on 2026-07-29 independently confirmed that these are
the only local versions absent remotely.

### 4. Preserved but explicitly excluded

- Preserved, remotely unrecorded
  `20260628113000_harden_launch_blockers_and_inspection_photo_policies.sql`
- Preserved Qwen/Inspection Lab, household, and agent application drafts

None is part of this release candidate.

### 5. Production drift tracked separately

- Missing restrictive task-attachment policy, repaired forward by
  `20260729000000`
- Missing runtime CRUD grants on CRM/property tables, repaired forward by
  `20260729001000`
- Production-only Inspection Lab photo indexes and role-specific policies,
  documented but not imported by this release

## Verification artifacts

- Final zero-state local migration replay: PASS
- Database-backed capacity, transition, RLS, inquiry-to-payment, and CAC check:
  PASS
- 57 unit/security/cron tests: PASS
- 5 authenticated leads/funnel smoke tests: PASS
- 5 public multilingual smoke tests: PASS
- ESLint, TypeScript, and Next.js production build: PASS
- Albanian offer PDF:
  SHA-256 `caf0171bc666c11e41b5c6284e0b27edbbc4c37b43aa6ff80f4aa3730c2e4d29`

## Gates outside the release candidate

Technical deployment remains blocked until backup/recovery evidence, final
production preflight, Vercel project/deployment/environment verification,
contact rate limiting, Hermes package review, and Founder execution
authorization are complete.

Paid acquisition and customer service commencement remain separately blocked by
the commercial, legal, key-custody, emergency-authority, channel-ownership, and
operational gates in `COMMERCIAL-LEGAL-GATES.md`.

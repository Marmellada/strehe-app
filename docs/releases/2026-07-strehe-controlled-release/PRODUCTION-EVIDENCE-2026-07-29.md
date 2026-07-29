# Production Evidence — 2026-07-29

Authority: STREHE-RELEASE-004
Evidence mode: authenticated and strictly read-only
Overall recommendation: **TECHNICAL PREFLIGHT PASS — FOUNDER DECISION REQUIRED**

## Release freeze

- Planning branch started at
  `4ae13cb1d8b6922f7a2f2fc51b0feef9d90fa5b5`.
- Frozen RC remains
  `eb30d0ec0f698bfd3a7c0404b519e67e38718f97`.
- `origin/main` remains
  `a308b63a5fad0521057b42ecd763dff22c00e716`.
- The RC remains 0 commits behind and 10 ahead of `origin/main`.
- The independent post-preflight migration comparison reconciles through
  `20260612110000` and contains exactly the approved three pending versions.

## Supabase identity

| Field | Authenticated evidence |
| --- | --- |
| Project reference | `evrravcuhrryiyywofwe` |
| Project name | `Marmellada's Project` |
| Organization | `Strehe-Prona` |
| Organization ID | `qovasxurlbctymhxpifd` |
| Region | `eu-west-1` |
| Status | `ACTIVE_HEALTHY` |
| Database | PostgreSQL 17.6 |
| Session | Authenticated `postgres`; guarded identity transaction reported `transaction_read_only=on` |

The linked project reference and organization match the prior STREHË evidence.
No connection string, password, access token, API key, or row-level application
data was captured.

## Production preflight result

Hermes-reviewed source SHA-256:
`dd3e3b501781b722ea229857989d8e31302ce140cb91602a525d4c4f16527e22`.

The Supabase Management API does not implement psql backslash directives. A
transport-only copy outside Git removed only those client directives, retained
the reviewed checks, `BEGIN TRANSACTION READ ONLY`, statement timeout, lock
timeout, and aggregate-only result, and contained no DDL, DML, grant, revoke,
copy, or error-suppression statement. Transport SHA-256:
`4a04828763dff46704713d410137a5033772461af55b7aa7c432f41a717f4cf7`.

Authenticated production execution at `2026-07-29T21:48:36.801874Z` returned:

- API/CLI exit code: **0**
- `has_stops`: **false**
- `stop_count`: **0**
- checks returned: **23 of 23**
- checks passed: **23**
- classification: **PRODUCTION PREFLIGHT PASS**
- production writes: **none**

All checks passed. Bounded inventory counts were 42 existing anonymous grants,
85 affected policies, 126 runtime grants, and one `task-attachments` bucket.
Every STOP-oriented incompatibility, collision, identity-overlap, invalid-value,
long-transaction, blocking-lock, and pending-history count was zero; the
security-definer helper count was one.

The independent linked migration comparison subsequently reconciled all
versions through `20260612110000` and again returned exactly the three frozen
local-only versions.

## Recovery evidence

Classification:
**RECOVERY PARTIALLY PROVEN — TEMPORARILY ACCEPTED FOR PRE-CLIENT RELEASE CONSIDERATION**

- Complete database exports exist on BitLocker-protected `D:`.
- All 27 Storage objects were copied and hash-reconciled.
- Storage integrity is verified with two documented source-format defects.
- A complete isolated database restoration has not succeeded, so database
  recovery remains only partially proven.

This technical limitation is separate from the Founder’s possible later
risk-acceptance decision. It does not authorize migration by itself.

### Bounded logical-backup proposal

If a managed recovery point cannot be proven, the Founder may separately
authorize a pre-migration logical backup:

1. An authorized database operator creates a consistent logical backup without
   exposing the connection string in logs.
2. Encrypt it before leaving the controlled operator host.
3. Store it in a Founder-approved private location outside Git with restricted
   access, SHA-256, UTC timestamp, schema/database version, and custody record.
4. Retain it only through the release recovery window under the approved
   privacy/retention policy.
5. Verify readability and test restoration into an isolated recovery project;
   never overwrite production as a test.
6. Delete the backup and encryption material after the approved retention
   period, recording deletion.

This proposal requires separate backup/download authority, privacy approval,
storage approval, an authorized operator, and any plan/storage cost approval.
No production backup was downloaded during STREHE-RELEASE-004.

## Vercel evidence

Classification: **VERCEL READY for a later separately authorized application
deployment**

| Field | Authenticated evidence |
| --- | --- |
| Account | `milotberisha-9215` |
| Team | `milotberisha-9215's projects` |
| Role | Confirmed `OWNER` |
| Project | `strehe-app-9lf1` |
| Project ID | `prj_pnHvdbxVAK1pqstHXAHhp4wn5Tes` |
| Repository | GitHub `Marmellada/strehe-app` |
| Production branch | `main` |
| Deployment | `dpl_E1YgwMrbRMjaDHPN5MFPXXwxTT4x` |
| State | `READY` |
| Commit | `a308b63a5fad0521057b42ecd763dff22c00e716` |
| Created / ready | 2026-07-22 22:52 / 22:53 UTC |
| Production domains | `streheprona.com`, `www.streheprona.com`, `app.streheprona.com` |

The current deployment is the recorded healthy production baseline. The frozen
RC is not deployed. The authenticated OWNER can access project metadata,
deployment state, runtime logs, promotion/rollback controls, and firewall
configuration. No rollback or promotion is in progress.

### Production environment presence

Values were neither retrieved for reporting nor recorded.

| Variable | Present | Scope / note |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Production, preview, development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Production, preview, development |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Production, preview, development |
| `NEXT_PUBLIC_APP_URL` | Yes | Production, preview, development |
| `NEXT_PUBLIC_SITE_URL` | Yes | Production |
| `SITE_URL` | No | Optional fallback; code prefers the two present public URL variables |
| `CRON_SECRET` | Yes | Production, preview |
| `RESEND_API_KEY` | Yes | Production, preview |
| `PROMOTION_EMAIL_FROM` | Yes | Production |
| `OPENAI_API_KEY` | Yes | Production, preview, development |

## Contact rate limit

Classification: **RATE LIMIT PROVEN**

The active live Vercel Firewall rule `Public contact form rate limit` has:

- method: `POST`
- path: `^/(en|sq|de)/contact/?$`
- key: client IP
- threshold: 10 requests
- window: 60 seconds
- algorithm: fixed window
- action: rate limit
- state: active, valid, live
- draft/pending changes: none

The rule covers all localized contact routes at the Vercel edge before
application work. No form submission or load test was performed.

## Monitoring and rollback

- Vercel production runtime logs were accessible; one record was used only to
  prove access and its message was not emitted or preserved.
- Authenticated Supabase database-stat monitoring was accessible; customer rows
  were not requested or emitted.
- The Vercel OWNER is the likely rollback executor; Founder Milot Berisha
  remains the rollback/recovery decision-maker.
- The current healthy deployment above is the future application rollback
  target. Expected application rollback is a Vercel promotion operation plus
  domain/runtime verification.
- Vercel rollback cannot correct committed database schema, RLS, grants,
  triggers, migration-history, or data-integrity failures.

## Founder decision matrix

| Phase | Current evidence | Recommendation |
| --- | --- | --- |
| Database migration | Project identity PASS; migration list PASS; Hermes package PASS; production preflight 23/23 PASS; recovery partially proven and temporarily accepted for consideration | **ELIGIBLE FOR EXPLICIT FOUNDER GO with documented backup-risk acceptance; not yet authorized** |
| Application deployment | Database not migrated; Vercel READY; baseline and rollback target proven; required effective environment present | **NO-GO until database migration and post-migration verification PASS, then separate Founder GO** |
| Public launch | Rate limit PROVEN and Vercel monitoring accessible; privacy, agreement, social ownership, content, and onboarding procedures unresolved | **NO-GO** |

Approval for one phase does not authorize either later phase.

## Preserved evidence

External evidence root:

`D:\Personal\Projects\Strehe-Prona\STREHE-PRESERVATION\STREHE-RELEASE-004-2026-07-29`

`EVIDENCE-MANIFEST.json` records timestamp, source/purpose, size, SHA-256,
sensitivity, and commit eligibility for each external artifact. Raw credentials,
environment values, private customer data, and private authenticated URLs are
not included.

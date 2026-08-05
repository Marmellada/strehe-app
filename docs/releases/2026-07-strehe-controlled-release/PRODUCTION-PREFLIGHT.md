# Production Preflight

Status: authenticated production preflight completed successfully
Production execution gate: **TECHNICAL PASS — SEPARATE FOUNDER GO REQUIRED**

## STREHE-RELEASE-004 result

The Hermes-reviewed script SHA-256 is
`dd3e3b501781b722ea229857989d8e31302ce140cb91602a525d4c4f16527e22`.
It ran through the authenticated Supabase Management API using a transport-only
copy that retained `BEGIN TRANSACTION READ ONLY` and contained no write
statement. Transport SHA-256:
`4a04828763dff46704713d410137a5033772461af55b7aa7c432f41a717f4cf7`.

Execution returned exit 0, `has_stops=false`, `stop_count=0`, and all 23 checks
as `PASS`. Only metadata and bounded aggregate counts were returned. No
production write occurred. See `PRODUCTION-EVIDENCE-2026-07-29.md`.

## Evidence used

- Linked migration history inspected read-only on 2026-07-29
- Production public schema captured 2026-07-28 23:11 UTC:
  SHA-256 `53469e05921bd6eb5ffc54b71658b76e6ce72af5a5bd3f27d89ac8d2c437a46f`
- Production storage schema captured 2026-07-28 23:22 UTC:
  SHA-256 `acace0ef7dde2d7784fa1973b516dee42160280d69d1cd85b5c5e0adb90e801d`
- Linked read-only table statistics captured 2026-07-29

The schema evidence predates execution planning by hours, not days. The release
operator must still run the fail-closed preflight immediately before migration.

## Structural findings

### Funnel

Required objects are present: `leads`, `lead_interactions`, `lead_events`,
`promotion_campaigns`, `clients`, `properties`, `subscriptions`, `invoices`,
`payments`, `app_users`, `agent_principals`, required roles, and
`is_active_business_user()`.

The preserved production schema contains none of the pending funnel tables,
capacity table, offer sequence, new functions, new triggers, new funnel indexes,
or funnel policies. No naming collision was found in the evidence.

Read-only estimated row counts relevant to lock planning:

| Table | Estimated rows |
| --- | ---: |
| `leads` | 18 |
| `promotion_campaigns` | 29 |
| `lead_events` | 20 |
| `lead_interactions` | 4 |
| `app_users` | 14 |
| `clients` | 39 |
| `properties` | 39 |
| `subscriptions` | 107 |
| `invoices` | 122 |
| `payments` | 15 |

New funnel tables start empty, so capacity initialization at zero is correct.
There can be no pre-existing offer-number or offer-version conflict unless a
pending object appears between preflight and execution; that is a STOP.

### Task-attachment policy

`storage.objects`, the task-attachment storage model, and
`is_active_business_user()` exist. The helper is a stable security-definer
function with a fixed search path in preserved evidence. The restrictive
`Business identities gate task attachments` policy is absent. The migration
touches only that named policy and does not drop any other policy.

### CRM privileges

All six target tables and both target roles exist. Production ACL evidence
already contains broad grants, while fresh replay needed explicit CRUD
reconciliation. The forward migration is additive/idempotent for
`authenticated` and `service_role`; it introduces no anonymous grant. Effective
anonymous denial still depends on RLS and the absence of an applicable anonymous
policy and must be verified after migration.

## Data compatibility

The migration adds nullable lead attribution/milestone columns, nullable
campaign budget fields, and one campaign-status column with a valid default.
Existing rows therefore receive no invalid user-supplied value. The replacement
lead-event check is an allowed-value expansion.

Direct current aggregates for invalid app-user roles, human/agent identity
overlap, unexpected partial funnel objects, and policy/grant drift have not been
executed during planning. They are mandatory STOP-count checks in
`scripts/production-release-preflight.sql`.

The repaired script was behavior-tested against the isolated local database. It
emitted 23 checks, passed the repaired role/type checks, returned `STOP` with 9
expected post-migration/local-environment stops, and exited 3. This is local
validation only.

## Immediate preflight procedure

1. Preserve the successful JSON evidence and script/transport hashes.
2. Reconfirm the frozen RC and exactly three pending versions at execution time.
3. Founder explicitly decides whether to accept the remaining recovery risk.
4. Founder separately authorizes or rejects database migration execution.
5. If authorized later, rerun this read-only preflight immediately before the
   migration and require exit 0 with `"stop_count": 0`.

## Divergences and unresolved items

- Production Inspection Lab policy/index drift is known and excluded.
- Production existing table ACLs include historical anonymous privileges; this
  release does not add them. Effective access is controlled by RLS/policies.
- All 23 current production checks passed.
- Recovery remains partially proven. The Founder has temporarily accepted this
  limitation for pre-client release consideration, but must make an explicit
  risk-acceptance and migration decision later.

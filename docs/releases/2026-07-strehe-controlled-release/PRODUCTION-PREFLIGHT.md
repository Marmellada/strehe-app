# Production Preflight

Status: structural preflight supported; final data preflight not yet executed
Production execution gate: BLOCKED pending all STOP-count queries and backup
evidence

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

The script was syntax- and behavior-tested only against the isolated local
database on 2026-07-29. It emitted valid JSON with 23 checks, returned `STOP`
with 9 expected stop checks because the local database is already
post-migration (and has no seeded task-attachments bucket), and exited with
code 3. This is validation of fail-closed behavior, not production evidence.
The script was not executed against production.

## Immediate preflight procedure

1. Confirm the connection target is production without printing its URL.
2. Run the SQL script through `psql` with `ON_ERROR_STOP`; it starts
   `BEGIN TRANSACTION READ ONLY`.
3. Preserve its JSON output.
4. Require process exit 0 and `"stop_count": 0`.
5. Separately run linked migration comparison and require exactly the three
   pending versions.
6. Inspect current exclusive locks and long-running transactions.
7. STOP on any unexpected object, incompatible role, identity overlap, pending
   history difference, RLS change, or nonzero data-quality count.

## Divergences and unresolved items

- Production Inspection Lab policy/index drift is known and excluded.
- Production existing table ACLs include historical anonymous privileges; this
  release does not add them. Effective access is controlled by RLS/policies.
- Current lock state and current custom data aggregates remain execution-time
  checks.
- Backup/recovery readiness is not proven and is a hard blocker.

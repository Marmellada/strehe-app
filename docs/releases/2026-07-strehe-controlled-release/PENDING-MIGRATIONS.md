# Pending Production Migrations

Authoritative comparison: linked read-only `supabase migration list --linked`,
2026-07-29. Exactly three local migrations are absent remotely.

## Execution order

1. `20260728120000_add_founding_customer_funnel.sql`
2. `20260729000000_restore_business_identity_task_attachment_policy.sql`
3. `20260729001000_restore_crm_runtime_privileges.sql`

No other local-only migration is pending.

## 20260728120000 — founding customer funnel

| Property | Assessment |
| --- | --- |
| SHA-256 | `3f34f067966fc80a832aff275932a28bdb2117bfb68a11c1aa848c26a6f496d5` |
| Lines / bytes | 344 / 13,570 |
| Existing tables altered | `promotion_campaigns`, `leads`, `lead_events` |
| New relations | `lead_consultations`, `lead_offers`, `founding_customer_capacity`, `lead_offer_number_seq` |
| New functions | `protect_lead_first_touch()`, `enforce_founding_customer_capacity()`, `can_manage_sales_funnel()` |
| New triggers | `protect_lead_first_touch_trigger`, `enforce_founding_customer_capacity_trigger` |
| New policies | Admin/office management policies on consultations and offers |
| Grants | Consultation/offer CRUD and offer-sequence usage/select to `authenticated`; funnel predicate execution |
| DML | Inserts one singleton capacity row with maximum 3 and reserved 0 |
| Backfill | No business-row backfill; new lead/campaign columns are nullable or defaulted |

### Lock and duration assessment

`ALTER TABLE`, constraint replacement, and trigger operations take
`ACCESS EXCLUSIVE` locks on the small production `leads`,
`promotion_campaigns`, and `lead_events` tables. Ordinary index creation can
block concurrent writes. Current read-only estimates are 18 leads, 29 campaigns,
and 20 lead events, so execution is expected to complete in seconds, but this is
not a guarantee. Run during low traffic. STOP on a lock wait or execution time
over 30 seconds and inspect blockers before retrying.

### Transaction and retry behavior

All statements are PostgreSQL-transaction-compatible and contain no concurrent
index or other explicitly nontransactional operation. Treat the migration as
atomic only after the CLI confirms failure rollback. It is not generally
idempotent because new tables and the sequence omit `IF NOT EXISTS`. Retry only
after confirming the migration version is absent and every new object is absent.

### Preconditions

- All base tables, roles, foreign-key targets, `auth.uid()`,
  `is_active_business_user()`, and `agent_principals` exist.
- Every new funnel table, sequence, function, trigger, index, policy, and lead
  or campaign column is absent.
- The expanded lead-event check is a superset of existing valid values.
- Immediate preflight returns zero STOP counts.
- A verified recoverable backup exists.

### Postconditions

- New columns, constraints, indexes, tables, sequence, functions, and triggers
  match the migration.
- Capacity row equals `maximum_places=3`, `reserved_places=0`.
- Consultations/offers have RLS enabled.
- Only active admin/office identities can access funnel rows.
- Field, agent, and anonymous identities cannot access funnel rows.

### Validation

Run the read-only queries in `POST-MIGRATION-VERIFICATION.md`. Do not create
synthetic rows without separate Founder authorization.

### Stop or repair

If it fails, do not deploy the application. Confirm transaction rollback,
capture the error and lock state, and request a reviewed forward repair. Do not
manually mark the migration applied. If it commits but verification fails,
leave the application at the production baseline and use a new forward
migration or verified backup restoration as appropriate.

## 20260729000000 — task-attachment policy restoration

| Property | Assessment |
| --- | --- |
| SHA-256 | `b9121a002561e41c5a240ceb4ec3456e0325bf62f245065853c372d3f26c375e` |
| Lines / bytes | 20 / 650 |
| Objects affected | `storage.objects` policy inventory |
| DDL | Drop-if-present and create one restrictive `ALL` policy |
| DML / backfill | None |
| Dependency | `public.is_active_business_user()` |

The policy DDL takes a short metadata lock on `storage.objects`. It is
transaction-compatible and retry-safe because it uses drop-and-create. Expected
duration is under a few seconds. STOP if the existing policy appears before
execution with a definition different from the approved SQL, or if another
policy has changed since preflight.

Rollback is normally a forward policy correction. Removing the restrictive
policy may weaken security and requires explicit security approval.

## 20260729001000 — CRM runtime privileges

| Property | Assessment |
| --- | --- |
| SHA-256 | `93ee5ee9acfae8d689044e2d3cb98776d5868bdc1d52a51cb924dd332ef25080` |
| Lines / bytes | 13 / 545 |
| Objects affected | `app_users`, `leads`, `lead_interactions`, `lead_events`, `promotion_campaigns`, `properties` |
| DDL | Grants SELECT/INSERT/UPDATE/DELETE |
| Roles | `authenticated`, `service_role` |
| DML / backfill | None |

`GRANT` takes short metadata locks and is transactional and idempotent. Expected
duration is under a second. The migration does not grant anything to `anon`;
pre-existing ACL grants and RLS remain independently visible in the validation
inventory.

Preconditions are that all target tables and roles exist and RLS/policies match
the approved design. Postconditions are exact CRUD grants to both intended
roles, no new anonymous grant, and unchanged RLS/policy definitions.

If verification fails, keep the application undeployed and apply a reviewed
forward GRANT/REVOKE correction. Revoking privileges casually can break the
current application and is not an automatic rollback.

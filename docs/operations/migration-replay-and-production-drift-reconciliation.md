# Migration replay and production-drift reconciliation

Date: 2026-07-29  
Work order: STREHE-LAUNCH-003

## Historical replay correction

Migration `20260402135706_cleanup_property_contacts_and_duplicates.sql`
contained three PostgreSQL `ALTER TABLE ... RENAME COLUMN` statements that
renamed each `property_contact_*` column to its existing name. PostgreSQL fails
the first statement because the target column already exists, so a later
additive migration cannot repair a replay that has already stopped.

The original file is preserved at:

`D:\Personal\Projects\Strehe-Prona\STREHE-PRESERVATION\STREHE-LAUNCH-003-2026-07-28\original-migration\20260402135706_cleanup_property_contacts_and_duplicates.sql`

Original SHA-256:
`e2f7893b4a8cae5703fa2b227c6abde3a09fd0def191712ea07f0b2f19ff59bb`.

Read-only linked evidence confirmed that migration version `20260402135706`
is recorded as applied and production already contains
`property_contact_name`, `property_contact_email`, and
`property_contact_phone`, with none of the plausible predecessor names.

The active migration therefore replaces only the three invalid self-renames
with audit comments. All later constraint and index cleanup remains unchanged.
On a fresh database this allows replay to continue. Existing environments are
unchanged because the recorded migration is not rerun and no remote history was
modified.

## Remote-only historical migrations

Production migration history contained these versions while the approved local
launch branch did not:

- `20260611115900_add_household_app_role.sql`
- `20260611120000_add_household_and_agent_foundations.sql`
- `20260612110000_harden_agent_identity_boundary.sql`

They were retrieved once from linked migration history. The fetch also rewrote
34 existing migration files, so every pre-existing file was immediately
restored and verified against its sealed pre-fetch SHA-256. Only the three
missing versions were retained, and each adopted file remains byte-identical to
its external preservation copy.

This is historical production migration reconciliation. It does not approve,
reactivate, or import the related household or agent application interface.
That product code remains outside the STREHË launch scope.

## Production drift

### Current production state

- Migration `20260611120000` is recorded as applied.
- Its household, agent, identity, function, trigger, RLS, and other storage
  policy effects are present.
- The restrictive `Business identities gate task attachments` policy on
  `storage.objects` is absent.

### Intended next release state

Migration
`20260729000000_restore_business_identity_task_attachment_policy.sql` uses an
auditable drop-and-create pattern to restore the exact historical restrictive
policy definition:

```sql
create policy "Business identities gate task attachments"
  on storage.objects
  as restrictive
  for all
  to authenticated
  using (
    bucket_id <> 'task-attachments'
    or public.is_active_business_user()
  )
  with check (
    bucket_id <> 'task-attachments'
    or public.is_active_business_user()
  );
```

This forward migration changes no other household, agent, business-identity,
Inspection Lab, or storage policy. Production is not yet repaired: deployment
and remote migration remain subject to separate review and authorization.

## Audit and safety

The preservation manifest, linked schema-only dumps, migration inventories, and
inspection evidence remain outside the repository under the
`STREHE-LAUNCH-003-2026-07-28` preservation package. No production schema,
data, configuration, storage content, or migration history was changed during
this reconciliation.

## Local replay status

After the separately authorized Inspection Lab reconstruction described below,
the final local-only `supabase db reset` on 2026-07-29 completed from zero.
Every migration ran in timestamp order, including:

- corrected historical migrations `20260402135706` and `20260417133000`;
- later Inspection Lab migrations without duplicate-object errors;
- the three adopted remote-only migrations;
- the founding-customer funnel migration;
- the forward task-attachment policy restoration; and
- the forward CRM runtime-privilege reconciliation.

No replay defect remains in the active migration chain.

## Inspection Lab historical schema reconstruction

### Preservation

Before correction, migration
`20260417133000_add_inspection_photo_processing_status.sql` was copied
byte-for-byte to:

`D:\Personal\Projects\Strehe-Prona\STREHE-PRESERVATION\STREHE-LAUNCH-003-2026-07-28\inspection-lab-replay-defect\original\20260417133000_add_inspection_photo_processing_status.sql`

Original SHA-256:
`6355f8bd8448fc9f769dca13c9878293106b29251b4f0681cca7b3784d7279ea`.
The original was 1063 bytes and 32 lines, with Git blob
`7a3c717dd6b04179279c3f0df7fa7a454720f7dc`, introduced by commit
`4a4b8e07559d3619cbe9ca979843804a493ffa0e`.

The clean replay error was:

`ERROR: relation "public.inspection_lab_case_photos" does not exist (SQLSTATE 42P01)`

at the migration's unconditional `UPDATE public.inspection_lab_case_photos`.

### Provenance

The following evidence establishes the missing base state:

1. Complete Git history contains no table-creation migration, but application
   code from 2026-04-14 and 2026-04-15 already reads and writes
   `id`, `case_id`, `capture_slot`, `storage_path`, `photo_type`,
   `order_index`, and `created_at`.
2. Preserved artifact
   `inspection-lab/sql/fix-missing-schema.sql` explicitly states that the table
   was referenced by `ALTER` statements but never created. It defines the same
   base columns, parent foreign key, capture-slot constraint, and base indexes.
3. Active migration `20260417133000` separately owns `processing_status`,
   `processing_error`, `processed_at`, `seeded_candidate_count`, its check
   constraint, and its processing-status index.
4. Active migration `20260417143000` separately owns `seed_debug_result` and
   `seed_model`.
5. Active migration `20260423120000` enables RLS and creates the original
   generic authenticated policies.
6. The schema-only production dump confirms the base columns, primary key,
   parent foreign key, capture-slot constraint, and final later-added columns.

The later preserved `live-supabase-production-setup-plan.md` proposes an
additional uniqueness rule and `updated_at`, while the earlier missing-schema
artifact does not. Current production has neither that constraint nor
`updated_at`; it instead has a later partial unique index with no active
migration provenance. Those later proposals are therefore excluded from the
historical bootstrap.

### Object chronology

| Point | Table effect |
| --- | --- |
| Before `20260417133000` | Base table: UUID primary key; required parent case, capture slot, and storage path; optional photo type and order; creation timestamp; cascading case foreign key; baseline/current check; case and case/slot indexes. |
| `20260417133000` | Adds processing state, error, processed timestamp, seeded count, processing check, and processing index. |
| `20260417143000` | Adds seed-debug JSON and seed-model text. |
| `20260423120000` | Enables RLS and creates generic authenticated CRUD policies. |
| `20260611120000` | Adds the restrictive business-identity boundary. |
| Preserved `20260628113000` only | Replaces broad policies with role-specific policies; this archived migration is not imported. |
| Current production | Contains the final columns and role-specific policies plus additional manually sourced indexes. |

### Bounded repair

The active `20260417133000` migration now conditionally creates the table only
when absent. The bootstrap contains only:

- `id`, `case_id`, `capture_slot`, `storage_path`, `photo_type`,
  `order_index`, and `created_at`;
- the primary key and cascading `inspection_lab_cases` foreign key;
- the `baseline`/`current` capture-slot check;
- base indexes on `case_id` and `(case_id, capture_slot)`.

It deliberately excludes processing and seed-debug fields, the processing
index, RLS, policies, grants, triggers, functions, storage policies, room-type
expansion, agent identities, and agent capabilities. Those are later migration
effects, unrelated proposals, or out-of-scope product work.

Fresh databases receive the missing base table and then execute every original
statement. Existing production-equivalent databases bypass the bootstrap
without modification. No production operation was performed.

### Final local versus production classification

The final local table contains the reconstructed base plus every column,
constraint, index, RLS state, and policy added by active later migrations.
Later Inspection Lab migrations completed without duplicate-object errors.

Differences are classified as follows:

- **Known production drift:** production has additional manually sourced
  Inspection Lab photo indexes, including a partial uniqueness index, that have
  no active migration provenance. Local retains only the two evidenced base
  indexes and the later processing index.
- **Known production drift:** production's base `created_at` expression is
  `timezone('utc', now())`; the strong historical artifact uses `now()`. Both
  populate the same `timestamp with time zone` column.
- **Known production drift:** local replay retains the generic authenticated
  Inspection Lab photo CRUD policies from `20260423120000`, plus the restrictive
  business-identity boundary. Production has the narrower role-specific
  policies from preserved but remotely unrecorded migration
  `20260628113000_harden_launch_blockers_and_inspection_photo_policies.sql`.
  That archived migration was not imported under this work order.
- **Expected future local migration:** none.
- **Unexplained security-relevant mismatch:** none. The policy difference is
  explained by the preserved, unrecorded production migration and remains a
  release-review gate rather than an inferred historical import.

Final evidence:

- local public schema SHA-256
  `13cf535556fd6fa6082db292d586799a0213d64827446a9f1424c21c8a7b1fb4`;
- local storage schema SHA-256
  `87bfb9886501f24a2733eec0bd41cdd54ece077e2fb741d61d1dd8cb8c9ab0ba`.

## Funnel and runtime reconciliation

The clean replay exposed missing CRUD grants on CRM tables that production
already grants but the active local migration chain did not reproduce.
Forward migration
`20260729001000_restore_crm_runtime_privileges.sql` restores only
`select`, `insert`, `update`, and `delete` to `authenticated` and
`service_role` for `app_users`, `leads`, `lead_interactions`, `lead_events`,
`promotion_campaigns`, and `properties`. It grants nothing to `anon`; existing
RLS policies remain the authenticated authorization boundary.

The founding funnel migration now:

- enforces one active founding offer per lead;
- serializes a three-place global capacity through a private singleton row and
  security-definer trigger;
- grants the authenticated table and offer-sequence privileges required before
  RLS can evaluate;
- evaluates admin/office access through a private security-definer predicate;
- rejects a stale concurrent offer transition before lead/event side effects;
  and
- orders consultations explicitly by scheduled start and creation time.

The database-backed local verification used reserved UUID namespace
`91000000-0000-0000-0000-*` and cleaned every fixture afterward. Two concurrent
founding inserts produced one winner and one capacity rejection; two concurrent
conditional acceptance attempts produced one accepted row and one event.
The inquiry-to-payment dry run produced six inquiries, six qualified leads, one
completed consultation, one accepted offer, one payment-backed customer,
€300.00 spend, and €300.00 CAC. Admin RLS returned one internal offer and field
RLS returned zero; no anonymous funnel policy exists.

The Albanian proposal PDF is one-page A4, contains all required proposal,
pricing, exclusion, approval-limit, validity, and non-contract language, and
rendered without clipping or overlap. Its SHA-256 is
`caf0171bc666c11e41b5c6284e0b27edbbc4c37b43aa6ff80f4aa3730c2e4d29`.

No Inspection Lab application code, household application code, or agent
application code was imported. All database resets, schema checks, smoke tests,
and fixture writes were local only.

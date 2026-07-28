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

The first local-only replay on 2026-07-29 confirmed that the bounded correction
allows migration `20260402135706` to complete. Replay then stopped at
`20260417133000_add_inspection_photo_processing_status.sql` because it
unconditionally updates `public.inspection_lab_case_photos`, while no earlier
active migration creates that table.

This is a separate historical Inspection Lab replay defect. It prevents the
adopted remote-only migrations, founding-funnel migration, and forward policy
restoration from being reached during a zero-state replay. It is not corrected
under the current bounded authorization, and no preserved Qwen or Inspection
Lab application code was imported.

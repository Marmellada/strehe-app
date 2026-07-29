begin;

-- This migration originally assumed inspection_lab_case_photos already existed,
-- but its table-creation provenance is absent from the active migration chain.
-- Production already contains the table. This conditional bootstrap restores
-- only the minimum pre-processing schema needed for deterministic fresh replay;
-- related Inspection Lab product work remains outside launch scope.
-- The complete original migration is preserved under STREHE-LAUNCH-003 with
-- SHA-256 6355f8bd8448fc9f769dca13c9878293106b29251b4f0681cca7b3784d7279ea.
do $bootstrap$
begin
  if to_regclass('public.inspection_lab_case_photos') is null then
    create table public.inspection_lab_case_photos (
      id uuid primary key default gen_random_uuid(),
      case_id uuid not null
        references public.inspection_lab_cases(id) on delete cascade,
      capture_slot text not null,
      storage_path text not null,
      photo_type text,
      order_index integer,
      created_at timestamp with time zone not null default now(),
      constraint inspection_lab_case_photos_capture_slot_check
        check (capture_slot in ('baseline', 'current'))
    );

    create index idx_inspection_lab_case_photos_case_id
      on public.inspection_lab_case_photos(case_id);

    create index idx_inspection_lab_case_photos_capture_slot
      on public.inspection_lab_case_photos(case_id, capture_slot);
  end if;
end
$bootstrap$;

alter table if exists public.inspection_lab_case_photos
  add column if not exists processing_status text not null default 'ready',
  add column if not exists processing_error text,
  add column if not exists processed_at timestamp with time zone,
  add column if not exists seeded_candidate_count integer not null default 0;

update public.inspection_lab_case_photos
set
  processing_status = coalesce(processing_status, 'ready'),
  seeded_candidate_count = coalesce(seeded_candidate_count, 0)
where true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'inspection_lab_case_photos_processing_status_check'
  ) then
    alter table public.inspection_lab_case_photos
      add constraint inspection_lab_case_photos_processing_status_check
      check (processing_status in ('pending', 'processing', 'ready', 'failed'));
  end if;
end
$$;

create index if not exists idx_inspection_lab_case_photos_processing_status
  on public.inspection_lab_case_photos (processing_status);

commit;

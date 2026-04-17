begin;

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

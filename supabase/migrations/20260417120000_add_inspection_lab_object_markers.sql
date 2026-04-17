begin;

alter table if exists public.inspection_lab_tracked_objects
  add column if not exists marker_x double precision,
  add column if not exists marker_y double precision;

create index if not exists idx_inspection_lab_tracked_objects_baseline_photo
  on public.inspection_lab_tracked_objects (baseline_photo_id);

commit;

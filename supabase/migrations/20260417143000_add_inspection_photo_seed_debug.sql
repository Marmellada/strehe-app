begin;

alter table if exists public.inspection_lab_case_photos
  add column if not exists seed_debug_result jsonb,
  add column if not exists seed_model text;

commit;

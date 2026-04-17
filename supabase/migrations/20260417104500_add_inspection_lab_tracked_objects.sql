begin;

create table if not exists public.inspection_lab_tracked_objects (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.inspection_lab_cases(id) on delete cascade,
  object_key text not null,
  label text not null,
  category text,
  source text not null default 'manual_added',
  importance text not null default 'medium',
  is_active boolean not null default true,
  baseline_photo_id uuid,
  baseline_order_index integer,
  baseline_photo_type text,
  baseline_storage_path text,
  review_note text,
  created_by_user_id uuid references public.app_users(id) on delete set null,
  updated_by_user_id uuid references public.app_users(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint inspection_lab_tracked_objects_case_object_key_key
    unique (case_id, object_key),
  constraint inspection_lab_tracked_objects_source_check
    check (source in ('engine', 'baseline_capture', 'auto_detected', 'manual_added', 'manual_corrected')),
  constraint inspection_lab_tracked_objects_importance_check
    check (importance in ('high', 'medium'))
);

create index if not exists idx_inspection_lab_tracked_objects_case_id
  on public.inspection_lab_tracked_objects (case_id);

create index if not exists idx_inspection_lab_tracked_objects_case_active
  on public.inspection_lab_tracked_objects (case_id, is_active);

commit;

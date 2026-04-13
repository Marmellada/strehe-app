create table if not exists public.inspection_lab_cases (
  id uuid primary key default gen_random_uuid(),
  case_key text not null unique,
  room_type text not null default 'bathroom',
  capture_type text not null default 'base_shot',
  baseline_storage_path text,
  baseline_uploaded_at timestamp with time zone,
  current_storage_path text,
  current_uploaded_at timestamp with time zone,
  created_by_user_id uuid references public.app_users(id) on delete set null,
  last_uploaded_by_user_id uuid references public.app_users(id) on delete set null,
  report_status text not null default 'not_run',
  comparison_summary jsonb,
  report_markdown text,
  report_generated_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint inspection_lab_cases_room_type_check
    check (room_type in ('bathroom')),
  constraint inspection_lab_cases_capture_type_check
    check (capture_type in ('base_shot')),
  constraint inspection_lab_cases_report_status_check
    check (report_status in ('not_run', 'ready', 'review_required', 'completed'))
);

create index if not exists idx_inspection_lab_cases_case_key
  on public.inspection_lab_cases (case_key);

create index if not exists idx_inspection_lab_cases_report_status
  on public.inspection_lab_cases (report_status);

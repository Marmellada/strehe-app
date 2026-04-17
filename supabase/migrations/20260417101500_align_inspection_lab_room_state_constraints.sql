begin;

alter table if exists public.inspection_lab_cases
  drop constraint if exists inspection_lab_cases_room_type_check;

alter table if exists public.inspection_lab_cases
  add constraint inspection_lab_cases_room_type_check
    check (room_type in ('bathroom', 'living_room'));

alter table if exists public.inspection_lab_cases
  drop constraint if exists inspection_lab_cases_report_status_check;

alter table if exists public.inspection_lab_cases
  add constraint inspection_lab_cases_report_status_check
    check (report_status in ('draft', 'not_run', 'ready', 'review_required', 'completed'));

commit;

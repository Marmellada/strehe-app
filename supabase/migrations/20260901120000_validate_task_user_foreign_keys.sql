alter table public.tasks
validate constraint tasks_assigned_user_id_fkey;

alter table public.tasks
validate constraint tasks_created_by_user_id_fkey;

alter table public.tasks
validate constraint tasks_reported_by_user_id_fkey;

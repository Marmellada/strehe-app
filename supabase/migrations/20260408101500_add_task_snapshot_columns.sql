alter table public.tasks
  add column if not exists created_by_user_name_snapshot text,
  add column if not exists assigned_user_name_snapshot text,
  add column if not exists reported_by_user_name_snapshot text,
  add column if not exists service_name_snapshot text,
  add column if not exists subscription_package_name_snapshot text,
  add column if not exists property_code_snapshot text;

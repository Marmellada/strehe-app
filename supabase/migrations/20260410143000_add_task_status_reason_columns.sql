alter table public.tasks
  add column if not exists blocked_reason text,
  add column if not exists cancelled_reason text;

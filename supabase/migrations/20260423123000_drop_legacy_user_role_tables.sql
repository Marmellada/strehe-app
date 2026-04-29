do $$
begin
  if to_regclass('public.tasks') is not null then
    alter table public.tasks drop constraint if exists tasks_assigned_to_user_id_fkey;
    alter table public.tasks drop column if exists assigned_to_user_id;
  end if;

  if to_regclass('public.keys') is not null then
    alter table public.keys drop constraint if exists keys_holder_user_fk;
    alter table public.keys drop constraint if exists keys_holder_user_id_fkey;
  end if;

  if to_regclass('public.key_logs') is not null then
    alter table public.key_logs drop constraint if exists key_logs_performed_by_user_fk;
    alter table public.key_logs drop constraint if exists key_logs_performed_by_user_id_fkey;
  end if;

  if to_regclass('public.users') is not null then
    alter table public.users drop constraint if exists users_role_id_fkey;
  end if;
end $$;

drop table if exists public.role_permissions cascade;
drop table if exists public.permissions cascade;
drop table if exists public.roles cascade;
drop table if exists public.users cascade;

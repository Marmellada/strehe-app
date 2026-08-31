-- Deterministic validation-only assertions for the tasks user foreign keys.
-- Run only against the disposable local Supabase database.

begin;

-- A fresh migration replay must leave all three constraints present and validated.
do $$
declare
  existing_count integer;
  validated_count integer;
begin
  select
    count(*),
    count(*) filter (where constraint_row.convalidated)
  into existing_count, validated_count
  from pg_constraint constraint_row
  where constraint_row.conrelid = 'public.tasks'::regclass
    and constraint_row.contype = 'f'
    and constraint_row.conname in (
      'tasks_assigned_user_id_fkey',
      'tasks_created_by_user_id_fkey',
      'tasks_reported_by_user_id_fkey'
    );

  if existing_count <> 3 then
    raise exception 'expected all three tasks user foreign keys after fresh replay, found %', existing_count;
  end if;

  if validated_count <> 3 then
    raise exception 'expected all three tasks user foreign keys to be validated after fresh replay, found %', validated_count;
  end if;
end;
$$;

create temporary table tasks_before_validation as
select
  count(*)::bigint as row_count,
  md5(coalesce(string_agg(to_jsonb(task_row)::text, E'\n' order by task_row.id::text), '')) as data_hash
from public.tasks task_row;

-- Reconstruct the pre-migration catalog state inside this rollback-only test.
alter table public.tasks drop constraint tasks_assigned_user_id_fkey;
alter table public.tasks
  add constraint tasks_assigned_user_id_fkey
  foreign key (assigned_user_id) references public.app_users(id) on delete set null
  not valid;

alter table public.tasks drop constraint tasks_created_by_user_id_fkey;
alter table public.tasks
  add constraint tasks_created_by_user_id_fkey
  foreign key (created_by_user_id) references public.app_users(id) on delete set null
  not valid;

alter table public.tasks drop constraint tasks_reported_by_user_id_fkey;
alter table public.tasks
  add constraint tasks_reported_by_user_id_fkey
  foreign key (reported_by_user_id) references public.app_users(id) on delete set null
  not valid;

do $$
declare
  existing_count integer;
  unvalidated_count integer;
begin
  select
    count(*),
    count(*) filter (where not constraint_row.convalidated)
  into existing_count, unvalidated_count
  from pg_constraint constraint_row
  where constraint_row.conrelid = 'public.tasks'::regclass
    and constraint_row.contype = 'f'
    and constraint_row.conname in (
      'tasks_assigned_user_id_fkey',
      'tasks_created_by_user_id_fkey',
      'tasks_reported_by_user_id_fkey'
    );

  if existing_count <> 3 then
    raise exception 'expected all three tasks user foreign keys before validation, found %', existing_count;
  end if;

  if unvalidated_count <> 3 then
    raise exception 'expected all three tasks user foreign keys to be unvalidated before validation, found %', unvalidated_count;
  end if;
end;
$$;

alter table public.tasks
validate constraint tasks_assigned_user_id_fkey;

alter table public.tasks
validate constraint tasks_created_by_user_id_fkey;

alter table public.tasks
validate constraint tasks_reported_by_user_id_fkey;

do $$
declare
  validated_count integer;
  tasks_after_validation record;
begin
  select count(*)
  into validated_count
  from pg_constraint constraint_row
  where constraint_row.conrelid = 'public.tasks'::regclass
    and constraint_row.contype = 'f'
    and constraint_row.convalidated
    and constraint_row.conname in (
      'tasks_assigned_user_id_fkey',
      'tasks_created_by_user_id_fkey',
      'tasks_reported_by_user_id_fkey'
    );

  if validated_count <> 3 then
    raise exception 'expected all three tasks user foreign keys to become validated, found %', validated_count;
  end if;

  select
    count(*)::bigint as row_count,
    md5(coalesce(string_agg(to_jsonb(task_row)::text, E'\n' order by task_row.id::text), '')) as data_hash
  into tasks_after_validation
  from public.tasks task_row;

  if tasks_after_validation.row_count is distinct from (select row_count from tasks_before_validation)
    or tasks_after_validation.data_hash is distinct from (select data_hash from tasks_before_validation)
  then
    raise exception 'validating tasks user foreign keys changed task data';
  end if;
end;
$$;

do $$
begin
  raise notice 'tasks user foreign key validation SQL assertions passed';
end;
$$;

rollback;

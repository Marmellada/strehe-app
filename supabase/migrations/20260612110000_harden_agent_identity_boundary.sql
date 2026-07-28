begin;
create or replace function public.is_active_app_user()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.app_users
    where id = (select auth.uid())
      and is_active = true
  )
  and not exists (
    select 1
    from public.agent_principals
    where id = (select auth.uid())
  );
$$;
create or replace function public.is_active_business_user()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.app_users
    where id = (select auth.uid())
      and is_active = true
      and role in ('admin', 'office', 'field', 'contractor')
  )
  and not exists (
    select 1
    from public.agent_principals
    where id = (select auth.uid())
  );
$$;
create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.app_users
    where id = (select auth.uid())
      and is_active = true
      and role = 'admin'
  )
  and not exists (
    select 1
    from public.agent_principals
    where id = (select auth.uid())
  );
$$;
create or replace function public.enforce_separate_human_agent_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'app_users' then
    if exists (
      select 1
      from public.agent_principals
      where id = new.id
    ) then
      raise exception 'An agent principal cannot also be an application user';
    end if;
  elsif tg_table_name = 'agent_principals' then
    if exists (
      select 1
      from public.app_users
      where id = new.id
    ) then
      raise exception 'An application user cannot also be an agent principal';
    end if;
  end if;

  return new;
end;
$$;
revoke all on function public.enforce_separate_human_agent_identity() from public;
drop trigger if exists enforce_app_user_not_agent
  on public.app_users;
create trigger enforce_app_user_not_agent
before insert or update of id on public.app_users
for each row
execute function public.enforce_separate_human_agent_identity();
drop trigger if exists enforce_agent_not_app_user
  on public.agent_principals;
create trigger enforce_agent_not_app_user
before insert or update of id on public.agent_principals
for each row
execute function public.enforce_separate_human_agent_identity();
commit;

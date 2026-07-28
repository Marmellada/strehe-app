do $$
begin
  if exists (
    select 1
    from pg_type target_type
    join pg_namespace target_namespace
      on target_namespace.oid = target_type.typnamespace
    where target_namespace.nspname = 'public'
      and target_type.typname = 'app_role'
  ) then
    alter type public.app_role add value if not exists 'household';
  end if;
end $$;

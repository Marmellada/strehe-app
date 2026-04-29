do $$
declare
  table_name text;
  app_tables text[] := array[
    'app_users',
    'bank_identifiers',
    'banks',
    'clients',
    'company_bank_accounts',
    'company_settings',
    'expense_categories',
    'expenses',
    'inspection_lab_case_photos',
    'inspection_lab_cases',
    'inspection_lab_tracked_objects',
    'invoice_items',
    'invoices',
    'key_logs',
    'keys',
    'locations',
    'municipalities',
    'package_services',
    'packages',
    'payments',
    'promotion_campaigns',
    'promotion_codes',
    'promotion_redemptions',
    'properties',
    'services',
    'subscriptions',
    'task_attachments',
    'task_reports',
    'tasks',
    'vendors',
    'worker_role_title_history',
    'workers'
  ];
begin
  foreach table_name in array app_tables loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I enable row level security', table_name);

      if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = table_name
          and policyname = 'Authenticated users can select'
      ) then
        execute format(
          'create policy "Authenticated users can select" on public.%I for select to authenticated using (true)',
          table_name
        );
      end if;

      if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = table_name
          and policyname = 'Authenticated users can insert'
      ) then
        execute format(
          'create policy "Authenticated users can insert" on public.%I for insert to authenticated with check (true)',
          table_name
        );
      end if;

      if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = table_name
          and policyname = 'Authenticated users can update'
      ) then
        execute format(
          'create policy "Authenticated users can update" on public.%I for update to authenticated using (true) with check (true)',
          table_name
        );
      end if;

      if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = table_name
          and policyname = 'Authenticated users can delete'
      ) then
        execute format(
          'create policy "Authenticated users can delete" on public.%I for delete to authenticated using (true)',
          table_name
        );
      end if;
    end if;
  end loop;
end $$;

do $$
begin
  if to_regclass('public.company_settings') is not null
    and not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'company_settings'
        and policyname = 'Public can read company settings'
    )
  then
    create policy "Public can read company settings"
      on public.company_settings
      for select
      to anon
      using (true);
  end if;
end $$;

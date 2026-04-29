do $$
declare
  table_name text;
  advisor_tables text[] := array[
    'subscription_tasks',
    'task_templates',
    'invoice_number_sequences',
    'credit_note_number_sequences'
  ];
begin
  foreach table_name in array advisor_tables loop
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

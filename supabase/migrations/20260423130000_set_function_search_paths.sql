do $$
declare
  function_name text;
  function_names text[] := array[
    'generate_invoice_number',
    'update_packages_updated_at',
    'update_services_updated_at',
    'update_subscriptions_updated_at',
    'update_tasks_updated_at',
    'update_updated_at',
    'update_updated_at_column'
  ];
begin
  foreach function_name in array function_names loop
    if to_regprocedure(format('public.%I()', function_name)) is not null then
      execute format(
        'alter function public.%I() set search_path = public, pg_temp',
        function_name
      );
    end if;
  end loop;
end $$;

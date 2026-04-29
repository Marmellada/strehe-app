do $$
declare
  function_name text;
  function_names text[] := array[
    'set_row_updated_at',
    'forbid_payment_mutation',
    'set_updated_at',
    'prevent_invoice_number_change',
    'validate_credit_note_reference'
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

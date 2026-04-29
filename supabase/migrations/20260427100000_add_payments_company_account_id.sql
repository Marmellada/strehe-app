alter table public.payments
  add column if not exists company_account_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'payments_company_account_id_fkey'
      and conrelid = 'public.payments'::regclass
  ) then
    alter table public.payments
      add constraint payments_company_account_id_fkey
      foreign key (company_account_id)
      references public.company_bank_accounts(id)
      on delete restrict;
  end if;
end $$;

create index if not exists idx_payments_company_account_id
  on public.payments (company_account_id);

alter table public.company_bank_accounts
  add column if not exists account_type text;

update public.company_bank_accounts
set account_type = 'bank'
where account_type is null;

alter table public.company_bank_accounts
  alter column account_type set default 'bank';

alter table public.company_bank_accounts
  alter column account_type set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'company_bank_accounts_account_type_check'
      and conrelid = 'public.company_bank_accounts'::regclass
  ) then
    alter table public.company_bank_accounts
      add constraint company_bank_accounts_account_type_check
      check (account_type in ('bank', 'cash'));
  end if;
end $$;

create index if not exists idx_company_bank_accounts_account_type
  on public.company_bank_accounts (account_type);

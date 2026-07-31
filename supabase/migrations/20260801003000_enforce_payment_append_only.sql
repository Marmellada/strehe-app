-- Replace payment authorization and enforce append-only payment rows.

drop policy if exists "Authenticated users can delete" on public.payments;
drop policy if exists "Authenticated users can delete payments" on public.payments;
drop policy if exists "Authenticated users can insert" on public.payments;
drop policy if exists "Authenticated users can insert payments" on public.payments;
drop policy if exists "Authenticated users can read payments" on public.payments;
drop policy if exists "Authenticated users can select" on public.payments;
drop policy if exists "Authenticated users can update" on public.payments;
drop policy if exists "Authenticated users can update payments" on public.payments;
drop policy if exists "Business identity boundary" on public.payments;
drop policy if exists "Office and admins can read payments" on public.payments;
drop policy if exists "Office and admins can insert payments" on public.payments;
drop policy if exists "Billing admins can select payments" on public.payments;
drop policy if exists "Billing admins can insert payments" on public.payments;

create policy "Billing admins can select payments"
  on public.payments
  for select
  to authenticated
  using (public.can_manage_billing());

create policy "Billing admins can insert payments"
  on public.payments
  for insert
  to authenticated
  with check (public.can_manage_billing());

grant select, insert
  on table public.payments
  to authenticated;

revoke select, insert, update, delete, truncate
  on table public.payments
  from anon, service_role;

revoke update, delete, truncate
  on table public.payments
  from authenticated;

create or replace function public.forbid_payment_mutation()
returns trigger
language plpgsql
set search_path = 'public', 'pg_temp'
as $$
begin
  raise exception 'Payments are immutable and cannot be %', lower(TG_OP)
    using errcode = '42501';
end;
$$;

revoke all
  on function public.forbid_payment_mutation()
  from public, anon, authenticated, service_role;

drop trigger if exists payments_forbid_update_delete on public.payments;

create trigger payments_forbid_update_delete
before update or delete on public.payments
for each row execute function public.forbid_payment_mutation();

-- Canonical billing authorization, numbering state, and issuance RPC.

create or replace function public.can_manage_billing()
returns boolean
language sql
stable
security definer
set search_path = 'public', 'auth', 'pg_temp'
as $$
  select exists (
    select 1
    from public.app_users as app_user
    where app_user.id = (select auth.uid())
      and app_user.is_active = true
      and app_user.role::text in ('admin', 'office')
  );
$$;

revoke all
  on function public.can_manage_billing()
  from public, anon, authenticated, service_role;

grant execute
  on function public.can_manage_billing()
  to authenticated;

create table if not exists public.invoice_number_sequences (
  year integer primary key,
  last_value integer not null default 0,
  updated_at timestamp with time zone not null default now(),
  constraint invoice_number_sequences_year_check
    check (year between 2000 and 9999),
  constraint invoice_number_sequences_last_value_check
    check (last_value >= 0)
);

create table if not exists public.credit_note_number_sequences (
  year integer primary key,
  last_value integer not null default 0,
  updated_at timestamp with time zone not null default now(),
  constraint credit_note_number_sequences_year_check
    check (year between 2000 and 9999),
  constraint credit_note_number_sequences_last_value_check
    check (last_value >= 0)
);

alter table public.invoice_number_sequences enable row level security;
alter table public.credit_note_number_sequences enable row level security;

revoke insert, update, delete, truncate
  on table
    public.invoice_number_sequences,
    public.credit_note_number_sequences
  from anon, authenticated, service_role;

insert into public.invoice_number_sequences (year, last_value, updated_at)
select
  substring(invoice.invoice_number from 5 for 4)::integer,
  max(substring(invoice.invoice_number from 10)::integer),
  now()
from public.invoices as invoice
where invoice.invoice_number ~ '^INV-[0-9]{4}-[0-9]+$'
group by 1
on conflict (year) do update
set last_value = greatest(
      public.invoice_number_sequences.last_value,
      excluded.last_value
    ),
    updated_at = now();

insert into public.credit_note_number_sequences (year, last_value, updated_at)
select
  substring(invoice.invoice_number from 4 for 4)::integer,
  max(substring(invoice.invoice_number from 9)::integer),
  now()
from public.invoices as invoice
where invoice.invoice_number ~ '^CN-[0-9]{4}-[0-9]+$'
group by 1
on conflict (year) do update
set last_value = greatest(
      public.credit_note_number_sequences.last_value,
      excluded.last_value
    ),
    updated_at = now();

create or replace function public.next_billing_document_number(
  p_document_type text,
  p_issue_date date default current_date
)
returns text
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  issue_year integer := extract(year from coalesce(p_issue_date, current_date));
  next_value integer;
begin
  if p_document_type = 'credit_note' then
    insert into public.credit_note_number_sequences as sequence_state (
      year,
      last_value,
      updated_at
    )
    values (issue_year, 1, now())
    on conflict (year) do update
    set last_value = sequence_state.last_value + 1,
        updated_at = now()
    returning last_value into next_value;

    return format(
      'CN-%s-%s',
      issue_year,
      lpad(next_value::text, 4, '0')
    );
  end if;

  if p_document_type = 'invoice' then
    insert into public.invoice_number_sequences as sequence_state (
      year,
      last_value,
      updated_at
    )
    values (issue_year, 1, now())
    on conflict (year) do update
    set last_value = sequence_state.last_value + 1,
        updated_at = now()
    returning last_value into next_value;

    return format(
      'INV-%s-%s',
      issue_year,
      lpad(next_value::text, 4, '0')
    );
  end if;

  raise exception
    'Unsupported billing document type: %',
    coalesce(p_document_type, '<null>');
end;
$$;

revoke all
  on function public.next_billing_document_number(text, date)
  from public, anon, authenticated, service_role;

create or replace function public.issue_billing_document_with_number(
  p_invoice_id uuid
)
returns text
language plpgsql
security definer
set search_path = 'public', 'auth', 'pg_temp'
as $$
declare
  target_invoice public.invoices%rowtype;
  next_number text;
begin
  if not public.can_manage_billing() then
    raise exception 'Active admin or office role required'
      using errcode = '42501';
  end if;

  select invoice.*
  into target_invoice
  from public.invoices as invoice
  where invoice.id = p_invoice_id
  for update;

  if not found then
    raise exception 'Billing document not found';
  end if;

  if target_invoice.status <> 'draft' then
    raise exception 'Only draft billing documents can be issued';
  end if;

  if target_invoice.document_type = 'credit_note'
    and coalesce(target_invoice.invoice_number, '') ~ '^CN-[0-9]{4}-[0-9]+$'
  then
    next_number := target_invoice.invoice_number;
  elsif target_invoice.document_type = 'invoice'
    and coalesce(target_invoice.invoice_number, '') ~ '^INV-[0-9]{4}-[0-9]+$'
  then
    next_number := target_invoice.invoice_number;
  else
    next_number := public.next_billing_document_number(
      target_invoice.document_type,
      target_invoice.issue_date
    );
  end if;

  update public.invoices as invoice
  set invoice_number = next_number,
      status = 'issued',
      updated_at = now()
  where invoice.id = p_invoice_id;

  return next_number;
end;
$$;

revoke all
  on function public.issue_billing_document_with_number(uuid)
  from public, anon, authenticated, service_role;

grant execute
  on function public.issue_billing_document_with_number(uuid)
  to authenticated;

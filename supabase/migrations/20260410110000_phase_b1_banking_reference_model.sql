-- ============================================================================
-- PHASE B1: BANKING REFERENCE MODEL
-- ============================================================================
-- Purpose:
-- 1. Keep `banks` as the licensed-bank reference registry.
-- 2. Keep `company_bank_accounts` as company-owned accounts referencing `banks`.
-- 3. Add `bank_identifiers` for IBAN/account/card detection rules.

alter table public.banks
  add column if not exists short_name text,
  add column if not exists country_code text not null default 'XK',
  add column if not exists license_source text,
  add column if not exists license_checked_at date,
  add column if not exists display_order integer,
  add column if not exists notes text;

alter table public.company_bank_accounts
  add column if not exists bank_name_snapshot text,
  add column if not exists swift text,
  add column if not exists currency text not null default 'EUR',
  add column if not exists show_on_invoice boolean not null default true,
  add column if not exists notes text,
  add column if not exists updated_at timestamp with time zone not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'bank_identifier_type'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.bank_identifier_type as enum (
      'iban_prefix',
      'account_prefix',
      'card_bin'
    );
  end if;
end $$;

create table if not exists public.bank_identifiers (
  id uuid primary key default gen_random_uuid(),
  bank_id uuid not null references public.banks(id) on delete cascade,
  identifier_type public.bank_identifier_type not null,
  value text not null,
  value_end text,
  scheme text,
  country_code text,
  priority integer not null default 100,
  is_active boolean not null default true,
  source text,
  checked_at date,
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists idx_bank_identifiers_bank_id
  on public.bank_identifiers (bank_id);

create index if not exists idx_bank_identifiers_type_value
  on public.bank_identifiers (identifier_type, value);

create unique index if not exists uq_bank_identifiers_exact
  on public.bank_identifiers (bank_id, identifier_type, value)
  where value_end is null;

-- Seed or update the licensed Kosovo banks we currently recognize from the
-- official CBK licensed institutions list (checked 2025-10-08).
insert into public.banks (
  name,
  short_name,
  country,
  country_code,
  is_active,
  license_source,
  license_checked_at,
  display_order
)
values
  ('NLB Bank', 'NLB', 'Kosovo', 'XK', true, 'CBK licensed institutions list', '2025-10-08', 10),
  ('Banka për Biznes', 'BPB', 'Kosovo', 'XK', true, 'CBK licensed institutions list', '2025-10-08', 20),
  ('Banka Ekonomike J.S.C.', 'Banka Ekonomike', 'Kosovo', 'XK', true, 'CBK licensed institutions list', '2025-10-08', 30),
  ('Raiffeisen Bank Kosovo J.S.C.', 'Raiffeisen Kosovo', 'Kosovo', 'XK', true, 'CBK licensed institutions list', '2025-10-08', 40),
  ('ProCredit Bank J.S.C.', 'ProCredit', 'Kosovo', 'XK', true, 'CBK licensed institutions list', '2025-10-08', 50),
  ('TEB J.S.C.', 'TEB', 'Kosovo', 'XK', true, 'CBK licensed institutions list', '2025-10-08', 60),
  ('Banka Kombëtare Tregtare Kosovo J.S.C.', 'BKT Kosovo', 'Kosovo', 'XK', true, 'CBK licensed institutions list', '2025-10-08', 70),
  ('Ziraat Bank Kosova SH.A.', 'Ziraat Kosovo', 'Kosovo', 'XK', true, 'CBK licensed institutions list', '2025-10-08', 80),
  ('Credins Bank, Kosovo', 'Credins Kosovo', 'Kosovo', 'XK', true, 'CBK licensed institutions list', '2025-10-08', 90),
  ('Pribank J.S.C.', 'Pribank', 'Kosovo', 'XK', true, 'CBK licensed institutions list', '2025-10-08', 100)
on conflict do nothing;

-- Seed the first verified identifier rules we can support confidently from
-- official bank sources. These are intentionally conservative and can be
-- expanded later as more bank codes are verified.

update public.banks
set swift_code = 'NLPRXKPR'
where name = 'NLB Bank';

update public.banks
set swift_code = 'TEBKXKPR'
where name = 'TEB J.S.C.';

insert into public.bank_identifiers (
  bank_id,
  identifier_type,
  value,
  country_code,
  priority,
  is_active,
  source,
  checked_at,
  notes
)
select
  id,
  'iban_prefix'::public.bank_identifier_type,
  'XK0517',
  'XK',
  10,
  true,
  'NLB Bank official transfer and branch pages',
  '2026-04-10',
  'Matches Kosovo IBANs for NLB Bank by official XK05 17... examples.'
from public.banks
where name = 'NLB Bank'
on conflict do nothing;

insert into public.bank_identifiers (
  bank_id,
  identifier_type,
  value,
  country_code,
  priority,
  is_active,
  source,
  checked_at,
  notes
)
select
  id,
  'account_prefix'::public.bank_identifier_type,
  '17',
  'XK',
  10,
  true,
  'NLB Bank official transfer and branch pages',
  '2026-04-10',
  'Matches Kosovo BBAN/account prefixes for NLB Bank.'
from public.banks
where name = 'NLB Bank'
on conflict do nothing;

insert into public.bank_identifiers (
  bank_id,
  identifier_type,
  value,
  country_code,
  priority,
  is_active,
  source,
  checked_at,
  notes
)
select
  id,
  'iban_prefix'::public.bank_identifier_type,
  'XK0520',
  'XK',
  10,
  true,
  'TEB official international transfer guidance',
  '2026-04-10',
  'Matches Kosovo IBANs for TEB by official XK05 20... example and bank identification number.'
from public.banks
where name = 'TEB J.S.C.'
on conflict do nothing;

insert into public.bank_identifiers (
  bank_id,
  identifier_type,
  value,
  country_code,
  priority,
  is_active,
  source,
  checked_at,
  notes
)
select
  id,
  'account_prefix'::public.bank_identifier_type,
  '20',
  'XK',
  10,
  true,
  'TEB official international transfer guidance',
  '2026-04-10',
  'Matches Kosovo BBAN/account prefixes for TEB.'
from public.banks
where name = 'TEB J.S.C.'
on conflict do nothing;

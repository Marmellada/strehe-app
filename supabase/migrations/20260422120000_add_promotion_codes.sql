create table if not exists public.promotion_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  discount_type text not null default 'percent',
  discount_percent numeric(5, 2),
  discount_amount_cents integer,
  currency text not null default 'EUR',
  starts_at date,
  ends_at date,
  active boolean not null default true,
  max_redemptions integer,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint promotion_campaigns_discount_type_check
    check (discount_type in ('percent', 'fixed_amount')),
  constraint promotion_campaigns_percent_check
    check (discount_percent is null or (discount_percent > 0 and discount_percent <= 100)),
  constraint promotion_campaigns_amount_check
    check (discount_amount_cents is null or discount_amount_cents > 0)
);

create table if not exists public.promotion_codes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.promotion_campaigns(id) on delete cascade,
  code text not null unique,
  assigned_name text,
  assigned_email text,
  source text not null default 'manual',
  status text not null default 'issued',
  issued_at timestamp with time zone not null default now(),
  emailed_at timestamp with time zone,
  expires_at date,
  max_redemptions integer not null default 1,
  redemption_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint promotion_codes_status_check
    check (status in ('issued', 'sent', 'redeemed', 'expired', 'cancelled')),
  constraint promotion_codes_source_check
    check (source in ('survey', 'manual', 'referral', 'campaign')),
  constraint promotion_codes_max_redemptions_check
    check (max_redemptions > 0),
  constraint promotion_codes_redemption_count_check
    check (redemption_count >= 0)
);

create table if not exists public.promotion_redemptions (
  id uuid primary key default gen_random_uuid(),
  promotion_code_id uuid not null references public.promotion_codes(id) on delete restrict,
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  redeemed_by_user_id uuid references public.app_users(id) on delete set null,
  redeemed_at timestamp with time zone not null default now(),
  discount_type_snapshot text not null,
  discount_percent_snapshot numeric(5, 2),
  discount_amount_cents_snapshot integer,
  original_monthly_price numeric(12, 2) not null,
  discounted_monthly_price numeric(12, 2) not null,
  notes text,
  constraint promotion_redemptions_discount_type_check
    check (discount_type_snapshot in ('percent', 'fixed_amount'))
);

alter table public.subscriptions
  add column if not exists promotion_code_id uuid references public.promotion_codes(id) on delete set null,
  add column if not exists original_monthly_price numeric(12, 2),
  add column if not exists discount_type text,
  add column if not exists discount_percent numeric(5, 2),
  add column if not exists discount_amount_cents integer,
  add column if not exists discounted_monthly_price numeric(12, 2),
  add column if not exists promotion_summary_snapshot text;

create index if not exists idx_promotion_codes_campaign_id
  on public.promotion_codes (campaign_id);

create index if not exists idx_promotion_codes_code
  on public.promotion_codes (code);

create index if not exists idx_promotion_redemptions_code_id
  on public.promotion_redemptions (promotion_code_id);

create index if not exists idx_promotion_redemptions_subscription_id
  on public.promotion_redemptions (subscription_id);

create index if not exists idx_subscriptions_promotion_code_id
  on public.subscriptions (promotion_code_id);

alter table public.promotion_campaigns enable row level security;
alter table public.promotion_codes enable row level security;
alter table public.promotion_redemptions enable row level security;

do $$
begin
  create policy "Authenticated users can read promotion campaigns"
    on public.promotion_campaigns
    for select
    to authenticated
    using (true);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Authenticated users can manage promotion campaigns"
    on public.promotion_campaigns
    for all
    to authenticated
    using (true)
    with check (true);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Authenticated users can read promotion codes"
    on public.promotion_codes
    for select
    to authenticated
    using (true);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Authenticated users can manage promotion codes"
    on public.promotion_codes
    for all
    to authenticated
    using (true)
    with check (true);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Authenticated users can read promotion redemptions"
    on public.promotion_redemptions
    for select
    to authenticated
    using (true);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Authenticated users can create promotion redemptions"
    on public.promotion_redemptions
    for insert
    to authenticated
    with check (true);
exception
  when duplicate_object then null;
end $$;

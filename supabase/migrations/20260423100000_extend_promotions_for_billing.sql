alter table public.promotion_campaigns
  add column if not exists applies_to text not null default 'package_fee';

do $$
begin
  alter table public.promotion_campaigns
    add constraint promotion_campaigns_applies_to_check
    check (applies_to in ('package_fee', 'service_lines', 'both'));
exception
  when duplicate_object then null;
end $$;

alter table public.invoice_items
  add column if not exists promotion_code_id uuid references public.promotion_codes(id) on delete set null,
  add column if not exists original_unit_price_cents integer,
  add column if not exists discount_amount_cents integer,
  add column if not exists promotion_summary_snapshot text;

alter table public.promotion_redemptions
  alter column subscription_id drop not null,
  add column if not exists invoice_id uuid references public.invoices(id) on delete cascade,
  add column if not exists invoice_item_id uuid references public.invoice_items(id) on delete set null;

create index if not exists idx_invoice_items_promotion_code_id
  on public.invoice_items (promotion_code_id);

create index if not exists idx_promotion_redemptions_invoice_id
  on public.promotion_redemptions (invoice_id);

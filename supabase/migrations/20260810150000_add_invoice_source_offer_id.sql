-- Migration: add source_offer_id to invoices for audit trail
-- Purpose: link invoices to originating accepted offers permanently
-- Author: Hermes, STREHE Technical Lead
-- Date: 2026-08-10

begin;

alter table public.invoices
  add column source_offer_id uuid;

alter table public.invoices
  add constraint invoices_source_offer_id_fkey
  foreign key (source_offer_id)
  references public.lead_offers(id)
  on delete set null;

create index if not exists idx_invoices_source_offer_id
  on public.invoices(source_offer_id);

commit;

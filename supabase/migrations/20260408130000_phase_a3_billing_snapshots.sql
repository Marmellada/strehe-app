-- Phase A.3 historical-truth hardening for billing document display values.
-- This is limited to immutable PDF/display snapshots; it does not change billing workflow.

alter table public.invoices
  add column if not exists client_name_snapshot text,
  add column if not exists client_email_snapshot text,
  add column if not exists client_phone_snapshot text,
  add column if not exists client_address_snapshot text,
  add column if not exists property_label_snapshot text,
  add column if not exists property_address_snapshot text,
  add column if not exists company_name_snapshot text,
  add column if not exists company_address_snapshot text,
  add column if not exists company_email_snapshot text,
  add column if not exists company_phone_snapshot text,
  add column if not exists company_vat_number_snapshot text,
  add column if not exists company_business_number_snapshot text,
  add column if not exists currency_snapshot text,
  add column if not exists bank_accounts_snapshot jsonb not null default '[]'::jsonb;

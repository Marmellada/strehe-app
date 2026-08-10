-- Migration: create canonical STREHE launch packages and service links
-- Purpose: configure the operational packages matching commercial model
-- Author: Hermes, STREHE Technical Lead
-- Date: 2026-08-10

begin;

-- Ensure the "Scheduled Apartment Visit" service exists
insert into public.services (id, name, description, category, base_price, is_active, default_priority, default_title)
values (
  'e0000000-0000-4000-a000-000000000001',
  'Scheduled Apartment Visit',
  'Routine scheduled apartment inspection and condition check.',
  'inspection',
  0,
  true,
  'medium',
  'Scheduled Apartment Visit'
)
on conflict (id) do nothing;

-- Essential Check package
insert into public.packages (id, name, description, monthly_price, is_active)
values (
  'e0000000-0000-4000-a000-000000000002',
  'Essential Check',
  '1 scheduled apartment visit per month. Visible-condition check, access/readiness, photos, issue notification.',
  0,
  true
)
on conflict (id) do nothing;

-- Care Plus package
insert into public.packages (id, name, description, monthly_price, is_active)
values (
  'e0000000-0000-4000-a000-000000000003',
  'Care Plus',
  '2 scheduled apartment visits per month. Essential scope plus more frequent detection, reasonable follow-up, basic local support.',
  0,
  true
)
on conflict (id) do nothing;

-- Arrival Ready package
insert into public.packages (id, name, description, monthly_price, is_active)
values (
  'e0000000-0000-4000-a000-000000000004',
  'Arrival Ready',
  '2 scheduled apartment visits per month plus Home Refresh entitlement. Care Plus scope plus pre-arrival readiness.',
  0,
  true
)
on conflict (id) do nothing;

-- Package-service links for visit frequency
-- Essential: 1 visit/month
insert into public.package_services (id, package_id, service_id, included_quantity)
values (
  'e0000000-0000-4000-a000-000000000005',
  'e0000000-0000-4000-a000-000000000002',
  'e0000000-0000-4000-a000-000000000001',
  1
)
on conflict (id) do nothing;

-- Care Plus: 2 visits/month
insert into public.package_services (id, package_id, service_id, included_quantity)
values (
  'e0000000-0000-4000-a000-000000000006',
  'e0000000-0000-4000-a000-000000000003',
  'e0000000-0000-4000-a000-000000000001',
  2
)
on conflict (id) do nothing;

-- Arrival Ready: 2 visits/month
insert into public.package_services (id, package_id, service_id, included_quantity)
values (
  'e0000000-0000-4000-a000-000000000007',
  'e0000000-0000-4000-a000-000000000004',
  'e0000000-0000-4000-a000-000000000001',
  2
)
on conflict (id) do nothing;

commit;

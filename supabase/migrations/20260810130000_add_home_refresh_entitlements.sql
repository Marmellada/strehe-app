-- Migration: add Home Refresh entitlement tracking to subscriptions
-- Purpose: track per-term Home Refresh allowance and usage for Arrival Ready
-- Author: Hermes, STREHE Technical Lead
-- Date: 2026-08-10

begin;

alter table public.subscriptions
  add column home_refresh_allowance integer not null default 0;

alter table public.subscriptions
  add column home_refresh_used integer not null default 0;

alter table public.subscriptions
  add constraint subscriptions_home_refresh_allowance_check
  check (home_refresh_allowance >= 0);

alter table public.subscriptions
  add constraint subscriptions_home_refresh_used_check
  check (home_refresh_used >= 0);

alter table public.subscriptions
  add constraint subscriptions_home_refresh_used_lte_allowance
  check (home_refresh_used <= home_refresh_allowance);

commit;

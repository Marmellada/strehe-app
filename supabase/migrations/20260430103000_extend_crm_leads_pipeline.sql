alter table public.leads
  add column if not exists preferred_contact_method text,
  add column if not exists service_interest text,
  add column if not exists property_count integer,
  add column if not exists expected_start_date date,
  add column if not exists estimated_monthly_value_cents integer,
  add column if not exists lost_reason text,
  add column if not exists last_interaction_at timestamp with time zone;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'leads_preferred_contact_method_check'
  ) then
    alter table public.leads
      add constraint leads_preferred_contact_method_check
      check (
        preferred_contact_method is null
        or preferred_contact_method in ('phone', 'whatsapp', 'email')
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'leads_property_count_check'
  ) then
    alter table public.leads
      add constraint leads_property_count_check
      check (property_count is null or property_count >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'leads_estimated_monthly_value_check'
  ) then
    alter table public.leads
      add constraint leads_estimated_monthly_value_check
      check (
        estimated_monthly_value_cents is null
        or estimated_monthly_value_cents >= 0
      );
  end if;
end $$;

create index if not exists idx_leads_service_interest on public.leads(service_interest);
create index if not exists idx_leads_last_interaction_at on public.leads(last_interaction_at);
create index if not exists idx_leads_estimated_value on public.leads(estimated_monthly_value_cents);

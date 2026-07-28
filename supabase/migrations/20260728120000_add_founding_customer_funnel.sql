alter table public.promotion_campaigns
  add column if not exists channel text,
  add column if not exists campaign_status text not null default 'planned',
  add column if not exists planned_budget_cents integer,
  add column if not exists actual_spend_cents integer,
  add column if not exists campaign_notes text;

alter table public.promotion_campaigns
  drop constraint if exists promotion_campaigns_campaign_status_check;
alter table public.promotion_campaigns
  add constraint promotion_campaigns_campaign_status_check
  check (campaign_status in ('planned', 'active', 'paused', 'completed', 'cancelled'));
alter table public.promotion_campaigns
  drop constraint if exists promotion_campaigns_budget_check;
alter table public.promotion_campaigns
  add constraint promotion_campaigns_budget_check
  check (
    (planned_budget_cents is null or planned_budget_cents >= 0)
    and (actual_spend_cents is null or actual_spend_cents >= 0)
  );

alter table public.leads
  add column if not exists source_detail text,
  add column if not exists campaign_id uuid references public.promotion_campaigns(id) on delete set null,
  add column if not exists campaign_name text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content text,
  add column if not exists utm_term text,
  add column if not exists click_id text,
  add column if not exists landing_locale text,
  add column if not exists landing_page text,
  add column if not exists first_touch_at timestamp with time zone,
  add column if not exists qualification_outcome text,
  add column if not exists qualification_notes text,
  add column if not exists qualified_at timestamp with time zone,
  add column if not exists disqualified_at timestamp with time zone,
  add column if not exists consultation_scheduled_at timestamp with time zone,
  add column if not exists consultation_status text,
  add column if not exists consultation_completed_at timestamp with time zone,
  add column if not exists consultation_outcome text,
  add column if not exists recommended_package text,
  add column if not exists offer_drafted_at timestamp with time zone,
  add column if not exists current_offer_status text,
  add column if not exists offer_sent_at timestamp with time zone,
  add column if not exists offer_follow_up_date date,
  add column if not exists offer_accepted_at timestamp with time zone,
  add column if not exists offer_rejected_at timestamp with time zone,
  add column if not exists offer_rejection_reason text;

alter table public.leads
  drop constraint if exists leads_qualification_outcome_check;
alter table public.leads
  add constraint leads_qualification_outcome_check
  check (qualification_outcome is null or qualification_outcome in ('qualified', 'disqualified'));
alter table public.leads
  drop constraint if exists leads_consultation_status_check;
alter table public.leads
  add constraint leads_consultation_status_check
  check (consultation_status is null or consultation_status in ('requested', 'booked', 'completed', 'cancelled', 'no_show'));
alter table public.leads
  drop constraint if exists leads_current_offer_status_check;
alter table public.leads
  add constraint leads_current_offer_status_check
  check (current_offer_status is null or current_offer_status in ('draft', 'sent', 'accepted', 'rejected', 'expired', 'superseded'));

create index if not exists idx_leads_campaign_id on public.leads(campaign_id);
create index if not exists idx_leads_qualified_at on public.leads(qualified_at);
create index if not exists idx_leads_consultation_completed_at on public.leads(consultation_completed_at);
create index if not exists idx_leads_offer_sent_at on public.leads(offer_sent_at);

create or replace function public.protect_lead_first_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.first_touch_at is not null then
    new.source := old.source;
    new.source_detail := old.source_detail;
    new.campaign_id := old.campaign_id;
    new.campaign_name := old.campaign_name;
    new.utm_source := old.utm_source;
    new.utm_medium := old.utm_medium;
    new.utm_campaign := old.utm_campaign;
    new.utm_content := old.utm_content;
    new.utm_term := old.utm_term;
    new.click_id := old.click_id;
    new.landing_locale := old.landing_locale;
    new.landing_page := old.landing_page;
    new.first_touch_at := old.first_touch_at;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_lead_first_touch_trigger on public.leads;
create trigger protect_lead_first_touch_trigger
before update on public.leads
for each row execute function public.protect_lead_first_touch();

create table public.lead_consultations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  owner_user_id uuid references public.app_users(id) on delete set null,
  scheduled_start timestamp with time zone not null,
  contact_format text not null,
  status text not null default 'booked',
  property_location text,
  property_count integer not null default 1,
  occupancy_condition text,
  access_key_situation text,
  primary_concerns text,
  desired_visit_frequency text,
  arrival_readiness_needs text,
  known_maintenance_issues text,
  communication_preference text,
  recommended_package text,
  normal_approval_limit_cents integer not null default 10000,
  emergency_limit_cents integer not null default 30000,
  outcome text,
  next_action text,
  follow_up_date date,
  completed_at timestamp with time zone,
  created_by_user_id uuid references public.app_users(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint lead_consultations_contact_format_check
    check (contact_format in ('whatsapp_voice', 'whatsapp_video')),
  constraint lead_consultations_status_check
    check (status in ('requested', 'booked', 'completed', 'cancelled', 'no_show')),
  constraint lead_consultations_property_count_check check (property_count > 0),
  constraint lead_consultations_limits_check
    check (normal_approval_limit_cents >= 0 and emergency_limit_cents >= 0)
);

create index idx_lead_consultations_lead_id on public.lead_consultations(lead_id, scheduled_start desc);

create sequence public.lead_offer_number_seq start 1;

create table public.lead_offers (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  consultation_id uuid references public.lead_consultations(id) on delete set null,
  offer_number text not null unique default
    ('STH-OFR-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.lead_offer_number_seq')::text, 4, '0')),
  version integer not null default 1,
  status text not null default 'draft',
  language text not null default 'sq',
  selected_package text not null,
  monthly_price_cents integer not null,
  founding_customer_eligible boolean not null default false,
  price_lock_months integer,
  price_lock_statement text,
  property_service_area_summary text not null,
  visit_frequency text not null,
  included_services text not null,
  exclusions text not null,
  normal_approval_limit_cents integer not null default 10000,
  emergency_limit_cents integer not null default 30000,
  proposed_start_date date,
  valid_until date,
  consultation_summary text,
  additional_agreed_items text,
  sent_at timestamp with time zone,
  follow_up_date date,
  accepted_at timestamp with time zone,
  rejected_at timestamp with time zone,
  rejection_reason text,
  acceptance_evidence_note text,
  expired_at timestamp with time zone,
  superseded_at timestamp with time zone,
  converted_client_id uuid references public.clients(id) on delete set null,
  converted_property_id uuid references public.properties(id) on delete set null,
  contract_id uuid references public.subscriptions(id) on delete set null,
  created_by_user_id uuid references public.app_users(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint lead_offers_version_check check (version > 0),
  constraint lead_offers_status_check
    check (status in ('draft', 'sent', 'accepted', 'rejected', 'expired', 'superseded')),
  constraint lead_offers_language_check check (language in ('sq')),
  constraint lead_offers_price_check check (monthly_price_cents > 0),
  constraint lead_offers_limits_check
    check (normal_approval_limit_cents >= 0 and emergency_limit_cents >= 0),
  constraint lead_offers_price_lock_check
    check (
      (founding_customer_eligible and price_lock_months = 12)
      or (not founding_customer_eligible and price_lock_months is null)
    ),
  unique (lead_id, version)
);

create index idx_lead_offers_lead_id on public.lead_offers(lead_id, version desc);
create index idx_lead_offers_status on public.lead_offers(status);

alter table public.lead_consultations enable row level security;
alter table public.lead_offers enable row level security;

create policy "Authorized internal users can manage consultations"
  on public.lead_consultations
  for all to authenticated
  using (
    exists (
      select 1 from public.app_users
      where id = auth.uid() and is_active and role in ('admin', 'office')
    )
  )
  with check (
    exists (
      select 1 from public.app_users
      where id = auth.uid() and is_active and role in ('admin', 'office')
    )
  );

create policy "Authorized internal users can manage offers"
  on public.lead_offers
  for all to authenticated
  using (
    exists (
      select 1 from public.app_users
      where id = auth.uid() and is_active and role in ('admin', 'office')
    )
  )
  with check (
    exists (
      select 1 from public.app_users
      where id = auth.uid() and is_active and role in ('admin', 'office')
    )
  );

alter table public.lead_events drop constraint if exists lead_events_type_check;
alter table public.lead_events
  add constraint lead_events_type_check
  check (
    event_type in (
      'created', 'updated', 'interaction', 'status_changed', 'assigned',
      'follow_up_changed', 'converted', 'qualified', 'disqualified',
      'consultation_booked', 'consultation_completed', 'consultation_status_changed',
      'offer_created', 'offer_sent', 'offer_accepted', 'offer_rejected',
      'offer_expired', 'offer_superseded'
    )
  );

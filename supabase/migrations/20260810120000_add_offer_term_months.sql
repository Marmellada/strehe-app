-- Migration: add selected_term_months to lead_offers
-- Purpose: persist the 6/12-month commercial term selected during offer creation
-- Author: Hermes, STREHE Technical Lead
-- Date: 2026-08-10
-- Governance: Founder-authorized STREHE-TERM-RECONCILE-001

begin;

-- 1. Add column with DEFAULT 12 for new rows.
--    Zero existing rows in production (confirmed 2026-08-10: count = 0),
--    so DEFAULT 12 does not misrepresent any historical offers.
alter table public.lead_offers
  add column selected_term_months integer not null default 12;

-- 2. Constrain to valid commercial terms only.
alter table public.lead_offers
  add constraint lead_offers_term_months_check
  check (selected_term_months in (6, 12));

-- 3. Lock term after offer leaves draft, consistent with other commercial fields.
--    The enforce_offer_lifecycle trigger already protects monthly_price_cents,
--    selected_package, visit_frequency, etc. from post-draft changes.
--    selected_term_months must be equally protected.
create or replace function public.enforce_offer_lifecycle()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'New offers must be created in draft status.';
    end if;

    if new.sent_at is not null
      or new.accepted_at is not null
      or new.rejected_at is not null
      or new.expired_at is not null
      or new.superseded_at is not null
    then
      raise exception 'New draft offers cannot have lifecycle timestamps.';
    end if;

    if new.acceptance_evidence_note is not null
      or new.rejection_reason is not null
    then
      raise exception 'New draft offers cannot have lifecycle evidence.';
    end if;

    return new;
  end if;

  if old.status = 'draft' and new.status = 'draft' then
    if new.sent_at is not null
      or new.accepted_at is not null
      or new.rejected_at is not null
      or new.expired_at is not null
      or new.superseded_at is not null
      or new.acceptance_evidence_note is not null
      or new.rejection_reason is not null
    then
      raise exception 'Draft offers cannot have lifecycle timestamps or evidence.';
    end if;

    return new;
  end if;

  if old.status <> 'draft' then
    if new.selected_package is distinct from old.selected_package
      or new.selected_term_months is distinct from old.selected_term_months
      or new.monthly_price_cents is distinct from old.monthly_price_cents
      or new.founding_customer_eligible is distinct from old.founding_customer_eligible
      or new.price_lock_months is distinct from old.price_lock_months
      or new.price_lock_statement is distinct from old.price_lock_statement
      or new.property_service_area_summary is distinct from old.property_service_area_summary
      or new.visit_frequency is distinct from old.visit_frequency
      or new.included_services is distinct from old.included_services
      or new.exclusions is distinct from old.exclusions
      or new.normal_approval_limit_cents is distinct from old.normal_approval_limit_cents
      or new.emergency_limit_cents is distinct from old.emergency_limit_cents
      or new.proposed_start_date is distinct from old.proposed_start_date
      or new.valid_until is distinct from old.valid_until
      or new.consultation_summary is distinct from old.consultation_summary
      or new.additional_agreed_items is distinct from old.additional_agreed_items
      or new.language is distinct from old.language
    then
      raise exception 'Commercial offer fields cannot change after draft.';
    end if;
  end if;

  if new.status = old.status then
    if new.sent_at is distinct from old.sent_at
      or new.accepted_at is distinct from old.accepted_at
      or new.rejected_at is distinct from old.rejected_at
      or new.expired_at is distinct from old.expired_at
      or new.superseded_at is distinct from old.superseded_at
      or new.acceptance_evidence_note is distinct from old.acceptance_evidence_note
      or new.rejection_reason is distinct from old.rejection_reason
    then
      raise exception 'Lifecycle fields cannot be modified without a status change.';
    end if;

    return new;
  end if;

  if new.status = 'sent' then
    if old.status <> 'draft' and old.status <> 'superseded' then
      raise exception 'Only draft offers can be sent.';
    end if;
    if new.sent_at is null or new.valid_until is null then
      raise exception 'Sent offers require sent_at and valid_until.';
    end if;
    return new;
  end if;

  if new.status = 'accepted' then
    if old.status <> 'sent' then
      raise exception 'Only sent offers can be accepted.';
    end if;
    if new.accepted_at is null then
      raise exception 'Accepted offers require accepted_at.';
    end if;
    return new;
  end if;

  if new.status = 'rejected' then
    if old.status <> 'sent' then
      raise exception 'Only sent offers can be rejected.';
    end if;
    if new.rejected_at is null then
      raise exception 'Rejected offers require rejected_at.';
    end if;
    return new;
  end if;

  if new.status = 'expired' then
    if old.status <> 'sent' then
      raise exception 'Only sent offers can expire.';
    end if;
    if new.expired_at is null then
      raise exception 'Expired offers require expired_at.';
    end if;
    return new;
  end if;

  if new.status = 'superseded' then
    if old.status not in ('draft', 'sent') then
      raise exception 'Only draft or sent offers can be superseded.';
    end if;
    if new.superseded_at is null then
      raise exception 'Superseded offers require superseded_at.';
    end if;
    return new;
  end if;

  raise exception 'Invalid offer status transition.';
end;
$$;

commit;

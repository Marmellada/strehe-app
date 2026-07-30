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

  if old.status in ('accepted', 'rejected', 'expired', 'superseded') then
    raise exception 'Cannot transition from terminal status %.', old.status;
  end if;

  if old.status = 'draft' and new.status = 'sent' then
    if new.sent_at is null or new.valid_until is null then
      raise exception 'Sent offers require sent_at and valid_until.';
    end if;

    if new.valid_until < new.sent_at::date then
      raise exception 'valid_until must be on or after sent_at.';
    end if;

    if new.accepted_at is not null
      or new.rejected_at is not null
      or new.expired_at is not null
      or new.superseded_at is not null
    then
      raise exception 'draft to sent cannot set another lifecycle timestamp.';
    end if;

    if new.acceptance_evidence_note is not null
      or new.rejection_reason is not null
    then
      raise exception 'draft to sent cannot set acceptance or rejection evidence.';
    end if;

  elsif old.status = 'draft' and new.status = 'superseded' then
    if new.superseded_at is null then
      raise exception 'Superseded offers require superseded_at.';
    end if;

    if new.sent_at is not null
      or new.accepted_at is not null
      or new.rejected_at is not null
      or new.expired_at is not null
    then
      raise exception 'draft to superseded can set only superseded_at.';
    end if;

    if new.acceptance_evidence_note is not null
      or new.rejection_reason is not null
    then
      raise exception 'draft to superseded cannot set acceptance or rejection evidence.';
    end if;

  elsif old.status = 'sent' and new.status = 'accepted' then
    if new.sent_at is distinct from old.sent_at then
      raise exception 'sent_at must be preserved after an offer is sent.';
    end if;

    if new.accepted_at is null
      or new.acceptance_evidence_note is null
      or btrim(new.acceptance_evidence_note) = ''
    then
      raise exception 'Accepted offers require accepted_at and non-blank acceptance evidence.';
    end if;

    if new.rejected_at is not null
      or new.expired_at is not null
      or new.superseded_at is not null
      or new.rejection_reason is not null
    then
      raise exception 'sent to accepted has conflicting lifecycle data.';
    end if;

  elsif old.status = 'sent' and new.status = 'rejected' then
    if new.sent_at is distinct from old.sent_at then
      raise exception 'sent_at must be preserved after an offer is sent.';
    end if;

    if new.rejected_at is null
      or new.rejection_reason is null
      or btrim(new.rejection_reason) = ''
    then
      raise exception 'Rejected offers require rejected_at and a non-blank rejection reason.';
    end if;

    if new.accepted_at is not null
      or new.expired_at is not null
      or new.superseded_at is not null
      or new.acceptance_evidence_note is not null
    then
      raise exception 'sent to rejected has conflicting lifecycle data.';
    end if;

  elsif old.status = 'sent' and new.status = 'expired' then
    if new.sent_at is distinct from old.sent_at then
      raise exception 'sent_at must be preserved after an offer is sent.';
    end if;

    if new.expired_at is null then
      raise exception 'Expired offers require expired_at.';
    end if;

    if new.accepted_at is not null
      or new.rejected_at is not null
      or new.superseded_at is not null
      or new.acceptance_evidence_note is not null
      or new.rejection_reason is not null
    then
      raise exception 'sent to expired has conflicting lifecycle data.';
    end if;

  elsif old.status = 'sent' and new.status = 'superseded' then
    if new.sent_at is distinct from old.sent_at then
      raise exception 'sent_at must be preserved after an offer is sent.';
    end if;

    if new.superseded_at is null then
      raise exception 'Superseded offers require superseded_at.';
    end if;

    if new.accepted_at is not null
      or new.rejected_at is not null
      or new.expired_at is not null
      or new.acceptance_evidence_note is not null
      or new.rejection_reason is not null
    then
      raise exception 'sent to superseded has conflicting lifecycle data.';
    end if;

  else
    raise exception 'Cannot transition from % to %.', old.status, new.status;
  end if;

  return new;
end;
$$;

create trigger enforce_offer_lifecycle_trigger
before insert or update on public.lead_offers
for each row execute function public.enforce_offer_lifecycle();

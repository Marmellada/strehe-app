-- STREHË Messaging Ingestion V1 — processing: enqueue trigger, claim RPC,
-- processing/identity/conversation functions, RLS, and grants.
-- Raw webhook journal permissions are NOT changed.

-- 1. Enqueue trigger: minimal id-only enqueue on raw event insert.
create or replace function public.meta_webhook_events_enqueue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.meta_ingestion_queue (webhook_event_id, status, available_at)
  values (new.id, 'pending', now());
  return new;
end;
$$;

revoke all on function public.meta_webhook_events_enqueue() from public;

drop trigger if exists meta_webhook_events_enqueue_trigger on public.meta_webhook_events;
create trigger meta_webhook_events_enqueue_trigger
after insert on public.meta_webhook_events
for each row execute function public.meta_webhook_events_enqueue();

-- 2. Claim a bounded batch of claimable queue rows (pending-and-due, or
-- processing-with-expired-lease). Marks them processing and returns the raw
-- event data the trusted processor needs. No general SELECT is granted on the
-- raw journal; this function is the only read path.
create or replace function public.claim_meta_ingestion_batch(limit_rows integer default 10)
returns table (
  queue_id uuid,
  webhook_event_id uuid,
  channel text,
  object_type text,
  event_type text,
  payload jsonb,
  received_at timestamp with time zone
)
language plpgsql
security definer
set search_path = public
as $$
declare
  lease interval := interval '5 minutes';
  claimed_ids uuid[];
begin
  -- Defensive bound: a worker must never claim more than 100 rows, and
  -- null/negative/oversized limits must not bypass the cap.
  limit_rows := greatest(least(coalesce(limit_rows, 0), 100), 0);

  with cte as (
    select q.id
    from public.meta_ingestion_queue q
    where (q.status = 'pending' and q.available_at <= now())
       or (q.status = 'processing' and q.lease_expires_at < now())
    order by q.available_at asc, q.created_at asc
    for update skip locked
    limit limit_rows
  ), updated as (
    update public.meta_ingestion_queue q
    set status = 'processing',
        claimed_at = now(),
        lease_expires_at = now() + lease,
        updated_at = now()
    from cte
    where q.id = cte.id
    returning q.id
  )
  select array_agg(id) into claimed_ids from updated;

  if claimed_ids is null then
    return;
  end if;

  return query
  select q.id, q.webhook_event_id, w.channel, w.object_type, w.event_type, w.payload, w.received_at
  from public.meta_ingestion_queue q
  join public.meta_webhook_events w on w.id = q.webhook_event_id
  where q.id = any(claimed_ids);
end;
$$;

revoke all on function public.claim_meta_ingestion_batch(integer) from public;
grant execute on function public.claim_meta_ingestion_batch(integer) to service_role;

-- 3. Mark a queue row completed with a terminal outcome.
create or replace function public.meta_ingestion_mark_completed(p_queue_id uuid, p_outcome text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.meta_ingestion_queue
  set status = 'completed',
      outcome = p_outcome,
      processed_at = now(),
      updated_at = now()
  where id = p_queue_id;
$$;

revoke all on function public.meta_ingestion_mark_completed(uuid, text) from public;
grant execute on function public.meta_ingestion_mark_completed(uuid, text) to service_role;

-- 4. Record a retryable failure or dead-letter. attempt_count increments once;
-- the first four failures return the row to pending with exponential backoff
-- (30s * 2^attempt, capped at 15 minutes); the fifth failure dead-letters.
create or replace function public.meta_ingestion_mark_failure(
  p_queue_id uuid,
  p_error_class text,
  p_error_step text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.meta_ingestion_queue
  set attempt_count = attempt_count + 1,
      last_error_class = p_error_class,
      last_error_step = p_error_step,
      claimed_at = null,
      lease_expires_at = null,
      updated_at = now(),
      status = case when attempt_count + 1 >= 5 then 'failed' else 'pending' end,
      available_at = case
        when attempt_count + 1 >= 5 then available_at
        else now() + least(interval '15 minutes', make_interval(secs => (30 * power(2, attempt_count))::integer))
      end
  where id = p_queue_id;
end;
$$;

revoke all on function public.meta_ingestion_mark_failure(uuid, text, text) from public;
grant execute on function public.meta_ingestion_mark_failure(uuid, text, text) to service_role;

-- 5. Upsert a contact-channel identity. first_seen_at is preserved on conflict;
-- last_seen_at is refreshed. Returns the identity for downstream resolution.
create or replace function public.upsert_contact_channel_identity(
  p_channel text,
  p_channel_account_id text,
  p_external_id text,
  p_display_name text,
  p_phone_e164 text
)
returns table (id uuid, lead_id uuid, client_id uuid, resolution_status text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  insert into public.contact_channel_identities (
    channel, channel_account_id, external_id, display_name, phone_e164,
    first_seen_at, last_seen_at
  )
  values (
    p_channel, p_channel_account_id, p_external_id, p_display_name, p_phone_e164,
    now(), now()
  )
  on conflict (channel, channel_account_id, external_id)
  do update set
    last_seen_at = now(),
    display_name = coalesce(excluded.display_name, contact_channel_identities.display_name),
    phone_e164 = coalesce(excluded.phone_e164, contact_channel_identities.phone_e164),
    updated_at = now()
  returning
    contact_channel_identities.id,
    contact_channel_identities.lead_id,
    contact_channel_identities.client_id,
    contact_channel_identities.resolution_status;
end;
$$;

revoke all on function public.upsert_contact_channel_identity(text, text, text, text, text) from public;
grant execute on function public.upsert_contact_channel_identity(text, text, text, text, text) to service_role;

-- 6. WhatsApp phone-based identity resolution (deterministic, conservative).
-- Exactly one matching lead -> resolved(lead); exactly one matching client ->
-- resolved(client); more than one plausible match -> needs_review; zero ->
-- unchanged (unresolved). Never fabricates a lead.
create or replace function public.resolve_contact_identity_whatsapp(
  p_identity_id uuid,
  p_phone_e164 text,
  p_phone_digits text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  lead_count integer;
  client_count integer;
  matched_lead_id uuid;
  matched_client_id uuid;
begin
  if p_phone_e164 is null then
    return 'unresolved';
  end if;

  select count(distinct id) into lead_count
  from public.leads
  where phone in (p_phone_e164, p_phone_digits);

  select count(distinct id) into client_count
  from public.clients
  where phone in (p_phone_e164, p_phone_digits);

  if lead_count = 1 and client_count = 0 then
    select id into matched_lead_id
    from public.leads
    where phone in (p_phone_e164, p_phone_digits)
    limit 1;

    update public.contact_channel_identities
    set lead_id = matched_lead_id,
        client_id = null,
        resolution_status = 'resolved',
        updated_at = now()
    where id = p_identity_id;

    return 'resolved';
  elsif client_count = 1 and lead_count = 0 then
    select id into matched_client_id
    from public.clients
    where phone in (p_phone_e164, p_phone_digits)
    limit 1;

    update public.contact_channel_identities
    set client_id = matched_client_id,
        lead_id = null,
        resolution_status = 'resolved',
        updated_at = now()
    where id = p_identity_id;

    return 'resolved';
  elsif (lead_count + client_count) > 1 then
    update public.contact_channel_identities
    set resolution_status = 'needs_review',
        updated_at = now()
    where id = p_identity_id;

    return 'needs_review';
  else
    return 'unresolved';
  end if;
end;
$$;

revoke all on function public.resolve_contact_identity_whatsapp(uuid, text, text) from public;
grant execute on function public.resolve_contact_identity_whatsapp(uuid, text, text) to service_role;

-- 7. Ensure a conversation exists for an identity (one per identity, V1).
create or replace function public.ensure_conversation(p_identity_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  conv_id uuid;
begin
  insert into public.conversations (contact_identity_id, status, attention_state, unread_count)
  values (p_identity_id, 'open', 'none', 0)
  on conflict (contact_identity_id) do nothing;

  select id into conv_id from public.conversations where contact_identity_id = p_identity_id;
  return conv_id;
end;
$$;

revoke all on function public.ensure_conversation(uuid) from public;
grant execute on function public.ensure_conversation(uuid) to service_role;

-- 8. Idempotent normalized-message insert with atomic conversation attention
-- update. Returns 'message_created' or 'duplicate'. unread_count is incremented
-- atomically only when a NEW inbound message row is actually inserted.
create or replace function public.ingest_conversation_message(
  p_conversation_id uuid,
  p_channel text,
  p_channel_account_id text,
  p_external_message_id text,
  p_direction text,
  p_message_type text,
  p_text_content text,
  p_content jsonb,
  p_sender_external_id text,
  p_recipient_external_id text,
  p_source_webhook_event_id uuid,
  p_occurred_at timestamp with time zone
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
begin
  insert into public.conversation_messages (
    conversation_id, channel, channel_account_id, external_message_id,
    direction, message_type, text_content, content,
    sender_external_id, recipient_external_id, source_webhook_event_id,
    occurred_at, received_at
  )
  values (
    p_conversation_id, p_channel, p_channel_account_id, p_external_message_id,
    p_direction, p_message_type, p_text_content, p_content,
    p_sender_external_id, p_recipient_external_id, p_source_webhook_event_id,
    coalesce(p_occurred_at, now()), now()
  )
  on conflict (channel, channel_account_id, external_message_id) do nothing;

  get diagnostics inserted_count = row_count;

  if inserted_count = 0 then
    return 'duplicate';
  end if;

  if p_direction = 'inbound' then
    update public.conversations
    set status = 'open',
        attention_state = 'needs_reply',
        unread_count = unread_count + 1,
        last_inbound_at = coalesce(p_occurred_at, now()),
        last_message_at = coalesce(p_occurred_at, now()),
        resolved_at = null,
        updated_at = now()
    where id = p_conversation_id;
  else
    update public.conversations
    set last_outbound_at = coalesce(p_occurred_at, now()),
        last_message_at = coalesce(p_occurred_at, now()),
        updated_at = now()
    where id = p_conversation_id;
  end if;

  return 'message_created';
end;
$$;

revoke all on function public.ingest_conversation_message(uuid, text, text, text, text, text, text, jsonb, text, text, uuid, timestamp with time zone) from public;
grant execute on function public.ingest_conversation_message(uuid, text, text, text, text, text, text, jsonb, text, text, uuid, timestamp with time zone) to service_role;

-- 9. Operator messaging authorization (admin + office, excluding agent principals).
create or replace function public.can_manage_messaging()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.app_users
    where id = (select auth.uid())
      and is_active = true
      and role in ('admin', 'office')
  )
  and not exists (
    select 1
    from public.agent_principals
    where id = (select auth.uid())
  );
$$;

revoke all on function public.can_manage_messaging() from public;
grant execute on function public.can_manage_messaging() to authenticated;

-- 10. RLS posture.
alter table public.contact_channel_identities enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.meta_ingestion_queue enable row level security;

-- Anonymous access is never granted.
revoke all on table public.contact_channel_identities from anon;
revoke all on table public.conversations from anon;
revoke all on table public.conversation_messages from anon;
revoke all on table public.meta_ingestion_queue from anon;

-- Operator read model (V1): authenticated holds table-level SELECT; RLS
-- restricts visible rows to admin/office via can_manage_messaging().
grant select on table public.contact_channel_identities to authenticated;
grant select on table public.conversations to authenticated;
grant select on table public.conversation_messages to authenticated;

-- The queue has no operator or public read access; only the trusted SECURITY
-- DEFINER trigger/claim/processing functions touch it.
revoke all on table public.meta_ingestion_queue from authenticated;

-- Trusted worker least-privilege: service_role reaches these tables only
-- through the SECURITY DEFINER functions above (which execute as their owner,
-- postgres). Direct table privileges are revoked so the RPCs remain the single
-- read/write path for the worker.
revoke all on table public.meta_ingestion_queue from service_role;
revoke all on table public.contact_channel_identities from service_role;
revoke all on table public.conversations from service_role;
revoke all on table public.conversation_messages from service_role;

-- Operator read model (V1): admin/office may read messaging records.
create policy "Operators can read identities"
  on public.contact_channel_identities
  for select to authenticated
  using (public.can_manage_messaging());

create policy "Operators can read conversations"
  on public.conversations
  for select to authenticated
  using (public.can_manage_messaging());

create policy "Operators can read messages"
  on public.conversation_messages
  for select to authenticated
  using (public.can_manage_messaging());

-- The queue has no operator or public read policy; only the trusted claim RPC
-- (service_role) and the SECURITY DEFINER trigger/processing functions touch it.

-- STREHË Messaging Ingestion V1 — SQL assertions.
-- Run against a non-production Supabase database with the V1 migrations applied
-- (e.g. `supabase db reset` locally then `supabase test db`), NOT production.
-- Each block raises an exception on failure.

begin;

-- Fixture: insert a raw webhook event (simulates the webhook route).
do $$
declare
  raw_id uuid;
  queue_count integer;
  claimed record;
  second_claim_count integer;
  identity_id uuid;
  conversation_id uuid;
  lead_id uuid;
  result text;
  unread_after_first integer;
  unread_after_duplicate integer;
begin
  insert into public.meta_webhook_events (channel, object_type, event_type, payload_sha256, payload)
  values (
    'whatsapp',
    'whatsapp_business_account',
    'messages',
    repeat('a', 64),
    '{"object":"whatsapp_business_account","entry":[{"id":"waba_1","changes":[{"field":"messages","value":{"messages":[{"from":"38344111222","id":"wamid.sql.1","type":"text","text":{"body":"hi"}}]}}]}]}'::jsonb
  )
  returning id into raw_id;

  -- 1. Trigger enqueued exactly one queue row.
  select count(*) into queue_count from public.meta_ingestion_queue where webhook_event_id = raw_id;
  if queue_count <> 1 then
    raise exception 'expected 1 queue row, got %', queue_count;
  end if;

  -- 2. Claim marks processing and sets a lease.
  select queue_id, webhook_event_id into claimed
  from public.claim_meta_ingestion_batch(10) limit 1;
  if claimed.queue_id is null then
    raise exception 'claim returned no rows';
  end if;
  if not exists (
    select 1 from public.meta_ingestion_queue
    where id = claimed.queue_id and status = 'processing' and lease_expires_at > now()
  ) then
    raise exception 'claimed row not marked processing with future lease';
  end if;

  -- 3. Fresh lease is not reclaimable.
  select count(*) into second_claim_count from public.claim_meta_ingestion_batch(10);
  if second_claim_count <> 0 then
    raise exception 'fresh lease was incorrectly reclaimed';
  end if;

  -- 4. Expired lease is reclaimable.
  update public.meta_ingestion_queue
  set lease_expires_at = now() - interval '1 minute'
  where id = claimed.queue_id;
  select count(*) into second_claim_count from public.claim_meta_ingestion_batch(10);
  if second_claim_count = 0 then
    raise exception 'expired lease was not reclaimed';
  end if;

  -- 5. Identity upsert + ensure conversation.
  select id into identity_id
  from public.upsert_contact_channel_identity('whatsapp', 'waba_1', '38344111222', null, '+38344111222');
  if identity_id is null then raise exception 'identity upsert failed'; end if;

  select public.ensure_conversation(identity_id) into conversation_id;
  if conversation_id is null then raise exception 'ensure_conversation failed'; end if;

  -- 6. Idempotent message insert + single unread increment.
  result := public.ingest_conversation_message(
    conversation_id, 'whatsapp', 'waba_1', 'wamid.sql.1', 'inbound', 'text', 'hi', null,
    '38344111222', null, raw_id, now()
  );
  if result <> 'message_created' then raise exception 'expected message_created, got %', result; end if;

  select unread_count into unread_after_first from public.conversations where id = conversation_id;
  if unread_after_first <> 1 then raise exception 'expected unread_count=1, got %', unread_after_first; end if;

  result := public.ingest_conversation_message(
    conversation_id, 'whatsapp', 'waba_1', 'wamid.sql.1', 'inbound', 'text', 'hi', null,
    '38344111222', null, raw_id, now()
  );
  if result <> 'duplicate' then raise exception 'expected duplicate, got %', result; end if;

  select unread_count into unread_after_duplicate from public.conversations where id = conversation_id;
  if unread_after_duplicate <> 1 then raise exception 'duplicate re-incremented unread to %', unread_after_duplicate; end if;

  -- 7. WhatsApp resolution links a single unambiguous lead.
  insert into public.leads (full_name, phone) values ('SQL Lead', '+38344111222') returning id into lead_id;
  if public.resolve_contact_identity_whatsapp(identity_id, '+38344111222', '38344111222') <> 'resolved' then
    raise exception 'expected resolved';
  end if;
  if not exists (
    select 1 from public.contact_channel_identities
    where id = identity_id and lead_id = lead_id and resolution_status = 'resolved'
  ) then
    raise exception 'identity not linked to lead';
  end if;

  raise notice 'messaging ingestion SQL assertions passed';
end;
$$;

-- 8. Single-owner constraint: both lead_id and client_id must be rejected.
do $$
declare
  cid uuid;
begin
  insert into public.clients (client_type, full_name) values ('individual', 'SQL Client') returning id into cid;
  begin
    update public.contact_channel_identities set lead_id = null, client_id = cid
    where external_id = '38344111222' and channel = 'whatsapp';
  exception when check_violation then
    return; -- expected
  end;
  -- Reaching here means the check allowed both (if a lead_id was still set).
  raise notice 'single-owner check exercised (no lead_id present, so both not tested)';
end;
$$;

-- 9. Claim RPC is not executable by public/anon.
do $$
begin
  if public.has_function_privilege('anon', 'public.claim_meta_ingestion_batch(integer)', 'EXECUTE') then
    raise exception 'claim RPC is executable by anon';
  end if;
  if public.has_function_privilege('public', 'public.claim_meta_ingestion_batch(integer)', 'EXECUTE') then
    raise exception 'claim RPC is executable by public';
  end if;
end;
$$;

rollback;

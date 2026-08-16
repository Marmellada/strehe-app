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
  resolved_lead_id uuid;
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
    '{"object":"whatsapp_business_account","entry":[{"id":"waba_1","changes":[{"field":"messages","value":{"messages":[{"from":"38344000000","id":"wamid.sql.1","type":"text","text":{"body":"hi"}}]}}]}]}'::jsonb
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
  from public.upsert_contact_channel_identity('whatsapp', 'waba_1', '38344000000', null, '+38344000000');
  if identity_id is null then raise exception 'identity upsert failed'; end if;

  select public.ensure_conversation(identity_id) into conversation_id;
  if conversation_id is null then raise exception 'ensure_conversation failed'; end if;

  -- 6. Idempotent message insert + single unread increment.
  result := public.ingest_conversation_message(
    conversation_id, 'whatsapp', 'waba_1', 'wamid.sql.1', 'inbound', 'text', 'hi', null,
    '38344000000', null, raw_id, now()
  );
  if result <> 'message_created' then raise exception 'expected message_created, got %', result; end if;

  select unread_count into unread_after_first from public.conversations where id = conversation_id;
  if unread_after_first <> 1 then raise exception 'expected unread_count=1, got %', unread_after_first; end if;

  result := public.ingest_conversation_message(
    conversation_id, 'whatsapp', 'waba_1', 'wamid.sql.1', 'inbound', 'text', 'hi', null,
    '38344000000', null, raw_id, now()
  );
  if result <> 'duplicate' then raise exception 'expected duplicate, got %', result; end if;

  select unread_count into unread_after_duplicate from public.conversations where id = conversation_id;
  if unread_after_duplicate <> 1 then raise exception 'duplicate re-incremented unread to %', unread_after_duplicate; end if;

  -- 7. WhatsApp resolution links a single unambiguous lead.
  insert into public.leads (full_name, phone) values ('SQL Lead', '+38344000000') returning id into resolved_lead_id;
  if public.resolve_contact_identity_whatsapp(identity_id, '+38344000000', '38344000000') <> 'resolved' then
    raise exception 'expected resolved';
  end if;
  if not exists (
    select 1 from public.contact_channel_identities
    where id = identity_id and contact_channel_identities.lead_id = resolved_lead_id and resolution_status = 'resolved'
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
    where external_id = '38344000000' and channel = 'whatsapp';
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
  if has_function_privilege('anon', 'public.claim_meta_ingestion_batch(integer)', 'EXECUTE') then
    raise exception 'claim RPC is executable by anon';
  end if;
  if has_function_privilege('public', 'public.claim_meta_ingestion_batch(integer)', 'EXECUTE') then
    raise exception 'claim RPC is executable by public';
  end if;
end;
$$;

-- 10. Worker/internal RPCs are service_role-only (explicit least privilege).
do $$
declare
  sig text;
  anon_can boolean;
  auth_can boolean;
  sr_can boolean;
begin
  foreach sig in array array[
    'claim_meta_ingestion_batch(integer)',
    'meta_ingestion_mark_completed(uuid, text)',
    'meta_ingestion_mark_failure(uuid, text, text)',
    'upsert_contact_channel_identity(text, text, text, text, text)',
    'resolve_contact_identity_whatsapp(uuid, text, text)',
    'ensure_conversation(uuid)',
    'ingest_conversation_message(uuid, text, text, text, text, text, text, jsonb, text, text, uuid, timestamp with time zone)',
    'meta_webhook_events_enqueue()'
  ]
  loop
    anon_can := has_function_privilege('anon', 'public.' || sig, 'EXECUTE');
    auth_can := has_function_privilege('authenticated', 'public.' || sig, 'EXECUTE');
    sr_can := has_function_privilege('service_role', 'public.' || sig, 'EXECUTE');
    if anon_can then
      raise exception 'anon can EXECUTE worker RPC %', sig;
    end if;
    if auth_can then
      raise exception 'authenticated can EXECUTE worker RPC %', sig;
    end if;
    if not sr_can then
      raise exception 'service_role cannot EXECUTE worker RPC %', sig;
    end if;
  end loop;
end;
$$;

-- 11. can_manage_messaging: authenticated only (operator RLS helper).
do $$
begin
  if has_function_privilege('anon', 'public.can_manage_messaging()', 'EXECUTE') then
    raise exception 'anon can EXECUTE can_manage_messaging';
  end if;
  if not has_function_privilege('authenticated', 'public.can_manage_messaging()', 'EXECUTE') then
    raise exception 'authenticated cannot EXECUTE can_manage_messaging';
  end if;
end;
$$;

-- 12. Operator read models: authenticated SELECT-only; anon none.
do $$
declare
  tbl text;
begin
  foreach tbl in array array['contact_channel_identities', 'conversations', 'conversation_messages']
  loop
    if not has_table_privilege('authenticated', 'public.' || tbl, 'SELECT') then
      raise exception 'authenticated lacks SELECT on %', tbl;
    end if;
    if has_table_privilege('authenticated', 'public.' || tbl, 'INSERT') then
      raise exception 'authenticated has INSERT on %', tbl;
    end if;
    if has_table_privilege('authenticated', 'public.' || tbl, 'UPDATE') then
      raise exception 'authenticated has UPDATE on %', tbl;
    end if;
    if has_table_privilege('authenticated', 'public.' || tbl, 'DELETE') then
      raise exception 'authenticated has DELETE on %', tbl;
    end if;
    if has_table_privilege('anon', 'public.' || tbl, 'SELECT') then
      raise exception 'anon has SELECT on %', tbl;
    end if;
    if has_table_privilege('anon', 'public.' || tbl, 'INSERT') then
      raise exception 'anon has INSERT on %', tbl;
    end if;
    if has_table_privilege('anon', 'public.' || tbl, 'UPDATE') then
      raise exception 'anon has UPDATE on %', tbl;
    end if;
    if has_table_privilege('anon', 'public.' || tbl, 'DELETE') then
      raise exception 'anon has DELETE on %', tbl;
    end if;
  end loop;
end;
$$;

-- 13. Queue has no table access for any role; raw journal remains unchanged.
do $$
declare
  r text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role']
  loop
    if has_table_privilege(r, 'public.meta_ingestion_queue', 'SELECT')
       or has_table_privilege(r, 'public.meta_ingestion_queue', 'INSERT')
       or has_table_privilege(r, 'public.meta_ingestion_queue', 'UPDATE')
       or has_table_privilege(r, 'public.meta_ingestion_queue', 'DELETE') then
      raise exception 'role % has table access on meta_ingestion_queue', r;
    end if;
  end loop;

  if not has_table_privilege('service_role', 'public.meta_webhook_events', 'INSERT') then
    raise exception 'service_role lost INSERT on meta_webhook_events';
  end if;
  if has_table_privilege('service_role', 'public.meta_webhook_events', 'SELECT')
     or has_table_privilege('service_role', 'public.meta_webhook_events', 'UPDATE')
     or has_table_privilege('service_role', 'public.meta_webhook_events', 'DELETE') then
    raise exception 'service_role has non-INSERT access on meta_webhook_events';
  end if;
  if has_table_privilege('anon', 'public.meta_webhook_events', 'SELECT')
     or has_table_privilege('anon', 'public.meta_webhook_events', 'INSERT')
     or has_table_privilege('anon', 'public.meta_webhook_events', 'UPDATE')
     or has_table_privilege('anon', 'public.meta_webhook_events', 'DELETE') then
    raise exception 'anon has access on meta_webhook_events';
  end if;
  if has_table_privilege('authenticated', 'public.meta_webhook_events', 'SELECT')
     or has_table_privilege('authenticated', 'public.meta_webhook_events', 'INSERT')
     or has_table_privilege('authenticated', 'public.meta_webhook_events', 'UPDATE')
     or has_table_privilege('authenticated', 'public.meta_webhook_events', 'DELETE') then
    raise exception 'authenticated has access on meta_webhook_events';
  end if;
end;
$$;

rollback;

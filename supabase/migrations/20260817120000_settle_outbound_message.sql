-- STREHË Outbound Messaging V1 — idempotent normalized settlement.

create or replace function public.settle_outbound_message(
  p_conversation_id uuid,
  p_external_message_id text,
  p_text_content text
)
returns text
language plpgsql
security definer
set search_path = 'public', 'auth', 'pg_temp'
as $$
declare
  v_conversation_id uuid;
  v_status text;
  v_channel text;
  v_channel_account_id text;
  v_recipient_external_id text;
  v_external_message_id text;
  v_text_content text;
  v_existing_conversation_id uuid;
  v_existing_direction text;
  v_inserted_count integer;
  v_settled_at timestamp with time zone := now();
begin
  if not public.can_manage_messaging() then
    raise exception 'Not authorized to manage messaging'
      using errcode = '42501';
  end if;

  v_external_message_id := btrim(coalesce(p_external_message_id, ''));
  v_text_content := btrim(coalesce(p_text_content, ''));

  if p_conversation_id is null
    or v_external_message_id = ''
    or char_length(v_external_message_id) > 512
    or char_length(v_text_content) < 1
    or char_length(v_text_content) > 1000 then
    raise exception 'Outbound message arguments are not valid'
      using errcode = '22023';
  end if;

  select
    conversation.id,
    conversation.status,
    identity.channel,
    identity.channel_account_id,
    identity.external_id
  into
    v_conversation_id,
    v_status,
    v_channel,
    v_channel_account_id,
    v_recipient_external_id
  from public.conversations as conversation
  join public.contact_channel_identities as identity
    on identity.id = conversation.contact_identity_id
  where conversation.id = p_conversation_id
  for update of conversation;

  if not found
    or v_status = 'archived'
    or v_channel is null
    or v_channel not in ('whatsapp', 'instagram', 'messenger')
    or btrim(coalesce(v_channel_account_id, '')) = ''
    or btrim(coalesce(v_recipient_external_id, '')) = '' then
    raise exception 'Outbound message cannot be settled'
      using errcode = '22023';
  end if;

  insert into public.conversation_messages (
    conversation_id,
    channel,
    channel_account_id,
    external_message_id,
    direction,
    message_type,
    text_content,
    content,
    sender_external_id,
    recipient_external_id,
    source_webhook_event_id,
    occurred_at,
    received_at
  )
  values (
    v_conversation_id,
    v_channel,
    v_channel_account_id,
    v_external_message_id,
    'outbound',
    'text',
    v_text_content,
    null,
    v_channel_account_id,
    v_recipient_external_id,
    null,
    v_settled_at,
    v_settled_at
  )
  on conflict (channel, channel_account_id, external_message_id) do nothing;

  get diagnostics v_inserted_count = row_count;

  if v_inserted_count = 0 then
    select conversation_id, direction
    into v_existing_conversation_id, v_existing_direction
    from public.conversation_messages
    where channel = v_channel
      and channel_account_id = v_channel_account_id
      and external_message_id = v_external_message_id;

    if not found
      or v_existing_conversation_id <> v_conversation_id
      or v_existing_direction <> 'outbound' then
      raise exception 'Outbound message cannot be reconciled'
        using errcode = '22023';
    end if;
  end if;

  update public.conversations
  set
    status = 'open',
    attention_state = 'waiting_customer',
    resolved_at = null,
    last_outbound_at = v_settled_at,
    last_message_at = v_settled_at,
    updated_at = v_settled_at
  where id = v_conversation_id;

  return v_external_message_id;
end;
$$;

revoke all on function public.settle_outbound_message(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.settle_outbound_message(uuid, text, text)
  to authenticated;

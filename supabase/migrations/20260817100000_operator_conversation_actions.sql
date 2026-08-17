-- STREHË Operator Actions V1 — controlled conversation-state transitions.

create or replace function public.operator_set_conversation_state(
  p_conversation_id uuid,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = 'public', 'auth', 'pg_temp'
as $$
declare
  v_status text;
begin
  if not public.can_manage_messaging() then
    raise exception 'Not authorized to manage messaging'
      using errcode = '42501';
  end if;

  if p_action is null or p_action not in (
    'mark_read',
    'needs_reply',
    'waiting_customer',
    'clear_attention',
    'resolve',
    'reopen'
  ) then
    raise exception 'Unknown conversation action'
      using errcode = '22023';
  end if;

  select status
  into v_status
  from public.conversations
  where id = p_conversation_id
  for update;

  if not found or v_status = 'archived' then
    raise exception 'Conversation action is not valid for the current state'
      using errcode = '22023';
  end if;

  case p_action
    when 'mark_read' then
      if v_status not in ('open', 'resolved') then
        raise exception 'Conversation action is not valid for the current state'
          using errcode = '22023';
      end if;

      update public.conversations
      set
        unread_count = 0,
        updated_at = now()
      where id = p_conversation_id;

    when 'needs_reply' then
      if v_status <> 'open' then
        raise exception 'Conversation action is not valid for the current state'
          using errcode = '22023';
      end if;

      update public.conversations
      set
        attention_state = 'needs_reply',
        updated_at = now()
      where id = p_conversation_id;

    when 'waiting_customer' then
      if v_status <> 'open' then
        raise exception 'Conversation action is not valid for the current state'
          using errcode = '22023';
      end if;

      update public.conversations
      set
        attention_state = 'waiting_customer',
        updated_at = now()
      where id = p_conversation_id;

    when 'clear_attention' then
      if v_status <> 'open' then
        raise exception 'Conversation action is not valid for the current state'
          using errcode = '22023';
      end if;

      update public.conversations
      set
        attention_state = 'none',
        updated_at = now()
      where id = p_conversation_id;

    when 'resolve' then
      if v_status <> 'open' then
        raise exception 'Conversation action is not valid for the current state'
          using errcode = '22023';
      end if;

      update public.conversations
      set
        status = 'resolved',
        resolved_at = now(),
        attention_state = 'none',
        updated_at = now()
      where id = p_conversation_id;

    when 'reopen' then
      if v_status <> 'resolved' then
        raise exception 'Conversation action is not valid for the current state'
          using errcode = '22023';
      end if;

      update public.conversations
      set
        status = 'open',
        resolved_at = null,
        updated_at = now()
      where id = p_conversation_id;
  end case;
end;
$$;

revoke all on function public.operator_set_conversation_state(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.operator_set_conversation_state(uuid, text)
  to authenticated;

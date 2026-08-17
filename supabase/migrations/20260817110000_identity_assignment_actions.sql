-- STREHË Identity + Assignment V1 — controlled operator mutations.

create or replace function public.operator_set_identity_resolution(
  p_identity_id uuid,
  p_action text,
  p_target_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = 'public', 'auth', 'pg_temp'
as $$
declare
  v_identity_id uuid;
begin
  if not public.can_manage_messaging() then
    raise exception 'Not authorized to manage messaging'
      using errcode = '42501';
  end if;

  if p_action is null or p_action not in (
    'link_lead',
    'link_client',
    'unlink',
    'needs_review'
  ) then
    raise exception 'Unknown identity action'
      using errcode = '22023';
  end if;

  if p_action in ('link_lead', 'link_client') and p_target_id is null then
    raise exception 'Identity action is not valid'
      using errcode = '22023';
  end if;

  if p_action in ('unlink', 'needs_review') and p_target_id is not null then
    raise exception 'Identity action is not valid'
      using errcode = '22023';
  end if;

  select id
  into v_identity_id
  from public.contact_channel_identities
  where id = p_identity_id
  for update;

  if not found then
    raise exception 'Identity action is not valid'
      using errcode = '22023';
  end if;

  case p_action
    when 'link_lead' then
      perform 1
      from public.leads
      where id = p_target_id
      for key share;

      if not found then
        raise exception 'Identity action is not valid'
          using errcode = '22023';
      end if;

      update public.contact_channel_identities
      set
        lead_id = p_target_id,
        client_id = null,
        resolution_status = 'resolved',
        updated_at = now()
      where id = v_identity_id;

    when 'link_client' then
      perform 1
      from public.clients
      where id = p_target_id
      for key share;

      if not found then
        raise exception 'Identity action is not valid'
          using errcode = '22023';
      end if;

      update public.contact_channel_identities
      set
        client_id = p_target_id,
        lead_id = null,
        resolution_status = 'resolved',
        updated_at = now()
      where id = v_identity_id;

    when 'unlink' then
      update public.contact_channel_identities
      set
        lead_id = null,
        client_id = null,
        resolution_status = 'unresolved',
        updated_at = now()
      where id = v_identity_id;

    when 'needs_review' then
      update public.contact_channel_identities
      set
        lead_id = null,
        client_id = null,
        resolution_status = 'needs_review',
        updated_at = now()
      where id = v_identity_id;
  end case;
end;
$$;

revoke all on function public.operator_set_identity_resolution(uuid, text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.operator_set_identity_resolution(uuid, text, uuid)
  to authenticated;

create or replace function public.operator_set_conversation_assignment(
  p_conversation_id uuid,
  p_assignee_id uuid
)
returns void
language plpgsql
security definer
set search_path = 'public', 'auth', 'pg_temp'
as $$
declare
  v_conversation_id uuid;
  v_status text;
begin
  if not public.can_manage_messaging() then
    raise exception 'Not authorized to manage messaging'
      using errcode = '42501';
  end if;

  select id, status
  into v_conversation_id, v_status
  from public.conversations
  where id = p_conversation_id
  for update;

  if not found or v_status = 'archived' then
    raise exception 'Conversation assignment is not valid'
      using errcode = '22023';
  end if;

  if p_assignee_id is not null then
    perform 1
    from public.app_users as candidate
    where candidate.id = p_assignee_id
      and candidate.is_active = true
      and candidate.role in ('admin', 'office')
      and not exists (
        select 1
        from public.agent_principals
        where id = candidate.id
      )
    for key share;

    if not found then
      raise exception 'Conversation assignment is not valid'
        using errcode = '22023';
    end if;
  end if;

  update public.conversations
  set
    assigned_user_id = p_assignee_id,
    updated_at = now()
  where id = v_conversation_id;
end;
$$;

revoke all on function public.operator_set_conversation_assignment(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.operator_set_conversation_assignment(uuid, uuid)
  to authenticated;

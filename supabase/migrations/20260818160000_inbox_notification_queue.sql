-- STREHË Inbox Notification V1 — best-effort email notification for genuinely
-- new inbound customer messages. Fully decoupled from Messaging Ingestion V1:
-- notification delivery can never fail, roll back, or duplicate message
-- ingestion. Access is RPC-only; no direct table grants.

-- 1. Queue table. conversation_id cascades; each row carries only normalized
-- message information plus a server-derived identity label. No raw webhook,
-- no email addresses, no Meta tokens.
create table public.inbox_notification_queue (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  channel text not null,
  identity_label text not null,
  message_type text not null,
  text_preview text,
  occurred_at timestamp with time zone,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  error_class text,
  available_at timestamp with time zone not null default now(),
  lease_expires_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  sent_at timestamp with time zone,
  constraint inbox_notification_queue_status_check
    check (status in ('pending', 'processing', 'sent', 'failed')),
  constraint inbox_notification_queue_channel_check
    check (channel in ('whatsapp', 'instagram', 'messenger')),
  constraint inbox_notification_queue_attempt_count_check
    check (attempt_count >= 0)
);

-- Claimable rows (status + available_at).
create index inbox_notification_queue_status_available_idx
  on public.inbox_notification_queue (status, available_at);

-- Conversation throttle lookup (conversation_id + created_at).
create index inbox_notification_queue_conversation_created_idx
  on public.inbox_notification_queue (conversation_id, created_at);

-- 2. Enqueue a notification for a newly created inbound message. Throttle
-- suppresses when any notification row for the same conversation was created
-- within the last 5 minutes. identity_label is derived server-side; the caller
-- cannot supply it.
create or replace function public.enqueue_inbox_notification(
  p_conversation_id uuid,
  p_channel text,
  p_message_type text,
  p_text_content text,
  p_occurred_at timestamp with time zone
)
returns text
language plpgsql
security definer
set search_path = 'public', 'auth', 'pg_temp'
as $$
declare
  v_label text;
  v_preview text;
begin
  -- Serialize concurrent enqueues for the same conversation so the throttle
  -- check-and-insert is atomic for that conversation. Different conversations
  -- remain independent except for extremely unlikely hash collisions.
  perform pg_advisory_xact_lock(hashtextextended(p_conversation_id::text, 0));

  if exists (
    select 1
    from public.inbox_notification_queue
    where conversation_id = p_conversation_id
      and created_at > now() - interval '5 minutes'
  ) then
    return 'suppressed';
  end if;

  select coalesce(
    nullif(btrim(coalesce(i.display_name, '')), ''),
    nullif(btrim(coalesce(i.phone_e164, '')), ''),
    nullif(btrim(coalesce(i.external_id, '')), ''),
    'Unknown contact'
  )
  into v_label
  from public.conversations c
  join public.contact_channel_identities i on i.id = c.contact_identity_id
  where c.id = p_conversation_id;

  v_label := coalesce(v_label, 'Unknown contact');

  if p_message_type = 'text' then
    v_preview := nullif(left(btrim(coalesce(p_text_content, '')), 200), '');
  else
    v_preview := null;
  end if;

  insert into public.inbox_notification_queue (
    conversation_id, channel, identity_label, message_type, text_preview,
    occurred_at, status, available_at
  )
  values (
    p_conversation_id, p_channel, v_label, p_message_type, v_preview,
    coalesce(p_occurred_at, now()), 'pending', now()
  );

  return 'queued';
end;
$$;

revoke all on function public.enqueue_inbox_notification(uuid, text, text, text, timestamp with time zone) from public;
revoke all on function public.enqueue_inbox_notification(uuid, text, text, text, timestamp with time zone) from anon;
revoke all on function public.enqueue_inbox_notification(uuid, text, text, text, timestamp with time zone) from authenticated;
revoke all on function public.enqueue_inbox_notification(uuid, text, text, text, timestamp with time zone) from service_role;
grant execute on function public.enqueue_inbox_notification(uuid, text, text, text, timestamp with time zone) to service_role;

-- 3. Claim a bounded batch of deliverable rows. Mirrors the ingestion claim
-- convention: pending-and-due, or processing-with-expired-lease (retryable
-- failures stay 'pending' with backoff; dead-lettered rows stay 'failed').
-- FOR UPDATE SKIP LOCKED; 5-minute lease.
create or replace function public.claim_inbox_notification_batch(p_limit integer)
returns table (
  id uuid,
  conversation_id uuid,
  channel text,
  identity_label text,
  message_type text,
  text_preview text,
  occurred_at timestamp with time zone
)
language plpgsql
security definer
set search_path = public
as $$
declare
  lease interval := interval '5 minutes';
  claimed_ids uuid[];
begin
  p_limit := greatest(least(coalesce(p_limit, 0), 50), 0);

  with cte as (
    select q.id
    from public.inbox_notification_queue q
    where (q.status = 'pending' and q.available_at <= now())
       or (q.status = 'processing' and q.lease_expires_at < now())
    order by q.available_at asc, q.created_at asc
    for update skip locked
    limit p_limit
  ), updated as (
    update public.inbox_notification_queue q
    set status = 'processing',
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
  select q.id, q.conversation_id, q.channel, q.identity_label,
         q.message_type, q.text_preview, q.occurred_at
  from public.inbox_notification_queue q
  where q.id = any(claimed_ids);
end;
$$;

revoke all on function public.claim_inbox_notification_batch(integer) from public;
revoke all on function public.claim_inbox_notification_batch(integer) from anon;
revoke all on function public.claim_inbox_notification_batch(integer) from authenticated;
revoke all on function public.claim_inbox_notification_batch(integer) from service_role;
grant execute on function public.claim_inbox_notification_batch(integer) to service_role;

-- 4. Mark a notification delivered.
create or replace function public.inbox_notification_mark_sent(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.inbox_notification_queue
  set status = 'sent',
      sent_at = now(),
      lease_expires_at = null,
      updated_at = now()
  where id = p_id;
$$;

revoke all on function public.inbox_notification_mark_sent(uuid) from public;
revoke all on function public.inbox_notification_mark_sent(uuid) from anon;
revoke all on function public.inbox_notification_mark_sent(uuid) from authenticated;
revoke all on function public.inbox_notification_mark_sent(uuid) from service_role;
grant execute on function public.inbox_notification_mark_sent(uuid) to service_role;

-- 5. Record a retryable failure. Mirrors the ingestion backoff: 30s * 2^attempt
-- capped at 15 minutes; dead-letters (terminal 'failed') on the 5th failure.
-- error_class stores a generic classification only.
create or replace function public.inbox_notification_mark_failure(
  p_id uuid,
  p_error_class text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.inbox_notification_queue
  set attempt_count = attempt_count + 1,
      error_class = p_error_class,
      lease_expires_at = null,
      updated_at = now(),
      status = case when attempt_count + 1 >= 5 then 'failed' else 'pending' end,
      available_at = case
        when attempt_count + 1 >= 5 then available_at
        else now() + least(interval '15 minutes', make_interval(secs => (30 * power(2, attempt_count))::integer))
      end
  where id = p_id;
end;
$$;

revoke all on function public.inbox_notification_mark_failure(uuid, text) from public;
revoke all on function public.inbox_notification_mark_failure(uuid, text) from anon;
revoke all on function public.inbox_notification_mark_failure(uuid, text) from authenticated;
revoke all on function public.inbox_notification_mark_failure(uuid, text) from service_role;
grant execute on function public.inbox_notification_mark_failure(uuid, text) to service_role;

-- 6. RLS: no direct table access for browser/operator roles; access is RPC-only.
alter table public.inbox_notification_queue enable row level security;

revoke all on table public.inbox_notification_queue from anon;
revoke all on table public.inbox_notification_queue from authenticated;
revoke all on table public.inbox_notification_queue from service_role;

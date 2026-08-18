-- STREHË Inbox Notification V1 — claim hotfix (NOTIFICATION-CLAIM-HOTFIX-001).
-- Fixes SQLSTATE 42702 "column reference \"id\" is ambiguous" in
-- claim_inbox_notification_batch(integer): the RETURNS TABLE(id uuid, ...) OUT
-- parameter `id` collides with the `updated` CTE column `id` (from
-- `returning q.id`) in the unqualified `array_agg(id)`. Qualify as
-- `array_agg(updated.id)`. No other object or behavior is changed.

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
  select array_agg(updated.id) into claimed_ids from updated;

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

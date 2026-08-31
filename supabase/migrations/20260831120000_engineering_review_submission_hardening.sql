-- Authenticated, bounded Engineering review submission.
-- This migration only prepares the control plane; applying it remains a separate
-- human-controlled production operation.

create unique index idx_engineering_review_session_id
  on public.agent_jobs ((payload->>'session_id'))
  where job_type = 'engineering.review' and payload ? 'session_id';

create unique index idx_one_active_engineering_review_job
  on public.agent_jobs (required_capability)
  where job_type = 'engineering.review' and status in ('queued', 'running');

create or replace function public.operator_enqueue_engineering_review(
  review_session_id text,
  base_commit text,
  target_commit text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  caller_id uuid := (select auth.uid());
  engineering_agent_id uuid;
  new_job_id uuid;
begin
  if caller_id is null or not public.is_app_admin() then
    raise exception 'Admin access required';
  end if;
  if review_session_id is null
    or review_session_id !~ '^[A-Z0-9][A-Z0-9._-]{7,127}$'
    or base_commit is null or base_commit !~ '^[0-9a-fA-F]{40}$'
    or target_commit is null or target_commit !~ '^[0-9a-fA-F]{40}$'
    or lower(base_commit) = lower(target_commit)
  then
    raise exception 'Invalid Engineering review request';
  end if;

  select principal.id into engineering_agent_id
  from public.agent_principals principal
  where principal.agent_key = 'engineering.local'
    and principal.is_active = true
    and exists (
      select 1 from public.agent_capabilities capability
      where capability.agent_id = principal.id
        and capability.capability_key = 'engineering.local'
    )
  limit 1;
  if engineering_agent_id is null then
    raise exception 'Engineering Agent capability is not provisioned';
  end if;

  -- Serialize all review submissions so two different session ids cannot both
  -- pass the single-active-review check concurrently.
  perform pg_advisory_xact_lock(hashtextextended('engineering.review.active', 0));
  if exists (
    select 1 from public.agent_jobs
    where job_type = 'engineering.review'
      and payload->>'session_id' = review_session_id
  ) then
    raise exception 'Engineering review session already exists';
  end if;
  if exists (
    select 1 from public.agent_jobs
    where job_type = 'engineering.review'
      and required_capability = 'engineering.local'
      and status in ('queued', 'running')
      and expires_at > now()
  ) then
    raise exception 'An Engineering review is already active';
  end if;

  new_job_id := gen_random_uuid();
  insert into public.agent_jobs (
    id, job_type, required_capability, workspace_type, subject_type,
    requested_by_user_id, assigned_agent_id, status, priority, payload,
    requires_review, max_attempts, expires_at
  ) values (
    new_job_id, 'engineering.review', 'engineering.local', 'system', 'verification',
    caller_id, engineering_agent_id, 'queued', 10,
    jsonb_build_object(
      'type', 'review',
      'session_id', review_session_id,
      'base_commit', lower(base_commit),
      'commit_sha', lower(target_commit),
      'scope', 'repository',
      'implementation', false,
      'writes_code', false
    ),
    true, 1, now() + interval '2 days'
  );
  return jsonb_build_object(
    'ok', true,
    'job_id', new_job_id,
    'session_id', review_session_id,
    'requested_by_user_id', caller_id
  );
end;
$$;

revoke all on function public.operator_enqueue_engineering_review(text, text, text) from public;
grant execute on function public.operator_enqueue_engineering_review(text, text, text) to authenticated;

comment on function public.operator_enqueue_engineering_review(text, text, text) is
  'Enqueues one bounded engineering.review for the authenticated admin; requester provenance is always auth.uid().';

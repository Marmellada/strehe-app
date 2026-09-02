-- Phase 2 operator workflow read models.
-- These functions expose a bounded, redacted Engineering review view to
-- admin/office operators. They do not add a mutation path or weaken RLS.

create or replace function public.get_engineering_review_queue(
  p_limit integer default 25,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = 'public', 'auth', 'pg_temp'
as $$
declare
  v_allowed boolean;
  v_agent_id uuid;
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 50);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_pending_count integer := 0;
  v_jobs jsonb := '[]'::jsonb;
  v_recent_decisions jsonb := '[]'::jsonb;
begin
  select exists (
    select 1
    from public.app_users
    where id = (select auth.uid())
      and is_active = true
      and role in ('admin', 'office')
  ) into v_allowed;

  if not v_allowed then
    raise exception 'Operator access required' using errcode = '42501';
  end if;

  select id into v_agent_id
  from public.agent_principals
  where agent_key = 'engineering.local'
    and is_active = true;

  if v_agent_id is null then
    return jsonb_build_object(
      'configured', false,
      'pending_count', 0,
      'jobs', '[]'::jsonb,
      'recent_decisions', '[]'::jsonb
    );
  end if;

  select count(*)::integer into v_pending_count
  from public.agent_jobs
  where required_capability = 'engineering.local'
    and status = 'awaiting_review';

  select coalesce(jsonb_agg(to_jsonb(queue_job) order by queue_job.created_at desc), '[]'::jsonb)
  into v_jobs
  from (
    select
      jobs.id,
      jobs.job_type,
      jobs.status,
      jobs.priority,
      nullif(left(coalesce(jobs.payload->>'target_module', ''), 160), '') as target_module,
      nullif(left(coalesce(jobs.payload->>'session_id', ''), 160), '') as session_id,
      nullif(left(coalesce(jobs.result->>'summary', ''), 2000), '') as summary,
      case
        when jsonb_typeof(jobs.result->'findings') = 'array'
          then least(jsonb_array_length(jobs.result->'findings'), 100)
        else 0
      end as finding_count,
      jobs.created_at,
      jobs.completed_at,
      jobs.review_decision,
      jobs.review_notes,
      jobs.reviewed_at,
      reviewer.full_name as reviewer_name,
      reviewer.email as reviewer_email
    from public.agent_jobs as jobs
    left join public.app_users as reviewer
      on reviewer.id = jobs.reviewed_by_user_id
    where jobs.required_capability = 'engineering.local'
      and jobs.status = 'awaiting_review'
    order by jobs.created_at desc
    limit v_limit
    offset v_offset
  ) as queue_job;

  select coalesce(jsonb_agg(to_jsonb(reviewed_job) order by reviewed_job.reviewed_at desc), '[]'::jsonb)
  into v_recent_decisions
  from (
    select
      jobs.id,
      jobs.job_type,
      jobs.status,
      jobs.priority,
      nullif(left(coalesce(jobs.payload->>'target_module', ''), 160), '') as target_module,
      nullif(left(coalesce(jobs.payload->>'session_id', ''), 160), '') as session_id,
      nullif(left(coalesce(jobs.result->>'summary', ''), 2000), '') as summary,
      case
        when jsonb_typeof(jobs.result->'findings') = 'array'
          then least(jsonb_array_length(jobs.result->'findings'), 100)
        else 0
      end as finding_count,
      jobs.created_at,
      jobs.completed_at,
      jobs.review_decision,
      jobs.review_notes,
      jobs.reviewed_at,
      reviewer.full_name as reviewer_name,
      reviewer.email as reviewer_email
    from public.agent_jobs as jobs
    left join public.app_users as reviewer
      on reviewer.id = jobs.reviewed_by_user_id
    where jobs.required_capability = 'engineering.local'
      and jobs.review_decision is not null
      and jobs.reviewed_at is not null
    order by jobs.reviewed_at desc
    limit 10
  ) as reviewed_job;

  return jsonb_build_object(
    'configured', true,
    'pending_count', v_pending_count,
    'jobs', v_jobs,
    'recent_decisions', v_recent_decisions
  );
end;
$$;

create or replace function public.get_engineering_review_job(
  p_job_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = 'public', 'auth', 'pg_temp'
as $$
declare
  v_allowed boolean;
  v_job jsonb;
begin
  select exists (
    select 1
    from public.app_users
    where id = (select auth.uid())
      and is_active = true
      and role in ('admin', 'office')
  ) into v_allowed;

  if not v_allowed then
    raise exception 'Operator access required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', jobs.id,
    'job_type', jobs.job_type,
    'status', jobs.status,
    'priority', jobs.priority,
    'target_module', nullif(left(coalesce(jobs.payload->>'target_module', ''), 160), ''),
    'session_id', nullif(left(coalesce(jobs.payload->>'session_id', ''), 160), ''),
    'base_commit', nullif(left(coalesce(jobs.payload->>'base_commit', ''), 40), ''),
    'target_commit', nullif(left(coalesce(jobs.payload->>'target_commit', ''), 40), ''),
    'commit_sha', nullif(left(coalesce(jobs.payload->>'commit_sha', ''), 40), ''),
    'trigger', nullif(left(coalesce(jobs.payload->>'trigger', ''), 80), ''),
    'summary', nullif(left(coalesce(jobs.result->>'summary', ''), 2000), ''),
    'finding_count', case
      when jsonb_typeof(jobs.result->'findings') = 'array'
        then least(jsonb_array_length(jobs.result->'findings'), 100)
      else 0
    end,
    'findings', case
      when jsonb_typeof(jobs.result->'findings') = 'array' then coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', finding.item->'id',
          'module', nullif(left(coalesce(finding.item->>'module', ''), 160), ''),
          'summary', nullif(left(coalesce(finding.item->>'summary', ''), 2000), ''),
          'severity', nullif(left(coalesce(finding.item->>'severity', ''), 40), ''),
          'confidence', nullif(left(coalesce(finding.item->>'confidence', ''), 40), ''),
          'lifecycle', nullif(left(coalesce(finding.item->>'lifecycle', ''), 40), ''),
          'evidence', case
            when jsonb_typeof(finding.item->'evidence') = 'array'
              then finding.item->'evidence'
            else '[]'::jsonb
          end,
          'recommendation', nullif(left(coalesce(finding.item->>'recommendation', ''), 4000), '')
        ) order by finding.ordinality)
        from jsonb_array_elements(jobs.result->'findings') with ordinality as finding(item, ordinality)
        where finding.ordinality <= 100
      ), '[]'::jsonb)
      else '[]'::jsonb
    end,
    'requires_review', jobs.requires_review,
    'attempt_count', jobs.attempt_count,
    'max_attempts', jobs.max_attempts,
    'claimed_at', jobs.claimed_at,
    'processed_at', jobs.processed_at,
    'created_at', jobs.created_at,
    'updated_at', jobs.updated_at,
    'completed_at', jobs.completed_at,
    'review_decision', jobs.review_decision,
    'review_notes', jobs.review_notes,
    'reviewed_at', jobs.reviewed_at,
    'reviewer_name', reviewer.full_name,
    'reviewer_email', reviewer.email,
    'error_status', run_error.error_code
  ) into v_job
  from public.agent_jobs as jobs
  left join public.app_users as reviewer
    on reviewer.id = jobs.reviewed_by_user_id
  left join lateral (
    select runs.error_code
    from public.agent_runs as runs
    where runs.job_id = jobs.id
      and runs.error_code is not null
    order by runs.started_at desc
    limit 1
  ) as run_error on true
  where jobs.id = p_job_id
    and jobs.required_capability = 'engineering.local';

  return v_job;
end;
$$;

revoke all on function public.get_engineering_review_queue(integer, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.get_engineering_review_job(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_engineering_review_queue(integer, integer)
  to authenticated;
grant execute on function public.get_engineering_review_job(uuid)
  to authenticated;

comment on function public.get_engineering_review_queue(integer, integer) is
  'Bounded operator read model for exact Engineering review counts, pending work, and recent decision provenance.';
comment on function public.get_engineering_review_job(uuid) is
  'Redacted Engineering job detail for admin/office review workflow; no mutation authority.';

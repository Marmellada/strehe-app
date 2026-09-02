-- Phase 2 operator workflow read-model assertions.
-- Run only against a disposable local/test database after all migrations:
--   supabase db reset && supabase test db

begin;

insert into auth.users (id, email) values
  ('41000000-0000-0000-0000-000000000001', 'workflow-admin@example.invalid'),
  ('41000000-0000-0000-0000-000000000002', 'workflow-office@example.invalid'),
  ('41000000-0000-0000-0000-000000000003', 'workflow-field@example.invalid'),
  ('41000000-0000-0000-0000-000000000004', 'workflow-contractor@example.invalid'),
  ('41000000-0000-0000-0000-000000000005', 'workflow-household@example.invalid'),
  ('41000000-0000-0000-0000-000000000010', 'workflow-agent@example.invalid')
on conflict (id) do nothing;

insert into public.app_users (id, email, full_name, role) values
  ('41000000-0000-0000-0000-000000000001', 'workflow-admin@example.invalid', 'Workflow Admin', 'admin'),
  ('41000000-0000-0000-0000-000000000002', 'workflow-office@example.invalid', 'Workflow Office', 'office'),
  ('41000000-0000-0000-0000-000000000003', 'workflow-field@example.invalid', 'Workflow Field', 'field'),
  ('41000000-0000-0000-0000-000000000004', 'workflow-contractor@example.invalid', 'Workflow Contractor', 'contractor'),
  ('41000000-0000-0000-0000-000000000005', 'workflow-household@example.invalid', 'Workflow Household', 'household')
on conflict (id) do update set
  role = excluded.role,
  full_name = excluded.full_name,
  is_active = true;

insert into public.agent_principals (id, agent_key, display_name, is_active)
values ('41000000-0000-0000-0000-000000000010', 'engineering.local', 'Workflow Engineering', true)
on conflict (agent_key) do update set is_active = true;

insert into public.agent_capabilities (agent_id, capability_key)
select id, 'engineering.local'
from public.agent_principals
where agent_key = 'engineering.local'
on conflict (agent_id, capability_key) do nothing;

insert into public.agent_jobs (
  id,
  job_type,
  required_capability,
  workspace_type,
  assigned_agent_id,
  status,
  priority,
  payload,
  result,
  requires_review,
  processed_at
)
select
  ('42000000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  'engineering.review',
  'engineering.local',
  'system',
  (select id from public.agent_principals where agent_key = 'engineering.local'),
  'awaiting_review',
  10,
  jsonb_build_object(
    'type', 'review',
    'session_id', 'WORKFLOW-REVIEW-' || series,
    'base_commit', repeat('a', 40),
    'commit_sha', repeat('b', 40),
    'secret_not_whitelisted', 'must-not-leak'
  ),
  jsonb_build_object(
    'summary', 'Workflow review ' || series,
    'findings', jsonb_build_array(jsonb_build_object(
      'summary', 'Finding ' || series,
      'severity', 'low',
      'evidence', jsonb_build_array('bounded evidence'),
      'secret_not_whitelisted', 'must-not-leak'
    )),
    'secret_not_whitelisted', 'must-not-leak'
  ),
  true,
  now()
from generate_series(1, 7) as series
on conflict (id) do update set
  status = 'awaiting_review',
  review_decision = null,
  reviewed_by_user_id = null,
  reviewed_at = null;

do $$
begin
  if has_function_privilege('anon', 'public.get_engineering_review_queue(integer,integer)', 'EXECUTE')
    or has_function_privilege('anon', 'public.get_engineering_review_job(uuid)', 'EXECUTE')
  then
    raise exception 'anonymous role can execute operator workflow read models';
  end if;
  if not has_function_privilege('authenticated', 'public.get_engineering_review_queue(integer,integer)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.get_engineering_review_job(uuid)', 'EXECUTE')
  then
    raise exception 'authenticated role cannot execute operator workflow read models';
  end if;
end;
$$;

-- Admin sees exact full-queue totals even when the preview is bounded.
set local role authenticated;
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000001', true);
do $$
declare
  queue jsonb;
  detail jsonb;
begin
  queue := public.get_engineering_review_queue(2, 0);
  if not (queue->>'configured')::boolean then raise exception 'configured queue reported unavailable'; end if;
  if (queue->>'pending_count')::integer <> 7 then raise exception 'pending count came from bounded preview: %', queue; end if;
  if jsonb_array_length(queue->'jobs') <> 2 then raise exception 'queue preview was not bounded to two rows'; end if;

  detail := public.get_engineering_review_job('42000000-0000-4000-8000-000000000001');
  if detail is null or detail->>'session_id' <> 'WORKFLOW-REVIEW-1' then raise exception 'admin job detail unavailable'; end if;
  if detail ? 'payload' or detail ? 'result' or detail::text like '%secret_not_whitelisted%' then
    raise exception 'job detail leaked an unbounded document';
  end if;
end;
$$;
reset role;

-- Office has the same bounded read, but cannot decide on behalf of an admin.
set local role authenticated;
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000002', true);
do $$
declare queue jsonb;
begin
  queue := public.get_engineering_review_queue(3, 0);
  if (queue->>'pending_count')::integer <> 7 then raise exception 'office exact count mismatch'; end if;
  if public.get_engineering_review_job('42000000-0000-4000-8000-000000000001') is null then
    raise exception 'office read-only detail unavailable';
  end if;
  begin
    perform public.review_agent_job(
      '42000000-0000-4000-8000-000000000001',
      'approved',
      'office must not decide'
    );
    raise exception 'office review decision unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'office review decision unexpectedly succeeded' then raise; end if;
  end;
end;
$$;
reset role;

-- Field, contractor, and household identities cannot use either read model.
set local role authenticated;
do $$
declare subject uuid;
begin
  foreach subject in array array[
    '41000000-0000-0000-0000-000000000003'::uuid,
    '41000000-0000-0000-0000-000000000004'::uuid,
    '41000000-0000-0000-0000-000000000005'::uuid
  ] loop
    perform set_config('request.jwt.claim.sub', subject::text, true);
    begin
      perform public.get_engineering_review_queue(5, 0);
      raise exception 'non-operator queue read unexpectedly succeeded for %', subject;
    exception when others then
      if sqlerrm like 'non-operator queue read unexpectedly succeeded%' then raise; end if;
    end;
    begin
      perform public.get_engineering_review_job('42000000-0000-4000-8000-000000000001');
      raise exception 'non-operator job read unexpectedly succeeded for %', subject;
    exception when others then
      if sqlerrm like 'non-operator job read unexpectedly succeeded%' then raise; end if;
    end;
  end loop;
end;
$$;
reset role;

-- Admin decision records who/what/when and is returned by both read models.
set local role authenticated;
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000001', true);
do $$
declare
  detail jsonb;
  queue jsonb;
begin
  perform public.review_agent_job(
    '42000000-0000-4000-8000-000000000001',
    'approved',
    'verified by workflow SQL test'
  );
  detail := public.get_engineering_review_job('42000000-0000-4000-8000-000000000001');
  if detail->>'review_decision' <> 'approved'
    or detail->>'reviewer_name' <> 'Workflow Admin'
    or detail->>'reviewed_at' is null
    or detail->>'review_notes' <> 'verified by workflow SQL test'
  then
    raise exception 'decision provenance missing from job detail: %', detail;
  end if;
  queue := public.get_engineering_review_queue(2, 0);
  if (queue->>'pending_count')::integer <> 6 then raise exception 'resolved job remained in exact pending count'; end if;
  if not queue @? '$.recent_decisions[*] ? (@.id == "42000000-0000-4000-8000-000000000001")' then
    raise exception 'decision provenance missing from recent decisions';
  end if;
end;
$$;
reset role;

rollback;

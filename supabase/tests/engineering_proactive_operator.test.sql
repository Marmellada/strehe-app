-- STREHE Engineering Agent proactive/operator executable SQL assertions.
-- Run only against a disposable local/test database after all migrations:
--   supabase db reset && supabase test db

begin;

insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-000000000001', 'engineering-test-admin@example.invalid'),
  ('10000000-0000-0000-0000-000000000002', 'engineering-test-office@example.invalid'),
  ('10000000-0000-0000-0000-000000000003', 'engineering-test-field@example.invalid'),
  ('10000000-0000-0000-0000-000000000004', 'engineering-test-contractor@example.invalid'),
  ('10000000-0000-0000-0000-000000000005', 'engineering-test-household@example.invalid'),
  ('10000000-0000-0000-0000-000000000010', 'engineering-test-agent@example.invalid')
on conflict (id) do nothing;

insert into public.app_users (id, email, full_name, role) values
  ('10000000-0000-0000-0000-000000000001', 'engineering-test-admin@example.invalid', 'Test Admin', 'admin'),
  ('10000000-0000-0000-0000-000000000002', 'engineering-test-office@example.invalid', 'Test Office', 'office'),
  ('10000000-0000-0000-0000-000000000003', 'engineering-test-field@example.invalid', 'Test Field', 'field'),
  ('10000000-0000-0000-0000-000000000004', 'engineering-test-contractor@example.invalid', 'Test Contractor', 'contractor'),
  ('10000000-0000-0000-0000-000000000005', 'engineering-test-household@example.invalid', 'Test Household', 'household')
on conflict (id) do update set role = excluded.role, is_active = true;

insert into public.agent_principals (id, agent_key, display_name, is_active)
values ('10000000-0000-0000-0000-000000000010', 'engineering.local', 'Engineering test agent', true)
on conflict (agent_key) do update set id = excluded.id, is_active = true;
insert into public.agent_capabilities (agent_id, capability_key)
values ('10000000-0000-0000-0000-000000000010', 'engineering.local')
on conflict (agent_id, capability_key) do nothing;

-- Migration contract and bounded privileges.
do $$
begin
  if not has_table_privilege('service_role', 'public.agent_principals', 'SELECT')
     or not has_table_privilege('service_role', 'public.agent_principals', 'INSERT')
     or not has_table_privilege('service_role', 'public.agent_principals', 'UPDATE')
  then
    raise exception 'service_role lacks agent_principals provisioning privileges';
  end if;

  if not has_table_privilege('service_role', 'public.agent_capabilities', 'SELECT')
     or not has_table_privilege('service_role', 'public.agent_capabilities', 'INSERT')
     or not has_table_privilege('service_role', 'public.agent_capabilities', 'UPDATE')
  then
    raise exception 'service_role lacks agent_capabilities provisioning privileges';
  end if;

  if has_table_privilege('service_role', 'public.agent_principals', 'DELETE')
     or has_table_privilege('service_role', 'public.agent_capabilities', 'DELETE')
  then
    raise exception 'service_role provisioning privileges are broader than intended';
  end if;
  if to_regclass('public.agent_operator_controls') is null then raise exception 'operator controls migration missing'; end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'idx_one_active_engineering_proactive_job') then
    raise exception 'active proactive uniqueness index missing';
  end if;
  if has_function_privilege('anon', 'public.operator_control_engineering_agent(text)', 'EXECUTE') then
    raise exception 'anon can execute operator control';
  end if;
end;
$$;

-- Admin controls; pause/resume persists.
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
do $$
begin
  perform public.operator_control_engineering_agent('pause');
  if not (select paused from public.agent_operator_controls where agent_id = '10000000-0000-0000-0000-000000000010') then raise exception 'pause not persisted'; end if;
  perform public.operator_control_engineering_agent('resume');
  if (select paused from public.agent_operator_controls where agent_id = '10000000-0000-0000-0000-000000000010') then raise exception 'resume not persisted'; end if;
  perform public.operator_update_engineering_finding_lifecycle(1, 'ACKNOWLEDGED');
  if not exists (select 1 from public.agent_jobs where job_type = 'engineering.finding.lifecycle' and requested_by_user_id = auth.uid()) then
    raise exception 'admin finding lifecycle request not queued';
  end if;
end;
$$;
reset role;

-- Office can read the redacted dashboard but cannot control or see the controls table directly.
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
do $$
declare dashboard jsonb;
begin
  dashboard := public.get_engineering_agent_dashboard();
  if dashboard @? '$.jobs[*].payload' or dashboard @? '$.jobs[*].result' then raise exception 'dashboard leaked raw job documents'; end if;
  if (select count(*) from public.agent_operator_controls) <> 0 then raise exception 'office bypassed control RLS'; end if;
  begin
    perform public.operator_control_engineering_agent('pause');
    raise exception 'office operator control unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'office operator control unexpectedly succeeded' then raise; end if;
  end;
  begin
    perform public.operator_update_engineering_finding_lifecycle(1, 'RESOLVED');
    raise exception 'office lifecycle control unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'office lifecycle control unexpectedly succeeded' then raise; end if;
  end;
end;
$$;
reset role;

-- Field, contractor, household, and agent identities cannot use operator RPCs/dashboard.
set local role authenticated;
do $$
declare subject uuid;
begin
  foreach subject in array array[
    '10000000-0000-0000-0000-000000000003'::uuid,
    '10000000-0000-0000-0000-000000000004'::uuid,
    '10000000-0000-0000-0000-000000000005'::uuid,
    '10000000-0000-0000-0000-000000000010'::uuid
  ] loop
    perform set_config('request.jwt.claim.sub', subject::text, true);
    begin
      perform public.get_engineering_agent_dashboard();
      raise exception 'non-operator dashboard access unexpectedly succeeded for %', subject;
    exception when others then
      if sqlerrm like 'non-operator dashboard access unexpectedly succeeded%' then raise; end if;
    end;
    begin
      perform public.operator_control_engineering_agent('pause');
      raise exception 'non-admin control unexpectedly succeeded for %', subject;
    exception when others then
      if sqlerrm like 'non-admin control unexpectedly succeeded%' then raise; end if;
    end;
    if subject <> '10000000-0000-0000-0000-000000000010'::uuid
      and (select count(*) from public.agent_operator_controls) <> 0
    then raise exception 'non-operator bypassed controls RLS for %', subject;
    end if;
  end loop;
end;
$$;

-- Agent-only scheduler tests.
-- Expired queued job is transitioned and does not wedge a new enqueue.
reset role;
update public.agent_jobs set status = 'cancelled' where job_type = 'engineering.finding.lifecycle' and status = 'queued';
update public.agent_operator_controls set proactive_enabled = true, paused = false, next_proactive_at = now() - interval '1 minute';
insert into public.agent_jobs (id, job_type, required_capability, workspace_type, status, expires_at)
values ('20000000-0000-0000-0000-000000000001', 'engineering.proactive', 'engineering.local', 'system', 'queued', now() - interval '1 second');
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000010', true);
do $$ declare response jsonb; begin
  response := public.enqueue_due_engineering_proactive('Auth', repeat('a', 40), repeat('b', 40), repeat('c', 64));
  if not coalesce((response->>'enqueued')::boolean, false) then raise exception 'expired queued job blocked enqueue: %', response; end if;
end $$;
reset role;
do $$ begin
  if (select status from public.agent_jobs where id = '20000000-0000-0000-0000-000000000001') <> 'expired' then raise exception 'expired queued job not transitioned'; end if;
end $$;
update public.agent_jobs set status = 'cancelled' where job_type = 'engineering.proactive' and status in ('queued', 'running');

-- Expired running job and run are closed before enqueue.
update public.agent_operator_controls set next_proactive_at = now() - interval '1 minute';
insert into public.agent_jobs (id, job_type, required_capability, workspace_type, status, assigned_agent_id, lease_expires_at, expires_at)
values ('20000000-0000-0000-0000-000000000002', 'engineering.proactive', 'engineering.local', 'system', 'running', '10000000-0000-0000-0000-000000000010', now() + interval '1 minute', now() - interval '1 second');
insert into public.agent_runs (id, job_id, agent_id, status)
values ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000010', 'running');
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000010', true);
do $$ declare response jsonb; begin
  response := public.enqueue_due_engineering_proactive('Billing', repeat('a', 40), repeat('b', 40), repeat('d', 64));
  if not coalesce((response->>'enqueued')::boolean, false) then raise exception 'expired running job blocked enqueue: %', response; end if;
end $$;
reset role;
do $$ begin
  if (select status from public.agent_jobs where id = '20000000-0000-0000-0000-000000000002') <> 'expired' then raise exception 'expired running job not transitioned'; end if;
  if (select status from public.agent_runs where id = '30000000-0000-0000-0000-000000000002') <> 'failed' then raise exception 'expired proactive run not failed'; end if;
end $$;

-- Fresh active job remains the single job; repeated enqueue returns duplicate.
update public.agent_operator_controls set next_proactive_at = now() - interval '1 minute';
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000010', true);
do $$ declare response jsonb; active_count integer; begin
  response := public.enqueue_due_engineering_proactive('Billing', repeat('a', 40), repeat('b', 40), repeat('d', 64));
  if response->>'reason' <> 'duplicate' then raise exception 'fresh duplicate not detected: %', response; end if;
  select count(*) into active_count from public.agent_jobs where job_type = 'engineering.proactive' and status in ('queued', 'running');
  if active_count <> 1 then raise exception 'duplicate-safe enqueue produced % active jobs', active_count; end if;

  begin
    perform public.enqueue_due_engineering_proactive('', 'bad', repeat('b', 40), repeat('d', 64));
    raise exception 'malformed scheduler input accepted';
  exception when others then
    if sqlerrm = 'malformed scheduler input accepted' then raise; end if;
  end;
end $$;

-- A fresh running proactive job is also duplicate-protected.
reset role;

-- Test the physical partial unique index as the database owner so RLS does not
-- mask the unique_violation that this assertion is specifically testing.
do $$ begin
  begin
    insert into public.agent_jobs (job_type, required_capability, workspace_type, status)
    values ('engineering.proactive', 'engineering.local', 'system', 'queued');
    raise exception 'partial unique index allowed concurrent duplicate';
  exception when unique_violation then null;
  end;
end $$;
update public.agent_jobs
set status = 'running', assigned_agent_id = '10000000-0000-0000-0000-000000000010',
    claimed_at = now(), lease_expires_at = now() + interval '5 minutes'
where job_type = 'engineering.proactive' and status = 'queued';
update public.agent_operator_controls set next_proactive_at = now() - interval '1 minute';
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000010', true);
do $$ declare response jsonb; begin
  response := public.enqueue_due_engineering_proactive('Billing', repeat('a', 40), repeat('b', 40), repeat('d', 64));
  if response->>'reason' <> 'duplicate' then raise exception 'fresh running duplicate not detected: %', response; end if;
end $$;

-- Existing heartbeat/claim/complete/fail behavior remains intact.
reset role;
update public.agent_jobs set status = 'cancelled' where job_type = 'engineering.proactive' and status in ('queued', 'running');
insert into public.agent_jobs (id, job_type, required_capability, workspace_type, requires_review)
values
  ('20000000-0000-0000-0000-000000000020', 'engineering.review', 'engineering.local', 'system', true),
  ('20000000-0000-0000-0000-000000000021', 'engineering.review', 'engineering.local', 'system', false);
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000010', true);
do $$ begin
  perform public.heartbeat_agent();
  perform public.claim_agent_job('20000000-0000-0000-0000-000000000020', 300);
  perform public.complete_agent_job('20000000-0000-0000-0000-000000000020', '{"privacy":{"external_ai_used":false,"local_processing":true}}');
  perform public.claim_agent_job('20000000-0000-0000-0000-000000000021', 300);
  perform public.fail_agent_job('20000000-0000-0000-0000-000000000021', 'test_failure', 'bounded test failure');
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
do $$ begin
  perform public.review_agent_job('20000000-0000-0000-0000-000000000020', 'approved', 'SQL regression test');
  if (select status from public.agent_jobs where id = '20000000-0000-0000-0000-000000000020') <> 'completed' then raise exception 'review lifecycle regressed'; end if;
  if (select status from public.agent_jobs where id = '20000000-0000-0000-0000-000000000021') <> 'failed' then raise exception 'fail lifecycle regressed'; end if;
end $$;

rollback;

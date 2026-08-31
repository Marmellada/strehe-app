-- Deterministic one-purpose Engineering proactive recovery assertions.
-- Run only against the disposable local Supabase database.

begin;

insert into auth.users (id, email) values
  ('91000000-0000-0000-0000-000000000001', 'recovery-admin@example.invalid'),
  ('91000000-0000-0000-0000-000000000002', 'recovery-office@example.invalid'),
  ('91000000-0000-0000-0000-000000000010', 'recovery-agent@example.invalid')
on conflict (id) do nothing;

insert into public.app_users (id, email, full_name, role) values
  ('91000000-0000-0000-0000-000000000001', 'recovery-admin@example.invalid', 'Recovery Admin', 'admin'),
  ('91000000-0000-0000-0000-000000000002', 'recovery-office@example.invalid', 'Recovery Office', 'office')
on conflict (id) do update set role = excluded.role, is_active = true;

insert into public.agent_principals (id, agent_key, display_name, is_active)
values ('91000000-0000-0000-0000-000000000010', 'recovery.test', 'Recovery test agent', true)
on conflict (agent_key) do update set is_active = true;

insert into public.agent_jobs (
  id, job_type, required_capability, workspace_type, status,
  assigned_agent_id, payload, result, requires_review, completed_at, processed_at
) values (
  '795ec8d1-1b07-48e1-b18d-442f50ee1ff1',
  'engineering.proactive', 'engineering.local', 'system', 'failed',
  '91000000-0000-0000-0000-000000000010',
  jsonb_build_object(
    'type', 'proactive',
    'session_id', 'ENG-PROACTIVE-795ec8d1-1b07-48e1-b18d-442f50ee1ff1',
    'commit_sha', 'd022d3a63fca2835b877235691b7d255d58e461c',
    'target_module', 'Supabase infra',
    'target_fingerprint', '1751ba633a2fdd65ec1c31595e69ccd8010bc877',
    'target_module_fingerprint', 'd93c0866e59a2857c5dad9ff011f95456052b5e0cf2e688816f9097399c26aad'
  ),
  '{"historical":"unchanged"}'::jsonb,
  true,
  '2026-08-31 19:40:00+00'::timestamptz,
  '2026-08-31 19:39:30+00'::timestamptz
);

insert into public.agent_runs (
  id, job_id, agent_id, status, started_at, finished_at, error_code, error_message, metrics
) values (
  '92000000-0000-0000-0000-000000000001',
  '795ec8d1-1b07-48e1-b18d-442f50ee1ff1',
  '91000000-0000-0000-0000-000000000010',
  'failed', '2026-08-31 19:38:00+00', '2026-08-31 19:40:00+00',
  'unsafe_result', 'Historical validator failure', '{"api_calls":1}'::jsonb
);

create temporary table recovery_job_before as
select result, completed_at, processed_at from public.agent_jobs
where id = '795ec8d1-1b07-48e1-b18d-442f50ee1ff1';
create temporary table recovery_run_before as
select to_jsonb(r) as row_data from public.agent_runs r
where id = '92000000-0000-0000-0000-000000000001';

do $$
begin
  if has_function_privilege('anon', 'public.operator_recover_engineering_proactive(uuid,text,text,text,text)', 'EXECUTE') then
    raise exception 'anon can execute proactive recovery';
  end if;
  if has_table_privilege('authenticated', 'public.engineering_recovery_audit', 'INSERT')
    or has_table_privilege('authenticated', 'public.engineering_recovery_audit', 'UPDATE')
    or has_table_privilege('authenticated', 'public.engineering_recovery_audit', 'DELETE')
  then
    raise exception 'authenticated role has mutation privileges on recovery audit';
  end if;
end;
$$;

-- Non-admin and unauthenticated callers fail closed.
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000002', true);
do $$ begin
  begin
    perform public.operator_recover_engineering_proactive(
      '795ec8d1-1b07-48e1-b18d-442f50ee1ff1',
      'ENG-PROACTIVE-795ec8d1-1b07-48e1-b18d-442f50ee1ff1',
      'd022d3a63fca2835b877235691b7d255d58e461c',
      'd93c0866e59a2857c5dad9ff011f95456052b5e0cf2e688816f9097399c26aad',
      'd1daebe0d8582440e2cf42e70366f9e158ff759a918d79405a8b2289aeb5a513');
    raise exception 'non-admin recovery unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'non-admin recovery unexpectedly succeeded' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claim.sub', '', true);
do $$ begin
  begin
    perform public.operator_recover_engineering_proactive(
      '795ec8d1-1b07-48e1-b18d-442f50ee1ff1',
      'ENG-PROACTIVE-795ec8d1-1b07-48e1-b18d-442f50ee1ff1',
      'd022d3a63fca2835b877235691b7d255d58e461c',
      'd93c0866e59a2857c5dad9ff011f95456052b5e0cf2e688816f9097399c26aad',
      'd1daebe0d8582440e2cf42e70366f9e158ff759a918d79405a8b2289aeb5a513');
    raise exception 'unauthenticated recovery unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'unauthenticated recovery unexpectedly succeeded' then raise; end if;
  end;
end $$;
reset role;

-- Admin input pins are exact: wrong job/session/commit/fingerprint/evidence fail.
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000001', true);
do $$
declare
  args text[][] := array[
    array['00000000-0000-0000-0000-000000000001','ENG-PROACTIVE-795ec8d1-1b07-48e1-b18d-442f50ee1ff1','d022d3a63fca2835b877235691b7d255d58e461c','d93c0866e59a2857c5dad9ff011f95456052b5e0cf2e688816f9097399c26aad','d1daebe0d8582440e2cf42e70366f9e158ff759a918d79405a8b2289aeb5a513'],
    array['795ec8d1-1b07-48e1-b18d-442f50ee1ff1','ENG-PROACTIVE-WRONG-SESSION','d022d3a63fca2835b877235691b7d255d58e461c','d93c0866e59a2857c5dad9ff011f95456052b5e0cf2e688816f9097399c26aad','d1daebe0d8582440e2cf42e70366f9e158ff759a918d79405a8b2289aeb5a513'],
    array['795ec8d1-1b07-48e1-b18d-442f50ee1ff1','ENG-PROACTIVE-795ec8d1-1b07-48e1-b18d-442f50ee1ff1','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','d93c0866e59a2857c5dad9ff011f95456052b5e0cf2e688816f9097399c26aad','d1daebe0d8582440e2cf42e70366f9e158ff759a918d79405a8b2289aeb5a513'],
    array['795ec8d1-1b07-48e1-b18d-442f50ee1ff1','ENG-PROACTIVE-795ec8d1-1b07-48e1-b18d-442f50ee1ff1','d022d3a63fca2835b877235691b7d255d58e461c','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','d1daebe0d8582440e2cf42e70366f9e158ff759a918d79405a8b2289aeb5a513'],
    array['795ec8d1-1b07-48e1-b18d-442f50ee1ff1','ENG-PROACTIVE-795ec8d1-1b07-48e1-b18d-442f50ee1ff1','d022d3a63fca2835b877235691b7d255d58e461c','d93c0866e59a2857c5dad9ff011f95456052b5e0cf2e688816f9097399c26aad','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa']
  ];
  candidate text[];
begin
  foreach candidate slice 1 in array args loop
    begin
      perform public.operator_recover_engineering_proactive(candidate[1]::uuid, candidate[2], candidate[3], candidate[4], candidate[5]);
      raise exception 'incorrect recovery pins unexpectedly succeeded';
    exception when others then
      if sqlerrm = 'incorrect recovery pins unexpectedly succeeded' then raise; end if;
    end;
  end loop;
end;
$$;
reset role;

-- Wrong job type, payload pins, requires_review, and non-failed state fail closed.
update public.agent_jobs set job_type = 'engineering.review'
where id = '795ec8d1-1b07-48e1-b18d-442f50ee1ff1';
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000001', true);
do $$ begin
  begin
    perform public.operator_recover_engineering_proactive('795ec8d1-1b07-48e1-b18d-442f50ee1ff1','ENG-PROACTIVE-795ec8d1-1b07-48e1-b18d-442f50ee1ff1','d022d3a63fca2835b877235691b7d255d58e461c','d93c0866e59a2857c5dad9ff011f95456052b5e0cf2e688816f9097399c26aad','d1daebe0d8582440e2cf42e70366f9e158ff759a918d79405a8b2289aeb5a513');
    raise exception 'wrong job type unexpectedly succeeded';
  exception when others then if sqlerrm = 'wrong job type unexpectedly succeeded' then raise; end if; end;
end $$;
reset role;
update public.agent_jobs set job_type = 'engineering.proactive', requires_review = false
where id = '795ec8d1-1b07-48e1-b18d-442f50ee1ff1';
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000001', true);
do $$ begin
  begin
    perform public.operator_recover_engineering_proactive('795ec8d1-1b07-48e1-b18d-442f50ee1ff1','ENG-PROACTIVE-795ec8d1-1b07-48e1-b18d-442f50ee1ff1','d022d3a63fca2835b877235691b7d255d58e461c','d93c0866e59a2857c5dad9ff011f95456052b5e0cf2e688816f9097399c26aad','d1daebe0d8582440e2cf42e70366f9e158ff759a918d79405a8b2289aeb5a513');
    raise exception 'requires_review false unexpectedly succeeded';
  exception when others then if sqlerrm = 'requires_review false unexpectedly succeeded' then raise; end if; end;
end $$;
reset role;
update public.agent_jobs set requires_review = true, status = 'completed'
where id = '795ec8d1-1b07-48e1-b18d-442f50ee1ff1';
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000001', true);
do $$ begin
  begin
    perform public.operator_recover_engineering_proactive('795ec8d1-1b07-48e1-b18d-442f50ee1ff1','ENG-PROACTIVE-795ec8d1-1b07-48e1-b18d-442f50ee1ff1','d022d3a63fca2835b877235691b7d255d58e461c','d93c0866e59a2857c5dad9ff011f95456052b5e0cf2e688816f9097399c26aad','d1daebe0d8582440e2cf42e70366f9e158ff759a918d79405a8b2289aeb5a513');
    raise exception 'non-failed state unexpectedly succeeded';
  exception when others then if sqlerrm = 'non-failed state unexpectedly succeeded' then raise; end if; end;
end $$;
reset role;
update public.agent_jobs set status = 'failed'
where id = '795ec8d1-1b07-48e1-b18d-442f50ee1ff1';

-- Exact recovery transitions once to awaiting_review, never completed.
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000001', true);
do $$
declare response jsonb;
begin
  response := public.operator_recover_engineering_proactive(
    '795ec8d1-1b07-48e1-b18d-442f50ee1ff1',
    'ENG-PROACTIVE-795ec8d1-1b07-48e1-b18d-442f50ee1ff1',
    'd022d3a63fca2835b877235691b7d255d58e461c',
    'd93c0866e59a2857c5dad9ff011f95456052b5e0cf2e688816f9097399c26aad',
    'd1daebe0d8582440e2cf42e70366f9e158ff759a918d79405a8b2289aeb5a513');
  if not coalesce((response->>'recovered')::boolean, false)
    or response->>'status' <> 'awaiting_review'
  then raise exception 'valid recovery returned unexpected response: %', response; end if;
end;
$$;
reset role;

do $$ begin
  if (select status from public.agent_jobs where id = '795ec8d1-1b07-48e1-b18d-442f50ee1ff1') <> 'awaiting_review' then
    raise exception 'recovery did not stop at awaiting_review';
  end if;
  if (select count(*) from public.engineering_recovery_audit where job_id = '795ec8d1-1b07-48e1-b18d-442f50ee1ff1') <> 1 then
    raise exception 'recovery audit was not created exactly once';
  end if;
  if (select recovered_by_user_id from public.engineering_recovery_audit where job_id = '795ec8d1-1b07-48e1-b18d-442f50ee1ff1') <> '91000000-0000-0000-0000-000000000001'::uuid then
    raise exception 'recovery requester provenance did not come from auth.uid()';
  end if;
  if exists (
    select 1 from public.agent_jobs current_job, recovery_job_before before_job
    where current_job.id = '795ec8d1-1b07-48e1-b18d-442f50ee1ff1'
      and (current_job.result is distinct from before_job.result
        or current_job.completed_at is distinct from before_job.completed_at
        or current_job.processed_at is distinct from before_job.processed_at)
  ) then raise exception 'recovery changed historical job result/timestamps'; end if;
  if (select to_jsonb(r) from public.agent_runs r where id = '92000000-0000-0000-0000-000000000001')
    is distinct from (select row_data from recovery_run_before)
  then raise exception 'recovery changed the historical failed agent_run'; end if;
end $$;

-- Exact duplicate is idempotent; conflicting replay fails and audit remains one row.
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000001', true);
do $$
declare response jsonb;
begin
  response := public.operator_recover_engineering_proactive('795ec8d1-1b07-48e1-b18d-442f50ee1ff1','ENG-PROACTIVE-795ec8d1-1b07-48e1-b18d-442f50ee1ff1','d022d3a63fca2835b877235691b7d255d58e461c','d93c0866e59a2857c5dad9ff011f95456052b5e0cf2e688816f9097399c26aad','d1daebe0d8582440e2cf42e70366f9e158ff759a918d79405a8b2289aeb5a513');
  if not coalesce((response->>'idempotent')::boolean, false) or coalesce((response->>'recovered')::boolean, true) then
    raise exception 'duplicate recovery was not idempotent: %', response;
  end if;
  begin
    perform public.operator_recover_engineering_proactive('795ec8d1-1b07-48e1-b18d-442f50ee1ff1','ENG-PROACTIVE-795ec8d1-1b07-48e1-b18d-442f50ee1ff1','d022d3a63fca2835b877235691b7d255d58e461c','d93c0866e59a2857c5dad9ff011f95456052b5e0cf2e688816f9097399c26aad','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    raise exception 'conflicting duplicate unexpectedly succeeded';
  exception when others then if sqlerrm = 'conflicting duplicate unexpectedly succeeded' then raise; end if; end;
end;
$$;
reset role;

do $$ begin
  if (select count(*) from public.engineering_recovery_audit where job_id = '795ec8d1-1b07-48e1-b18d-442f50ee1ff1') <> 1 then
    raise exception 'idempotent replay duplicated the audit row';
  end if;
  begin
    update public.engineering_recovery_audit set new_status = 'failed'
    where job_id = '795ec8d1-1b07-48e1-b18d-442f50ee1ff1';
    raise exception 'audit update unexpectedly succeeded';
  exception when others then if sqlerrm = 'audit update unexpectedly succeeded' then raise; end if; end;
  begin
    delete from public.engineering_recovery_audit
    where job_id = '795ec8d1-1b07-48e1-b18d-442f50ee1ff1';
    raise exception 'audit delete unexpectedly succeeded';
  exception when others then if sqlerrm = 'audit delete unexpectedly succeeded' then raise; end if; end;
end $$;

rollback;

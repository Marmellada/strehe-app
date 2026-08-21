-- STREHE Engineering Agent proactive checker + operator control plane.
-- SQLite remains the authoritative engineering-memory store. This table holds
-- only bounded operator controls and a redacted dashboard snapshot.

create table public.agent_operator_controls (
  agent_id uuid primary key references public.agent_principals(id) on delete cascade,
  proactive_enabled boolean not null default true,
  paused boolean not null default false,
  cadence_minutes integer not null default 240,
  next_proactive_at timestamp with time zone not null default (now() + interval '4 hours'),
  manual_review_requested_at timestamp with time zone,
  last_proactive_enqueued_at timestamp with time zone,
  local_model_name text,
  worker_state text not null default 'offline',
  current_job_id uuid references public.agent_jobs(id) on delete set null,
  last_error_class text,
  status_snapshot jsonb not null default '{}'::jsonb,
  snapshot_updated_at timestamp with time zone,
  updated_by_user_id uuid references public.app_users(id) on delete set null,
  updated_at timestamp with time zone not null default now(),
  constraint agent_operator_controls_cadence_check check (cadence_minutes between 60 and 10080),
  constraint agent_operator_controls_model_check check (local_model_name is null or char_length(local_model_name) between 1 and 160),
  constraint agent_operator_controls_worker_state_check check (worker_state in ('offline', 'idle', 'working', 'paused', 'error')),
  constraint agent_operator_controls_snapshot_size_check check (octet_length(status_snapshot::text) <= 524288)
);

create unique index idx_one_active_engineering_proactive_job
  on public.agent_jobs(required_capability)
  where job_type = 'engineering.proactive' and status in ('queued', 'running');

alter table public.agent_operator_controls enable row level security;

create policy "Admins can read engineering agent controls"
  on public.agent_operator_controls for select to authenticated
  using (public.is_app_admin());

create policy "Agents can read own operator controls"
  on public.agent_operator_controls for select to authenticated
  using (agent_id = (select auth.uid()) and public.is_active_agent());

grant select on public.agent_operator_controls to authenticated;

create or replace function public.publish_engineering_agent_snapshot(
  status_snapshot jsonb,
  local_model_name text,
  worker_state text,
  active_job_id uuid default null,
  worker_error_class text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.agent_has_capability('engineering.local') then
    raise exception 'Engineering agent capability required';
  end if;
  if worker_state is null or worker_state not in ('idle', 'working', 'paused', 'error') then
    raise exception 'Invalid engineering worker state';
  end if;
  if local_model_name is null or char_length(local_model_name) not between 1 and 160 then
    raise exception 'Invalid local model name';
  end if;
  if octet_length(coalesce(status_snapshot, '{}'::jsonb)::text) > 524288 then
    raise exception 'Engineering snapshot exceeds 512 KiB';
  end if;
  if active_job_id is not null and not exists (
    select 1 from public.agent_jobs
    where id = active_job_id and assigned_agent_id = (select auth.uid())
  ) then
    raise exception 'Active job is not assigned to this agent';
  end if;

  insert into public.agent_operator_controls (
    agent_id, local_model_name, worker_state, current_job_id, last_error_class,
    status_snapshot, snapshot_updated_at, updated_at
  ) values (
    (select auth.uid()), left(local_model_name, 160), worker_state, active_job_id,
    nullif(left(coalesce(worker_error_class, ''), 160), ''), coalesce(status_snapshot, '{}'::jsonb), now(), now()
  )
  on conflict (agent_id) do update set
    local_model_name = excluded.local_model_name,
    worker_state = excluded.worker_state,
    current_job_id = excluded.current_job_id,
    last_error_class = excluded.last_error_class,
    status_snapshot = excluded.status_snapshot,
    snapshot_updated_at = excluded.snapshot_updated_at,
    updated_at = excluded.updated_at;
end;
$$;

create or replace function public.enqueue_due_engineering_proactive(
  target_module text,
  target_commit text,
  target_fingerprint text,
  target_module_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  control_row public.agent_operator_controls;
  new_job_id uuid;
  next_at timestamp with time zone;
  trigger_kind text;
begin
  if not public.agent_has_capability('engineering.local') then
    raise exception 'Engineering agent capability required';
  end if;
  if target_module is null or target_commit is null or target_fingerprint is null
    or target_module_fingerprint is null
    or char_length(btrim(target_module)) not between 1 and 160
    or target_commit !~ '^[0-9a-fA-F]{7,40}$'
    or target_fingerprint !~ '^[0-9a-fA-F]{40}$'
    or target_module_fingerprint !~ '^[0-9a-fA-F]{40,64}$'
  then
    raise exception 'Invalid proactive target';
  end if;

  perform pg_advisory_xact_lock(hashtext('engineering.proactive.scheduler'));

  update public.agent_runs r
  set status = 'failed', error_code = 'job_expired',
      error_message = 'Proactive job expired before completion.', finished_at = now()
  where r.status = 'running' and exists (
    select 1 from public.agent_jobs j
    where j.id = r.job_id and j.required_capability = 'engineering.local'
      and j.job_type = 'engineering.proactive' and j.status in ('queued', 'running')
      and j.expires_at <= now()
  );
  update public.agent_jobs
  set status = 'expired', lease_expires_at = null, updated_at = now()
  where required_capability = 'engineering.local'
    and job_type = 'engineering.proactive'
    and status in ('queued', 'running')
    and expires_at <= now();

  insert into public.agent_operator_controls(agent_id)
  values ((select auth.uid())) on conflict (agent_id) do nothing;
  select * into control_row from public.agent_operator_controls
  where agent_id = (select auth.uid()) for update;

  if control_row.paused then
    return jsonb_build_object('enqueued', false, 'reason', 'paused', 'next_proactive_at', control_row.next_proactive_at);
  end if;
  if not control_row.proactive_enabled and control_row.manual_review_requested_at is null then
    return jsonb_build_object('enqueued', false, 'reason', 'disabled', 'next_proactive_at', control_row.next_proactive_at);
  end if;
  if control_row.manual_review_requested_at is null and control_row.next_proactive_at > now() then
    return jsonb_build_object('enqueued', false, 'reason', 'not_due', 'next_proactive_at', control_row.next_proactive_at);
  end if;
  if exists (
    select 1 from public.agent_jobs
    where required_capability = 'engineering.local'
      and status in ('queued', 'running')
      and job_type <> 'engineering.proactive'
  ) then
    return jsonb_build_object('enqueued', false, 'reason', 'higher_priority_work', 'next_proactive_at', control_row.next_proactive_at);
  end if;
  select id into new_job_id from public.agent_jobs
  where required_capability = 'engineering.local'
    and job_type = 'engineering.proactive'
    and status in ('queued', 'running')
  order by created_at limit 1;
  if new_job_id is not null then
    return jsonb_build_object('enqueued', false, 'reason', 'duplicate', 'job_id', new_job_id, 'next_proactive_at', control_row.next_proactive_at);
  end if;

  trigger_kind := case when control_row.manual_review_requested_at is null then 'cadence' else 'manual' end;
  new_job_id := gen_random_uuid();
  insert into public.agent_jobs (
    id, job_type, required_capability, workspace_type, priority, payload,
    requires_review, expires_at
  ) values (
    new_job_id, 'engineering.proactive', 'engineering.local', 'system', 500,
    jsonb_build_object(
      'type', 'proactive', 'session_id', 'ENG-PROACTIVE-' || new_job_id::text,
      'target_module', btrim(target_module), 'commit_sha', lower(target_commit),
      'target_fingerprint', lower(target_fingerprint),
      'target_module_fingerprint', lower(target_module_fingerprint), 'trigger', trigger_kind
    ),
    true, now() + interval '2 days'
  );
  next_at := now() + make_interval(mins => control_row.cadence_minutes);
  update public.agent_operator_controls set
    next_proactive_at = next_at,
    manual_review_requested_at = null,
    last_proactive_enqueued_at = now(),
    updated_at = now()
  where agent_id = (select auth.uid());
  return jsonb_build_object('enqueued', true, 'reason', trigger_kind, 'job_id', new_job_id, 'next_proactive_at', next_at);
end;
$$;

create or replace function public.operator_update_engineering_finding_lifecycle(
  finding_id bigint,
  finding_lifecycle text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  new_job_id uuid;
begin
  if not public.is_app_admin() then raise exception 'Admin access required'; end if;
  if finding_id is null or finding_id <= 0
    or finding_lifecycle is null
    or upper(finding_lifecycle) not in ('OPEN', 'ACKNOWLEDGED', 'DEFERRED', 'RESOLVED')
  then raise exception 'Invalid finding lifecycle update'; end if;
  if not exists (select 1 from public.agent_principals where agent_key = 'engineering.local' and is_active = true) then
    raise exception 'Engineering Agent is not provisioned';
  end if;
  new_job_id := gen_random_uuid();
  insert into public.agent_jobs (
    id, job_type, required_capability, workspace_type, priority,
    requested_by_user_id, payload, requires_review, expires_at
  ) values (
    new_job_id, 'engineering.finding.lifecycle', 'engineering.local', 'system', 50,
    (select auth.uid()), jsonb_build_object(
      'type', 'finding_lifecycle', 'finding_id', finding_id,
      'lifecycle', upper(finding_lifecycle), 'session_id', 'ENG-FINDING-' || new_job_id::text
    ), false, now() + interval '2 days'
  );
  return jsonb_build_object('ok', true, 'job_id', new_job_id);
end;
$$;

create or replace function public.operator_control_engineering_agent(control_action text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  engineering_agent_id uuid;
  next_at timestamp with time zone;
begin
  if not public.is_app_admin() then
    raise exception 'Admin access required';
  end if;
  if control_action is null or control_action not in ('run_review', 'enable_proactive', 'disable_proactive', 'pause', 'resume') then
    raise exception 'Invalid Engineering Agent control action';
  end if;
  select id into engineering_agent_id from public.agent_principals where agent_key = 'engineering.local';
  if engineering_agent_id is null then raise exception 'Engineering Agent is not provisioned'; end if;

  insert into public.agent_operator_controls(agent_id) values (engineering_agent_id)
  on conflict (agent_id) do nothing;
  if control_action = 'run_review' then
    update public.agent_operator_controls set manual_review_requested_at = now(), next_proactive_at = now(), updated_by_user_id = (select auth.uid()), updated_at = now()
    where agent_id = engineering_agent_id returning next_proactive_at into next_at;
  elsif control_action = 'enable_proactive' then
    update public.agent_operator_controls set proactive_enabled = true, next_proactive_at = greatest(next_proactive_at, now()), updated_by_user_id = (select auth.uid()), updated_at = now()
    where agent_id = engineering_agent_id returning next_proactive_at into next_at;
  elsif control_action = 'disable_proactive' then
    update public.agent_operator_controls set proactive_enabled = false, manual_review_requested_at = null, updated_by_user_id = (select auth.uid()), updated_at = now()
    where agent_id = engineering_agent_id returning next_proactive_at into next_at;
  elsif control_action = 'pause' then
    update public.agent_operator_controls set paused = true, updated_by_user_id = (select auth.uid()), updated_at = now()
    where agent_id = engineering_agent_id returning next_proactive_at into next_at;
  else
    update public.agent_operator_controls set paused = false, updated_by_user_id = (select auth.uid()), updated_at = now()
    where agent_id = engineering_agent_id returning next_proactive_at into next_at;
  end if;
  return jsonb_build_object('ok', true, 'action', control_action, 'next_proactive_at', next_at);
end;
$$;

create or replace function public.defer_engineering_proactive(defer_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  next_at timestamp with time zone;
begin
  if not public.agent_has_capability('engineering.local') then
    raise exception 'Engineering agent capability required';
  end if;
  if defer_reason is null or defer_reason <> 'no_eligible_target' then raise exception 'Invalid proactive defer reason'; end if;
  update public.agent_operator_controls
  set next_proactive_at = now() + make_interval(mins => cadence_minutes),
      manual_review_requested_at = null,
      updated_at = now()
  where agent_id = (select auth.uid())
  returning next_proactive_at into next_at;
  return jsonb_build_object('deferred', true, 'reason', defer_reason, 'next_proactive_at', next_at);
end;
$$;

create or replace function public.get_engineering_agent_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  allowed boolean;
  engineering_agent_id uuid;
  output jsonb;
begin
  select exists (
    select 1 from public.app_users
    where id = (select auth.uid()) and is_active = true and role in ('admin', 'office')
  ) into allowed;
  if not allowed then raise exception 'Operator access required'; end if;
  select id into engineering_agent_id from public.agent_principals where agent_key = 'engineering.local';
  select jsonb_build_object(
    'principal', (select to_jsonb(p) - 'created_by_user_id' from public.agent_principals p where p.id = engineering_agent_id),
    'control', (select to_jsonb(c) - 'updated_by_user_id' from public.agent_operator_controls c where c.agent_id = engineering_agent_id),
    'jobs', coalesce((select jsonb_agg(to_jsonb(j) order by j.created_at desc) from (
      select jobs.id, jobs.job_type, jobs.status, jobs.priority,
             nullif(left(coalesce(jobs.payload->>'target_module', ''), 160), '') as target_module,
             nullif(left(coalesce(jobs.result->>'summary', ''), 240), '') as summary,
             case when jsonb_typeof(jobs.result->'findings') = 'array'
               then least(jsonb_array_length(jobs.result->'findings'), 100) else 0 end as finding_count,
             nullif(left(coalesce(run_error.error_code, ''), 120), '') as error_status,
             jobs.claimed_at, jobs.lease_expires_at, jobs.completed_at, jobs.created_at,
             jobs.updated_at, jobs.attempt_count, jobs.review_decision
      from public.agent_jobs jobs
      left join lateral (
        select error_code from public.agent_runs
        where job_id = jobs.id and error_code is not null
        order by started_at desc limit 1
      ) run_error on true
      where jobs.required_capability = 'engineering.local'
      order by jobs.created_at desc limit 30
    ) j), '[]'::jsonb)
  ) into output;
  return output;
end;
$$;

revoke all on function public.publish_engineering_agent_snapshot(jsonb, text, text, uuid, text) from public;
revoke all on function public.enqueue_due_engineering_proactive(text, text, text, text) from public;
revoke all on function public.operator_control_engineering_agent(text) from public;
revoke all on function public.operator_update_engineering_finding_lifecycle(bigint, text) from public;
revoke all on function public.defer_engineering_proactive(text) from public;
revoke all on function public.get_engineering_agent_dashboard() from public;
grant execute on function public.publish_engineering_agent_snapshot(jsonb, text, text, uuid, text) to authenticated;
grant execute on function public.enqueue_due_engineering_proactive(text, text, text, text) to authenticated;
grant execute on function public.operator_control_engineering_agent(text) to authenticated;
grant execute on function public.operator_update_engineering_finding_lifecycle(bigint, text) to authenticated;
grant execute on function public.defer_engineering_proactive(text) to authenticated;
grant execute on function public.get_engineering_agent_dashboard() to authenticated;

comment on table public.agent_operator_controls is
  'Bounded Engineering Agent controls and redacted operator snapshot; local SQLite remains authoritative memory.';
comment on function public.enqueue_due_engineering_proactive(text, text, text, text) is
  'Atomically enqueues at most one bounded engineering.proactive job after change-aware work.';

begin;

alter table public.app_users
  drop constraint if exists app_users_role_check;

alter table public.app_users
  add constraint app_users_role_check
  check (role in ('admin', 'office', 'field', 'contractor', 'household'));

create or replace function public.is_active_app_user()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.app_users
    where id = (select auth.uid())
      and is_active = true
  );
$$;

create or replace function public.is_active_business_user()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.app_users
    where id = (select auth.uid())
      and is_active = true
      and role in ('admin', 'office', 'field', 'contractor')
  );
$$;

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.app_users
    where id = (select auth.uid())
      and is_active = true
      and role = 'admin'
  );
$$;

revoke all on function public.is_active_app_user() from public;
revoke all on function public.is_active_business_user() from public;
revoke all on function public.is_app_admin() from public;
grant execute on function public.is_active_app_user() to authenticated;
grant execute on function public.is_active_business_user() to authenticated;
grant execute on function public.is_app_admin() to authenticated;

create table public.household_spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_by_user_id uuid references public.app_users(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint household_spaces_name_check
    check (char_length(btrim(name)) between 1 and 120)
);

create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_space_id uuid not null references public.household_spaces(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete cascade,
  access_level text not null default 'member',
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint household_members_access_level_check
    check (access_level in ('owner', 'member', 'viewer')),
  constraint household_members_space_user_key
    unique (household_space_id, user_id)
);

create table public.household_projects (
  id uuid primary key default gen_random_uuid(),
  household_space_id uuid not null references public.household_spaces(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'planned',
  target_date date,
  created_by_user_id uuid references public.app_users(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint household_projects_title_check
    check (char_length(btrim(title)) between 1 and 180),
  constraint household_projects_status_check
    check (status in ('planned', 'active', 'paused', 'completed', 'archived'))
);

create index idx_household_members_user_id
  on public.household_members (user_id, is_active);

create index idx_household_projects_space_status
  on public.household_projects (household_space_id, status);

create or replace function public.is_household_member(target_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.is_app_admin()
    or exists (
      select 1
      from public.household_members
      where household_space_id = target_space_id
        and user_id = (select auth.uid())
        and is_active = true
    );
$$;

create or replace function public.can_edit_household(target_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.is_app_admin()
    or exists (
      select 1
      from public.household_members
      where household_space_id = target_space_id
        and user_id = (select auth.uid())
        and is_active = true
        and access_level in ('owner', 'member')
    );
$$;

create or replace function public.can_manage_household(target_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.is_app_admin()
    or exists (
      select 1
      from public.household_members
      where household_space_id = target_space_id
        and user_id = (select auth.uid())
        and is_active = true
        and access_level = 'owner'
    );
$$;

revoke all on function public.is_household_member(uuid) from public;
revoke all on function public.can_edit_household(uuid) from public;
revoke all on function public.can_manage_household(uuid) from public;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.can_edit_household(uuid) to authenticated;
grant execute on function public.can_manage_household(uuid) to authenticated;

create table public.agent_principals (
  id uuid primary key references auth.users(id) on delete cascade,
  agent_key text not null unique,
  display_name text not null,
  description text,
  is_active boolean not null default true,
  last_seen_at timestamp with time zone,
  created_by_user_id uuid references public.app_users(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint agent_principals_key_check
    check (agent_key ~ '^[a-z0-9][a-z0-9._-]{2,63}$'),
  constraint agent_principals_display_name_check
    check (char_length(btrim(display_name)) between 1 and 120)
);

create table public.agent_capabilities (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agent_principals(id) on delete cascade,
  capability_key text not null,
  constraints jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references public.app_users(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  constraint agent_capabilities_key_check
    check (capability_key ~ '^[a-z0-9][a-z0-9._-]{2,95}$'),
  constraint agent_capabilities_agent_key
    unique (agent_id, capability_key)
);

create table public.agent_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  required_capability text not null,
  workspace_type text not null,
  household_space_id uuid references public.household_spaces(id) on delete cascade,
  subject_type text,
  subject_id uuid,
  status text not null default 'queued',
  priority smallint not null default 100,
  requested_by_user_id uuid references public.app_users(id) on delete set null,
  assigned_agent_id uuid references public.agent_principals(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  requires_review boolean not null default true,
  available_at timestamp with time zone not null default now(),
  claimed_at timestamp with time zone,
  lease_expires_at timestamp with time zone,
  processed_at timestamp with time zone,
  completed_at timestamp with time zone,
  reviewed_by_user_id uuid references public.app_users(id) on delete set null,
  reviewed_at timestamp with time zone,
  review_decision text,
  review_notes text,
  expires_at timestamp with time zone not null default (now() + interval '14 days'),
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint agent_jobs_type_check
    check (job_type ~ '^[a-z0-9][a-z0-9._-]{2,95}$'),
  constraint agent_jobs_capability_check
    check (required_capability ~ '^[a-z0-9][a-z0-9._-]{2,95}$'),
  constraint agent_jobs_workspace_type_check
    check (workspace_type in ('household', 'business', 'inspection', 'system')),
  constraint agent_jobs_household_scope_check
    check (workspace_type <> 'household' or household_space_id is not null),
  constraint agent_jobs_status_check
    check (status in (
      'queued',
      'running',
      'awaiting_review',
      'completed',
      'failed',
      'cancelled',
      'expired'
    )),
  constraint agent_jobs_review_decision_check
    check (review_decision is null or review_decision in ('approved', 'rejected')),
  constraint agent_jobs_priority_check
    check (priority between 1 and 999),
  constraint agent_jobs_attempts_check
    check (attempt_count >= 0 and max_attempts between 1 and 20),
  constraint agent_jobs_payload_size_check
    check (octet_length(payload::text) <= 1048576),
  constraint agent_jobs_result_size_check
    check (result is null or octet_length(result::text) <= 1048576)
);

create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.agent_jobs(id) on delete cascade,
  agent_id uuid not null references public.agent_principals(id) on delete restrict,
  status text not null default 'running',
  started_at timestamp with time zone not null default now(),
  finished_at timestamp with time zone,
  error_code text,
  error_message text,
  metrics jsonb not null default '{}'::jsonb,
  constraint agent_runs_status_check
    check (status in ('running', 'completed', 'failed', 'cancelled'))
);

create table public.agent_artifacts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.agent_jobs(id) on delete cascade,
  run_id uuid references public.agent_runs(id) on delete cascade,
  artifact_kind text not null,
  storage_bucket text not null default 'agent-artifacts',
  storage_path text not null unique,
  mime_type text,
  byte_size bigint,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone not null default now(),
  constraint agent_artifacts_kind_check
    check (artifact_kind in ('input', 'output', 'preview', 'log')),
  constraint agent_artifacts_bucket_check
    check (storage_bucket = 'agent-artifacts'),
  constraint agent_artifacts_byte_size_check
    check (byte_size is null or byte_size >= 0)
);

create index idx_agent_capabilities_agent
  on public.agent_capabilities (agent_id, capability_key);

create index idx_agent_jobs_queue
  on public.agent_jobs (status, available_at, priority, created_at);

create index idx_agent_jobs_agent_status
  on public.agent_jobs (assigned_agent_id, status);

create index idx_agent_jobs_household
  on public.agent_jobs (household_space_id, created_at desc);

create index idx_agent_runs_job
  on public.agent_runs (job_id, started_at desc);

create index idx_agent_artifacts_job
  on public.agent_artifacts (job_id, created_at);

create or replace function public.is_active_agent()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.agent_principals
    where id = (select auth.uid())
      and is_active = true
  );
$$;

create or replace function public.agent_has_capability(target_capability text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.is_active_agent()
    and exists (
      select 1
      from public.agent_capabilities
      where agent_id = (select auth.uid())
        and capability_key = target_capability
    );
$$;

create or replace function public.can_read_agent_job(target_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.is_app_admin()
    or exists (
      select 1
      from public.agent_jobs
      where id = target_job_id
        and household_space_id is not null
        and public.is_household_member(household_space_id)
    )
    or exists (
      select 1
      from public.agent_jobs
      where id = target_job_id
        and assigned_agent_id = (select auth.uid())
        and public.is_active_agent()
    );
$$;

create or replace function public.is_agent_assigned_to_job(target_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.is_active_agent()
    and exists (
      select 1
      from public.agent_jobs
      where id = target_job_id
        and assigned_agent_id = (select auth.uid())
    );
$$;

create or replace function public.can_read_agent_artifact(target_storage_path text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.agent_artifacts
    where storage_path = target_storage_path
      and public.can_read_agent_job(job_id)
  );
$$;

revoke all on function public.is_active_agent() from public;
revoke all on function public.agent_has_capability(text) from public;
revoke all on function public.can_read_agent_job(uuid) from public;
revoke all on function public.is_agent_assigned_to_job(uuid) from public;
revoke all on function public.can_read_agent_artifact(text) from public;
grant execute on function public.is_active_agent() to authenticated;
grant execute on function public.agent_has_capability(text) to authenticated;
grant execute on function public.can_read_agent_job(uuid) to authenticated;
grant execute on function public.is_agent_assigned_to_job(uuid) to authenticated;
grant execute on function public.can_read_agent_artifact(text) to authenticated;

alter table public.household_spaces enable row level security;
alter table public.household_members enable row level security;
alter table public.household_projects enable row level security;
alter table public.agent_principals enable row level security;
alter table public.agent_capabilities enable row level security;
alter table public.agent_jobs enable row level security;
alter table public.agent_runs enable row level security;
alter table public.agent_artifacts enable row level security;

create policy "Household members can read spaces"
  on public.household_spaces
  for select
  to authenticated
  using (public.is_household_member(id));

create policy "Household managers can create spaces"
  on public.household_spaces
  for insert
  to authenticated
  with check (public.is_app_admin());

create policy "Household managers can update spaces"
  on public.household_spaces
  for update
  to authenticated
  using (public.can_manage_household(id))
  with check (public.can_manage_household(id));

create policy "Household managers can delete spaces"
  on public.household_spaces
  for delete
  to authenticated
  using (public.can_manage_household(id));

create policy "Household members can read memberships"
  on public.household_members
  for select
  to authenticated
  using (public.is_household_member(household_space_id));

create policy "Household managers can create memberships"
  on public.household_members
  for insert
  to authenticated
  with check (public.can_manage_household(household_space_id));

create policy "Household managers can update memberships"
  on public.household_members
  for update
  to authenticated
  using (public.can_manage_household(household_space_id))
  with check (public.can_manage_household(household_space_id));

create policy "Household managers can delete memberships"
  on public.household_members
  for delete
  to authenticated
  using (public.can_manage_household(household_space_id));

create policy "Household members can read projects"
  on public.household_projects
  for select
  to authenticated
  using (public.is_household_member(household_space_id));

create policy "Household editors can create projects"
  on public.household_projects
  for insert
  to authenticated
  with check (
    public.can_edit_household(household_space_id)
    and created_by_user_id = (select auth.uid())
  );

create policy "Household editors can update projects"
  on public.household_projects
  for update
  to authenticated
  using (public.can_edit_household(household_space_id))
  with check (public.can_edit_household(household_space_id));

create policy "Household managers can delete projects"
  on public.household_projects
  for delete
  to authenticated
  using (public.can_manage_household(household_space_id));

create policy "Admins can manage agent principals"
  on public.agent_principals
  for all
  to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

create policy "Agents can read own principal"
  on public.agent_principals
  for select
  to authenticated
  using (id = (select auth.uid()) and is_active = true);

create policy "Admins can manage agent capabilities"
  on public.agent_capabilities
  for all
  to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

create policy "Agents can read own capabilities"
  on public.agent_capabilities
  for select
  to authenticated
  using (agent_id = (select auth.uid()) and public.is_active_agent());

create policy "Admins can manage agent jobs"
  on public.agent_jobs
  for all
  to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

create policy "Household members can read their agent jobs"
  on public.agent_jobs
  for select
  to authenticated
  using (
    household_space_id is not null
    and public.is_household_member(household_space_id)
  );

create policy "Household editors can request agent jobs"
  on public.agent_jobs
  for insert
  to authenticated
  with check (
    workspace_type = 'household'
    and household_space_id is not null
    and public.can_edit_household(household_space_id)
    and requested_by_user_id = (select auth.uid())
    and assigned_agent_id is null
    and status = 'queued'
    and expires_at <= now() + interval '30 days'
  );

create policy "Agents can read eligible jobs"
  on public.agent_jobs
  for select
  to authenticated
  using (
    public.is_active_agent()
    and (
      assigned_agent_id = (select auth.uid())
      or (
        assigned_agent_id is null
        and status = 'queued'
        and available_at <= now()
        and expires_at > now()
        and public.agent_has_capability(required_capability)
      )
    )
  );

create policy "Admins can manage agent runs"
  on public.agent_runs
  for all
  to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

create policy "Agents can read own runs"
  on public.agent_runs
  for select
  to authenticated
  using (agent_id = (select auth.uid()) and public.is_active_agent());

create policy "Admins can manage agent artifacts"
  on public.agent_artifacts
  for all
  to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

create policy "Authorized users can read agent artifacts"
  on public.agent_artifacts
  for select
  to authenticated
  using (public.can_read_agent_job(job_id));

create policy "Assigned agents can create artifact metadata"
  on public.agent_artifacts
  for insert
  to authenticated
  with check (
    public.is_agent_assigned_to_job(job_id)
    and split_part(storage_path, '/', 1) = (select auth.uid())::text
    and expires_at <= now() + interval '30 days'
  );

create policy "Assigned agents can update artifact metadata"
  on public.agent_artifacts
  for update
  to authenticated
  using (public.is_agent_assigned_to_job(job_id))
  with check (
    public.is_agent_assigned_to_job(job_id)
    and split_part(storage_path, '/', 1) = (select auth.uid())::text
    and expires_at <= now() + interval '30 days'
  );

create policy "Assigned agents can delete artifact metadata"
  on public.agent_artifacts
  for delete
  to authenticated
  using (public.is_agent_assigned_to_job(job_id));

grant select, insert, update, delete
  on public.household_spaces,
     public.household_members,
     public.household_projects,
     public.agent_principals,
     public.agent_capabilities,
     public.agent_jobs,
     public.agent_runs,
     public.agent_artifacts
  to authenticated;

create or replace function public.heartbeat_agent()
returns timestamp with time zone
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  heartbeat_at timestamp with time zone := now();
begin
  if not public.is_active_agent() then
    raise exception 'Active agent identity required';
  end if;

  update public.agent_principals
  set last_seen_at = heartbeat_at,
      updated_at = heartbeat_at
  where id = (select auth.uid());

  return heartbeat_at;
end;
$$;

create or replace function public.claim_agent_job(
  target_job_id uuid,
  lease_seconds integer default 300
)
returns public.agent_jobs
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  claimed_job public.agent_jobs;
begin
  if not public.is_active_agent() then
    raise exception 'Active agent identity required';
  end if;

  if lease_seconds < 30 or lease_seconds > 3600 then
    raise exception 'Lease must be between 30 and 3600 seconds';
  end if;

  select *
  into claimed_job
  from public.agent_jobs
  where id = target_job_id
  for update;

  if not found then
    raise exception 'Agent job not found';
  end if;

  if claimed_job.status not in ('queued', 'running')
    or (
      claimed_job.status = 'running'
      and (
        claimed_job.lease_expires_at is null
        or claimed_job.lease_expires_at > now()
      )
    )
    or claimed_job.available_at > now()
    or claimed_job.expires_at <= now()
    or claimed_job.attempt_count >= claimed_job.max_attempts
  then
    raise exception 'Agent job is not claimable';
  end if;

  if claimed_job.status = 'queued'
    and claimed_job.assigned_agent_id is not null
    and claimed_job.assigned_agent_id <> (select auth.uid())
  then
    raise exception 'Agent job is assigned to another agent';
  end if;

  if not public.agent_has_capability(claimed_job.required_capability) then
    raise exception 'Agent capability is not granted';
  end if;

  if claimed_job.status = 'running' then
    update public.agent_runs
    set status = 'failed',
        error_code = 'lease_expired',
        error_message = 'The agent lease expired before the job was reclaimed.',
        finished_at = now()
    where job_id = target_job_id
      and status = 'running';
  end if;

  update public.agent_jobs
  set assigned_agent_id = (select auth.uid()),
      status = 'running',
      claimed_at = now(),
      lease_expires_at = now() + make_interval(secs => lease_seconds),
      processed_at = null,
      completed_at = null,
      attempt_count = attempt_count + 1,
      updated_at = now()
  where id = target_job_id
  returning * into claimed_job;

  insert into public.agent_runs (job_id, agent_id)
  values (claimed_job.id, (select auth.uid()));

  update public.agent_principals
  set last_seen_at = now(),
      updated_at = now()
  where id = (select auth.uid());

  return claimed_job;
end;
$$;

create or replace function public.renew_agent_job_lease(
  target_job_id uuid,
  lease_seconds integer default 300
)
returns timestamp with time zone
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  renewed_until timestamp with time zone;
begin
  if not public.is_active_agent() then
    raise exception 'Active agent identity required';
  end if;

  if lease_seconds < 30 or lease_seconds > 3600 then
    raise exception 'Lease must be between 30 and 3600 seconds';
  end if;

  update public.agent_jobs
  set lease_expires_at = now() + make_interval(secs => lease_seconds),
      updated_at = now()
  where id = target_job_id
    and assigned_agent_id = (select auth.uid())
    and status = 'running'
    and lease_expires_at > now()
    and expires_at > now()
  returning lease_expires_at into renewed_until;

  if renewed_until is null then
    raise exception 'Running agent job not found';
  end if;

  perform public.heartbeat_agent();
  return renewed_until;
end;
$$;

create or replace function public.complete_agent_job(
  target_job_id uuid,
  job_result jsonb
)
returns public.agent_jobs
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  completed_job public.agent_jobs;
begin
  if not public.is_active_agent() then
    raise exception 'Active agent identity required';
  end if;

  if octet_length(coalesce(job_result, '{}'::jsonb)::text) > 1048576 then
    raise exception 'Agent result exceeds the 1 MB limit';
  end if;

  update public.agent_jobs
  set result = coalesce(job_result, '{}'::jsonb),
      status = case when requires_review then 'awaiting_review' else 'completed' end,
      processed_at = now(),
      completed_at = case when requires_review then null else now() end,
      lease_expires_at = null,
      updated_at = now()
  where id = target_job_id
    and assigned_agent_id = (select auth.uid())
    and status = 'running'
    and lease_expires_at > now()
  returning * into completed_job;

  if completed_job.id is null then
    raise exception 'Running agent job not found';
  end if;

  update public.agent_runs
  set status = 'completed',
      finished_at = now()
  where id = (
    select id
    from public.agent_runs
    where job_id = target_job_id
      and agent_id = (select auth.uid())
      and status = 'running'
    order by started_at desc
    limit 1
  );

  perform public.heartbeat_agent();
  return completed_job;
end;
$$;

create or replace function public.fail_agent_job(
  target_job_id uuid,
  failure_code text,
  failure_message text
)
returns public.agent_jobs
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  failed_job public.agent_jobs;
begin
  if not public.is_active_agent() then
    raise exception 'Active agent identity required';
  end if;

  update public.agent_jobs
  set status = 'failed',
      lease_expires_at = null,
      completed_at = now(),
      updated_at = now()
  where id = target_job_id
    and assigned_agent_id = (select auth.uid())
    and status = 'running'
    and lease_expires_at > now()
  returning * into failed_job;

  if failed_job.id is null then
    raise exception 'Running agent job not found';
  end if;

  update public.agent_runs
  set status = 'failed',
      error_code = nullif(left(failure_code, 120), ''),
      error_message = nullif(left(failure_message, 4000), ''),
      finished_at = now()
  where id = (
    select id
    from public.agent_runs
    where job_id = target_job_id
      and agent_id = (select auth.uid())
      and status = 'running'
    order by started_at desc
    limit 1
  );

  perform public.heartbeat_agent();
  return failed_job;
end;
$$;

create or replace function public.review_agent_job(
  target_job_id uuid,
  decision text,
  notes text default null
)
returns public.agent_jobs
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  reviewed_job public.agent_jobs;
begin
  if not public.is_active_app_user() then
    raise exception 'Active application user required';
  end if;

  if decision not in ('approved', 'rejected') then
    raise exception 'Review decision must be approved or rejected';
  end if;

  select *
  into reviewed_job
  from public.agent_jobs
  where id = target_job_id
  for update;

  if not found or reviewed_job.status <> 'awaiting_review' then
    raise exception 'Agent job is not awaiting review';
  end if;

  if not public.is_app_admin()
    and (
      reviewed_job.household_space_id is null
      or not public.can_edit_household(reviewed_job.household_space_id)
    )
  then
    raise exception 'Agent job review access denied';
  end if;

  update public.agent_jobs
  set status = case when decision = 'approved' then 'completed' else 'failed' end,
      review_decision = decision,
      review_notes = nullif(left(notes, 4000), ''),
      reviewed_by_user_id = (select auth.uid()),
      reviewed_at = now(),
      completed_at = now(),
      updated_at = now()
  where id = target_job_id
  returning * into reviewed_job;

  return reviewed_job;
end;
$$;

revoke all on function public.heartbeat_agent() from public;
revoke all on function public.claim_agent_job(uuid, integer) from public;
revoke all on function public.renew_agent_job_lease(uuid, integer) from public;
revoke all on function public.complete_agent_job(uuid, jsonb) from public;
revoke all on function public.fail_agent_job(uuid, text, text) from public;
revoke all on function public.review_agent_job(uuid, text, text) from public;
grant execute on function public.heartbeat_agent() to authenticated;
grant execute on function public.claim_agent_job(uuid, integer) to authenticated;
grant execute on function public.renew_agent_job_lease(uuid, integer) to authenticated;
grant execute on function public.complete_agent_job(uuid, jsonb) to authenticated;
grant execute on function public.fail_agent_job(uuid, text, text) to authenticated;
grant execute on function public.review_agent_job(uuid, text, text) to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'agent-artifacts',
  'agent-artifacts',
  false,
  15728640,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'application/json',
    'text/plain'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Admins can manage agent artifact files"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'agent-artifacts' and public.is_app_admin())
  with check (bucket_id = 'agent-artifacts' and public.is_app_admin());

create policy "Agents can read own artifact files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'agent-artifacts'
    and public.is_active_agent()
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Agents can upload own artifact files"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'agent-artifacts'
    and public.is_active_agent()
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Agents can update own artifact files"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'agent-artifacts'
    and public.is_active_agent()
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'agent-artifacts'
    and public.is_active_agent()
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Agents can delete own artifact files"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'agent-artifacts'
    and public.is_active_agent()
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Authorized household users can read artifact files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'agent-artifacts'
    and public.can_read_agent_artifact(name)
  );

do $$
declare
  table_name text;
  business_tables text[] := array[
    'bank_identifiers',
    'banks',
    'clients',
    'company_bank_accounts',
    'expense_categories',
    'expenses',
    'inspection_lab_case_photos',
    'inspection_lab_cases',
    'inspection_lab_tracked_objects',
    'invoice_items',
    'invoices',
    'key_logs',
    'keys',
    'lead_events',
    'lead_interactions',
    'leads',
    'locations',
    'municipalities',
    'package_services',
    'packages',
    'payments',
    'promotion_campaigns',
    'promotion_codes',
    'promotion_redemptions',
    'properties',
    'services',
    'subscriptions',
    'subscription_tasks',
    'task_attachments',
    'task_reports',
    'task_templates',
    'tasks',
    'vendors',
    'worker_role_title_history',
    'workers',
    'invoice_number_sequences',
    'credit_note_number_sequences'
  ];
begin
  foreach table_name in array business_tables loop
    if to_regclass(format('public.%I', table_name)) is not null
      and not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = table_name
          and policyname = 'Business identity boundary'
      )
    then
      execute format(
        'create policy "Business identity boundary" on public.%I as restrictive for all to authenticated using (public.is_active_business_user()) with check (public.is_active_business_user())',
        table_name
      );
    end if;
  end loop;
end $$;

create policy "Application users can read allowed profiles"
  on public.app_users
  as restrictive
  for select
  to authenticated
  using (
    public.is_active_business_user()
    or (
      public.is_active_app_user()
      and id = (select auth.uid())
    )
  );

create policy "Admins can insert application profiles"
  on public.app_users
  as restrictive
  for insert
  to authenticated
  with check (public.is_app_admin());

create policy "Admins can update application profiles"
  on public.app_users
  as restrictive
  for update
  to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

create policy "Admins can delete application profiles"
  on public.app_users
  as restrictive
  for delete
  to authenticated
  using (public.is_app_admin());

create policy "Application identities can read company settings"
  on public.company_settings
  as restrictive
  for select
  to authenticated
  using (public.is_active_app_user());

create policy "Admins can insert company settings"
  on public.company_settings
  as restrictive
  for insert
  to authenticated
  with check (public.is_app_admin());

create policy "Admins can update company settings"
  on public.company_settings
  as restrictive
  for update
  to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

create policy "Admins can delete company settings"
  on public.company_settings
  as restrictive
  for delete
  to authenticated
  using (public.is_app_admin());

create policy "Business identities gate task attachments"
  on storage.objects
  as restrictive
  for all
  to authenticated
  using (
    bucket_id <> 'task-attachments'
    or public.is_active_business_user()
  )
  with check (
    bucket_id <> 'task-attachments'
    or public.is_active_business_user()
  );

create policy "Application identities can read company logos"
  on storage.objects
  as restrictive
  for select
  to authenticated
  using (
    bucket_id <> 'company-logos'
    or public.is_active_app_user()
  );

create policy "Admins can insert company logos"
  on storage.objects
  as restrictive
  for insert
  to authenticated
  with check (
    bucket_id <> 'company-logos'
    or public.is_app_admin()
  );

create policy "Admins can update company logos"
  on storage.objects
  as restrictive
  for update
  to authenticated
  using (
    bucket_id <> 'company-logos'
    or public.is_app_admin()
  )
  with check (
    bucket_id <> 'company-logos'
    or public.is_app_admin()
  );

create policy "Admins can delete company logos"
  on storage.objects
  as restrictive
  for delete
  to authenticated
  using (
    bucket_id <> 'company-logos'
    or public.is_app_admin()
  );

do $$
declare
  default_space_id uuid;
  first_admin_id uuid;
begin
  select id
  into first_admin_id
  from public.app_users
  where role = 'admin'
    and is_active = true
  order by created_at
  limit 1;

  if first_admin_id is not null
    and not exists (select 1 from public.household_spaces)
  then
    insert into public.household_spaces (name, created_by_user_id)
    values ('STREHË Household', first_admin_id)
    returning id into default_space_id;

    insert into public.household_members (
      household_space_id,
      user_id,
      access_level
    )
    select default_space_id, id, 'owner'
    from public.app_users
    where role = 'admin'
      and is_active = true
    on conflict (household_space_id, user_id) do nothing;
  end if;
end $$;

commit;

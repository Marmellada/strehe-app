-- One-purpose, review-gated recovery for the verified Engineering proactive run.
-- Local SQLite evidence is verified separately and represented here only by its
-- pinned SHA-256 provenance. This migration does not perform the recovery.

create table public.engineering_recovery_audit (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.agent_jobs(id) on delete restrict,
  session_id text not null,
  target_commit text not null,
  module_fingerprint text not null,
  evidence_sha256 text not null,
  recovered_by_user_id uuid not null references public.app_users(id) on delete restrict,
  previous_status text not null,
  new_status text not null,
  created_at timestamp with time zone not null default now(),
  constraint engineering_recovery_audit_one_per_job unique (job_id),
  constraint engineering_recovery_audit_session_check
    check (session_id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$'),
  constraint engineering_recovery_audit_commit_check
    check (target_commit ~ '^[0-9a-f]{40}$'),
  constraint engineering_recovery_audit_fingerprint_check
    check (module_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint engineering_recovery_audit_evidence_check
    check (evidence_sha256 ~ '^[0-9a-f]{64}$'),
  constraint engineering_recovery_audit_transition_check
    check (previous_status = 'failed' and new_status = 'awaiting_review')
);

alter table public.engineering_recovery_audit enable row level security;

create policy "Admins can read Engineering recovery audit"
  on public.engineering_recovery_audit for select to authenticated
  using (public.is_app_admin());

revoke all on table public.engineering_recovery_audit from public, anon, authenticated;
grant select on table public.engineering_recovery_audit to authenticated;

create or replace function public.prevent_engineering_recovery_audit_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Engineering recovery audit rows are immutable';
end;
$$;

create trigger engineering_recovery_audit_immutable
before update or delete on public.engineering_recovery_audit
for each row execute function public.prevent_engineering_recovery_audit_mutation();

revoke all on function public.prevent_engineering_recovery_audit_mutation() from public, anon, authenticated;

create or replace function public.operator_recover_engineering_proactive(
  target_job_id uuid,
  expected_session_id text,
  expected_target_commit text,
  expected_module_fingerprint text,
  evidence_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  caller_id constant uuid := (select auth.uid());
  pinned_job_id constant uuid := '795ec8d1-1b07-48e1-b18d-442f50ee1ff1'::uuid;
  pinned_session_id constant text := 'ENG-PROACTIVE-795ec8d1-1b07-48e1-b18d-442f50ee1ff1';
  pinned_target_commit constant text := 'd022d3a63fca2835b877235691b7d255d58e461c';
  pinned_module_fingerprint constant text := 'd93c0866e59a2857c5dad9ff011f95456052b5e0cf2e688816f9097399c26aad';
  pinned_evidence_sha256 constant text := 'd1daebe0d8582440e2cf42e70366f9e158ff759a918d79405a8b2289aeb5a513';
  target_job public.agent_jobs;
  existing_audit public.engineering_recovery_audit;
begin
  if caller_id is null or not public.is_app_admin() then
    raise exception 'Admin access required';
  end if;

  if target_job_id is distinct from pinned_job_id
    or expected_session_id is distinct from pinned_session_id
    or lower(expected_target_commit) is distinct from pinned_target_commit
    or lower(expected_module_fingerprint) is distinct from pinned_module_fingerprint
    or lower(evidence_sha256) is distinct from pinned_evidence_sha256
  then
    raise exception 'Recovery pins do not match the approved proactive evidence';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('engineering.proactive.recovery:' || target_job_id::text, 0));

  select * into target_job
  from public.agent_jobs
  where id = target_job_id
  for update;

  if target_job.id is null then
    raise exception 'Pinned Engineering proactive job not found';
  end if;
  if target_job.job_type <> 'engineering.proactive' then
    raise exception 'Pinned job is not engineering.proactive';
  end if;
  if target_job.requires_review is not true then
    raise exception 'Pinned job must require human review';
  end if;
  if target_job.payload->>'session_id' is distinct from expected_session_id then
    raise exception 'Pinned session does not match the job payload';
  end if;
  if lower(target_job.payload->>'commit_sha') is distinct from lower(expected_target_commit) then
    raise exception 'Pinned target commit does not match the job payload';
  end if;
  if lower(target_job.payload->>'target_module_fingerprint') is distinct from lower(expected_module_fingerprint) then
    raise exception 'Pinned module fingerprint does not match the job payload';
  end if;
  if target_job.payload->>'target_module' is distinct from 'Supabase infra' then
    raise exception 'Pinned target module does not match the job payload';
  end if;
  if lower(target_job.payload->>'target_fingerprint') is distinct from '1751ba633a2fdd65ec1c31595e69ccd8010bc877' then
    raise exception 'Pinned target tree does not match the job payload';
  end if;

  select * into existing_audit
  from public.engineering_recovery_audit
  where job_id = target_job_id;

  if existing_audit.id is not null then
    if existing_audit.session_id is distinct from expected_session_id
      or existing_audit.target_commit is distinct from lower(expected_target_commit)
      or existing_audit.module_fingerprint is distinct from lower(expected_module_fingerprint)
      or existing_audit.evidence_sha256 is distinct from lower(evidence_sha256)
    then
      raise exception 'Conflicting Engineering recovery provenance';
    end if;
    if target_job.status <> 'awaiting_review' then
      raise exception 'Recovered job no longer has the audited awaiting_review state';
    end if;
    return jsonb_build_object(
      'ok', true,
      'recovered', false,
      'idempotent', true,
      'job_id', target_job.id,
      'status', target_job.status,
      'audit_id', existing_audit.id,
      'recovered_by_user_id', existing_audit.recovered_by_user_id
    );
  end if;

  if target_job.status <> 'failed' then
    raise exception 'Pinned job is not in the failed state';
  end if;

  update public.agent_jobs
  set status = 'awaiting_review',
      lease_expires_at = null,
      updated_at = now()
  where id = target_job_id and status = 'failed';

  if not found then
    raise exception 'Pinned failed job could not be recovered';
  end if;

  insert into public.engineering_recovery_audit (
    job_id, session_id, target_commit, module_fingerprint, evidence_sha256,
    recovered_by_user_id, previous_status, new_status
  ) values (
    target_job_id, expected_session_id, lower(expected_target_commit),
    lower(expected_module_fingerprint), lower(evidence_sha256), caller_id,
    'failed', 'awaiting_review'
  )
  returning * into existing_audit;

  return jsonb_build_object(
    'ok', true,
    'recovered', true,
    'idempotent', false,
    'job_id', target_job_id,
    'status', 'awaiting_review',
    'audit_id', existing_audit.id,
    'recovered_by_user_id', caller_id
  );
end;
$$;

revoke all on function public.operator_recover_engineering_proactive(uuid, text, text, text, text)
  from public, anon;
grant execute on function public.operator_recover_engineering_proactive(uuid, text, text, text, text)
  to authenticated;

comment on table public.engineering_recovery_audit is
  'Immutable provenance for one-purpose, admin-authorized Engineering proactive recovery.';
comment on function public.operator_recover_engineering_proactive(uuid, text, text, text, text) is
  'Idempotently moves the single pinned failed proactive job to awaiting_review after separate local evidence verification.';

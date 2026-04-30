create table if not exists public.lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  event_type text not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references public.app_users(id) on delete set null,
  created_at timestamp with time zone not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'lead_events_type_check'
  ) then
    alter table public.lead_events
      add constraint lead_events_type_check
      check (
        event_type in (
          'created',
          'updated',
          'interaction',
          'status_changed',
          'assigned',
          'follow_up_changed',
          'converted'
        )
      );
  end if;
end $$;

create index if not exists idx_lead_events_lead_id_created_at
  on public.lead_events(lead_id, created_at desc);

alter table public.lead_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'lead_events'
      and policyname = 'Authenticated users can select'
  ) then
    create policy "Authenticated users can select"
      on public.lead_events for select to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'lead_events'
      and policyname = 'Authenticated users can insert'
  ) then
    create policy "Authenticated users can insert"
      on public.lead_events for insert to authenticated with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'lead_events'
      and policyname = 'Authenticated users can update'
  ) then
    create policy "Authenticated users can update"
      on public.lead_events for update to authenticated using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'lead_events'
      and policyname = 'Authenticated users can delete'
  ) then
    create policy "Authenticated users can delete"
      on public.lead_events for delete to authenticated using (true);
  end if;
end $$;

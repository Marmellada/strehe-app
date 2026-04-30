create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  country text default 'Kosovo',
  city text,
  source text,
  status text not null default 'new',
  priority text not null default 'normal',
  next_follow_up_date date,
  assigned_user_id uuid references public.app_users(id) on delete set null,
  notes text,
  converted_client_id uuid references public.clients(id) on delete set null,
  converted_at timestamp with time zone,
  created_by_user_id uuid references public.app_users(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'leads_status_check'
  ) then
    alter table public.leads
      add constraint leads_status_check
      check (status in ('new', 'contacted', 'interested', 'won', 'lost'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'leads_priority_check'
  ) then
    alter table public.leads
      add constraint leads_priority_check
      check (priority in ('low', 'normal', 'high'));
  end if;
end $$;

create table if not exists public.lead_interactions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  interaction_type text not null default 'note',
  summary text not null,
  interaction_date timestamp with time zone not null default now(),
  created_by_user_id uuid references public.app_users(id) on delete set null,
  created_at timestamp with time zone not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'lead_interactions_type_check'
  ) then
    alter table public.lead_interactions
      add constraint lead_interactions_type_check
      check (interaction_type in ('note', 'call', 'whatsapp', 'email', 'meeting'));
  end if;
end $$;

create index if not exists idx_leads_status on public.leads(status);
create index if not exists idx_leads_next_follow_up_date on public.leads(next_follow_up_date);
create index if not exists idx_leads_assigned_user_id on public.leads(assigned_user_id);
create index if not exists idx_leads_converted_client_id on public.leads(converted_client_id);
create index if not exists idx_lead_interactions_lead_id_date on public.lead_interactions(lead_id, interaction_date desc);

alter table public.leads enable row level security;
alter table public.lead_interactions enable row level security;

do $$
declare
  table_name text;
  crm_tables text[] := array['leads', 'lead_interactions'];
begin
  foreach table_name in array crm_tables loop
    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and policyname = 'Authenticated users can select'
    ) then
      execute format(
        'create policy "Authenticated users can select" on public.%I for select to authenticated using (true)',
        table_name
      );
    end if;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and policyname = 'Authenticated users can insert'
    ) then
      execute format(
        'create policy "Authenticated users can insert" on public.%I for insert to authenticated with check (true)',
        table_name
      );
    end if;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and policyname = 'Authenticated users can update'
    ) then
      execute format(
        'create policy "Authenticated users can update" on public.%I for update to authenticated using (true) with check (true)',
        table_name
      );
    end if;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and policyname = 'Authenticated users can delete'
    ) then
      execute format(
        'create policy "Authenticated users can delete" on public.%I for delete to authenticated using (true)',
        table_name
      );
    end if;
  end loop;
end $$;

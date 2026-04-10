alter table public.subscriptions
  add column if not exists physical_contract_confirmed_at timestamp with time zone,
  add column if not exists physical_contract_confirmed_by_user_id uuid;

do $$
begin
  alter table public.subscriptions
    drop constraint if exists subscriptions_physical_contract_confirmed_by_user_id_fkey;

  alter table public.subscriptions
    add constraint subscriptions_physical_contract_confirmed_by_user_id_fkey
    foreign key (physical_contract_confirmed_by_user_id)
    references public.app_users(id)
    on delete set null
    not valid;
exception
  when duplicate_object then null;
end $$;

create index if not exists idx_subscriptions_physical_contract_confirmed_by_user_id
  on public.subscriptions (physical_contract_confirmed_by_user_id);

-- Phase A.2 reconciliation only.
-- This migration is intentionally incremental and idempotent where possible.

create table if not exists public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'field',
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'app_users_role_check'
  ) then
    alter table public.app_users
      add constraint app_users_role_check
      check (role in ('admin', 'office', 'field', 'contractor'));
  end if;
end $$;

insert into public.app_users (
  id,
  email,
  full_name,
  role,
  is_active,
  created_at,
  updated_at
)
select
  auth_id,
  email,
  full_name,
  case
    when role in ('admin', 'owner', 'manager', 'finance') then 'admin'::public.app_role
    when role in ('staff', 'operator', 'operations') then 'office'::public.app_role
    when role = 'contractor' then 'contractor'::public.app_role
    else 'field'::public.app_role
  end,
  coalesce(is_active, true),
  coalesce(created_at, now()),
  updated_at
from public.users
where auth_id is not null
on conflict (id) do nothing;
create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone
);

create unique index if not exists expense_categories_name_key
  on public.expense_categories (name);

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_person text,
  email text,
  phone text,
  address text,
  notes text,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone
);

create unique index if not exists vendors_name_key
  on public.vendors (name);

create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  personal_id text,
  email text,
  phone text,
  role_title text not null,
  worker_type text not null,
  status text not null,
  start_date date not null,
  end_date date,
  base_salary numeric(12,2),
  payment_frequency text,
  payment_method text,
  bank_account text,
  subject_to_tax boolean not null default false,
  subject_to_pension boolean not null default false,
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone
);

create table if not exists public.worker_role_title_history (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete cascade,
  role_title text not null,
  valid_from date not null,
  valid_to date,
  change_reason text,
  created_at timestamp with time zone not null default now()
);

create index if not exists worker_role_title_history_worker_id_idx
  on public.worker_role_title_history (worker_id);

alter table public.tasks
  add column if not exists assigned_user_id uuid,
  add column if not exists created_by_user_id uuid,
  add column if not exists reported_by_user_id uuid,
  add column if not exists created_by_user_name_snapshot text,
  add column if not exists assigned_user_name_snapshot text,
  add column if not exists reported_by_user_name_snapshot text,
  add column if not exists service_name_snapshot text,
  add column if not exists subscription_package_name_snapshot text,
  add column if not exists property_code_snapshot text;

update public.tasks
set assigned_user_id = assigned_to_user_id
where assigned_user_id is null
  and assigned_to_user_id is not null;

do $$
begin
  alter table public.tasks drop constraint if exists tasks_assigned_user_id_fkey;
  alter table public.tasks
    add constraint tasks_assigned_user_id_fkey
    foreign key (assigned_user_id) references public.app_users(id) on delete set null
    not valid;

  alter table public.tasks drop constraint if exists tasks_created_by_user_id_fkey;
  alter table public.tasks
    add constraint tasks_created_by_user_id_fkey
    foreign key (created_by_user_id) references public.app_users(id) on delete set null
    not valid;

  alter table public.tasks drop constraint if exists tasks_reported_by_user_id_fkey;
  alter table public.tasks
    add constraint tasks_reported_by_user_id_fkey
    foreign key (reported_by_user_id) references public.app_users(id) on delete set null
    not valid;
end $$;

create index if not exists tasks_assigned_user_id_idx
  on public.tasks (assigned_user_id);

create index if not exists tasks_created_by_user_id_idx
  on public.tasks (created_by_user_id);

create table if not exists public.task_reports (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  created_by_user_id uuid references public.app_users(id) on delete set null,
  report_type text not null,
  notes text,
  status_at_submission text,
  created_at timestamp with time zone not null default now()
);

create index if not exists task_reports_task_id_idx
  on public.task_reports (task_id);

create table if not exists public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  task_report_id uuid references public.task_reports(id) on delete cascade,
  uploaded_by_user_id uuid references public.app_users(id) on delete set null,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  file_size_bytes bigint,
  created_at timestamp with time zone not null default now()
);

create index if not exists task_attachments_task_id_idx
  on public.task_attachments (task_id);

create index if not exists task_attachments_task_report_id_idx
  on public.task_attachments (task_report_id);

alter table public.subscriptions
  add column if not exists client_name_snapshot text,
  add column if not exists property_code_snapshot text,
  add column if not exists package_name_snapshot text;

do $$
begin
  alter type public.invoice_status add value if not exists 'issued';
exception
  when duplicate_object then null;
end $$;

alter table public.invoices
  add column if not exists document_type text not null default 'invoice',
  add column if not exists original_invoice_id uuid,
  add column if not exists client_id uuid,
  add column if not exists subscription_id uuid;

alter table public.invoices
  alter column invoice_number drop not null,
  alter column property_id drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'invoices_document_type_check'
  ) then
    alter table public.invoices
      add constraint invoices_document_type_check
      check (document_type in ('invoice', 'credit_note'));
  end if;

  alter table public.invoices drop constraint if exists invoices_original_invoice_id_fkey;
  alter table public.invoices
    add constraint invoices_original_invoice_id_fkey
    foreign key (original_invoice_id) references public.invoices(id) on delete restrict
    not valid;

  alter table public.invoices drop constraint if exists invoices_client_id_fkey;
  alter table public.invoices
    add constraint invoices_client_id_fkey
    foreign key (client_id) references public.clients(id) on delete restrict
    not valid;

  alter table public.invoices drop constraint if exists invoices_subscription_id_fkey;
  alter table public.invoices
    add constraint invoices_subscription_id_fkey
    foreign key (subscription_id) references public.subscriptions(id) on delete set null
    not valid;
end $$;

create index if not exists invoices_document_type_idx
  on public.invoices (document_type);

create index if not exists invoices_original_invoice_id_idx
  on public.invoices (original_invoice_id);

alter table public.company_bank_accounts
  add column if not exists bank_name_snapshot text;

do $$
begin
  alter table public.keys drop constraint if exists keys_holder_user_fk;
  alter table public.keys drop constraint if exists keys_holder_user_id_fkey;
  alter table public.keys drop constraint if exists keys_holder_app_user_id_fkey;
  alter table public.keys
    add constraint keys_holder_app_user_id_fkey
    foreign key (holder_user_id) references public.app_users(id) on delete set null
    not valid;

  alter table public.key_logs drop constraint if exists key_logs_performed_by_user_fk;
  alter table public.key_logs drop constraint if exists key_logs_performed_by_user_id_fkey;
  alter table public.key_logs drop constraint if exists key_logs_performed_by_app_user_id_fkey;
  alter table public.key_logs
    add constraint key_logs_performed_by_app_user_id_fkey
    foreign key (performed_by_user_id) references public.app_users(id) on delete set null
    not valid;
end $$;

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  amount_cents integer not null,
  description text not null,
  expense_category_id uuid not null references public.expense_categories(id) on delete restrict,
  worker_id uuid references public.workers(id) on delete set null,
  vendor_id uuid references public.vendors(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  notes text,
  created_by_user_id uuid references public.app_users(id) on delete set null,
  created_by_user_name_snapshot text,
  worker_name_snapshot text,
  worker_role_title_snapshot text,
  vendor_name_snapshot text,
  category_name_snapshot text,
  property_code_snapshot text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone
);

create index if not exists expenses_expense_date_idx
  on public.expenses (expense_date);

create index if not exists expenses_expense_category_id_idx
  on public.expenses (expense_category_id);

create index if not exists expenses_vendor_id_idx
  on public.expenses (vendor_id);

create index if not exists expenses_worker_id_idx
  on public.expenses (worker_id);

create index if not exists expenses_property_id_idx
  on public.expenses (property_id);

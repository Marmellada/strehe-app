drop extension if exists "pg_net";

create type "public"."invoice_status" as enum ('draft', 'sent', 'paid', 'overdue', 'cancelled');

create type "public"."invoice_type" as enum ('standard', 'recurring');

create type "public"."payment_method" as enum ('bank_transfer', 'cash');

create sequence "public"."invoice_number_seq";

create sequence "public"."key_code_seq";

create sequence "public"."property_code_seq";

drop policy "Users can delete own properties" on "public"."properties";

drop policy "Users can insert own properties" on "public"."properties";

drop policy "Users can update own properties" on "public"."properties";

drop policy "Users can view own properties" on "public"."properties";

drop policy "Users can delete own tenants" on "public"."tenants";

drop policy "Users can insert own tenants" on "public"."tenants";

drop policy "Users can update own tenants" on "public"."tenants";

drop policy "Users can view own tenants" on "public"."tenants";

revoke delete on table "public"."leases" from "anon";

revoke insert on table "public"."leases" from "anon";

revoke references on table "public"."leases" from "anon";

revoke select on table "public"."leases" from "anon";

revoke trigger on table "public"."leases" from "anon";

revoke truncate on table "public"."leases" from "anon";

revoke update on table "public"."leases" from "anon";

revoke delete on table "public"."leases" from "authenticated";

revoke insert on table "public"."leases" from "authenticated";

revoke references on table "public"."leases" from "authenticated";

revoke select on table "public"."leases" from "authenticated";

revoke trigger on table "public"."leases" from "authenticated";

revoke truncate on table "public"."leases" from "authenticated";

revoke update on table "public"."leases" from "authenticated";

revoke delete on table "public"."leases" from "service_role";

revoke insert on table "public"."leases" from "service_role";

revoke references on table "public"."leases" from "service_role";

revoke select on table "public"."leases" from "service_role";

revoke trigger on table "public"."leases" from "service_role";

revoke truncate on table "public"."leases" from "service_role";

revoke update on table "public"."leases" from "service_role";

revoke delete on table "public"."tenants" from "anon";

revoke insert on table "public"."tenants" from "anon";

revoke references on table "public"."tenants" from "anon";

revoke select on table "public"."tenants" from "anon";

revoke trigger on table "public"."tenants" from "anon";

revoke truncate on table "public"."tenants" from "anon";

revoke update on table "public"."tenants" from "anon";

revoke delete on table "public"."tenants" from "authenticated";

revoke insert on table "public"."tenants" from "authenticated";

revoke references on table "public"."tenants" from "authenticated";

revoke select on table "public"."tenants" from "authenticated";

revoke trigger on table "public"."tenants" from "authenticated";

revoke truncate on table "public"."tenants" from "authenticated";

revoke update on table "public"."tenants" from "authenticated";

revoke delete on table "public"."tenants" from "service_role";

revoke insert on table "public"."tenants" from "service_role";

revoke references on table "public"."tenants" from "service_role";

revoke select on table "public"."tenants" from "service_role";

revoke trigger on table "public"."tenants" from "service_role";

revoke truncate on table "public"."tenants" from "service_role";

revoke update on table "public"."tenants" from "service_role";

revoke delete on table "public"."units" from "anon";

revoke insert on table "public"."units" from "anon";

revoke references on table "public"."units" from "anon";

revoke select on table "public"."units" from "anon";

revoke trigger on table "public"."units" from "anon";

revoke truncate on table "public"."units" from "anon";

revoke update on table "public"."units" from "anon";

revoke delete on table "public"."units" from "authenticated";

revoke insert on table "public"."units" from "authenticated";

revoke references on table "public"."units" from "authenticated";

revoke select on table "public"."units" from "authenticated";

revoke trigger on table "public"."units" from "authenticated";

revoke truncate on table "public"."units" from "authenticated";

revoke update on table "public"."units" from "authenticated";

revoke delete on table "public"."units" from "service_role";

revoke insert on table "public"."units" from "service_role";

revoke references on table "public"."units" from "service_role";

revoke select on table "public"."units" from "service_role";

revoke trigger on table "public"."units" from "service_role";

revoke truncate on table "public"."units" from "service_role";

revoke update on table "public"."units" from "service_role";

alter table "public"."banks" drop constraint "banks_user_id_fkey";

alter table "public"."invoices" drop constraint "invoices_lease_id_fkey";

alter table "public"."invoices" drop constraint "invoices_tenant_id_fkey";

alter table "public"."leases" drop constraint "leases_tenant_id_fkey";

alter table "public"."leases" drop constraint "leases_unit_id_fkey";

alter table "public"."payments" drop constraint "payments_lease_id_fkey";

alter table "public"."payments" drop constraint "payments_tenant_id_fkey";

alter table "public"."properties" drop constraint "properties_user_id_fkey";

alter table "public"."subscriptions" drop constraint "subscriptions_package_id_fkey";

alter table "public"."subscriptions" drop constraint "subscriptions_user_id_fkey";

alter table "public"."tasks" drop constraint "tasks_property_id_fkey";

alter table "public"."tasks" drop constraint "tasks_unit_id_fkey";

alter table "public"."tenants" drop constraint "tenants_user_id_fkey";

alter table "public"."units" drop constraint "units_property_id_fkey";

alter table "public"."units" drop constraint "units_property_id_unit_number_key";

alter table "public"."leases" drop constraint "leases_pkey";

alter table "public"."tenants" drop constraint "tenants_pkey";

alter table "public"."units" drop constraint "units_pkey";

drop index if exists "public"."idx_invoices_tenant_id";

drop index if exists "public"."idx_leases_tenant_id";

drop index if exists "public"."idx_leases_unit_id";

drop index if exists "public"."idx_payments_lease_id";

drop index if exists "public"."idx_properties_user_id";

drop index if exists "public"."idx_tenants_user_id";

drop index if exists "public"."idx_units_property_id";

drop index if exists "public"."leases_pkey";

drop index if exists "public"."tenants_pkey";

drop index if exists "public"."units_pkey";

drop index if exists "public"."units_property_id_unit_number_key";

drop table "public"."leases";

drop table "public"."tenants";

drop table "public"."units";


  create table "public"."clients" (
    "id" uuid not null default gen_random_uuid(),
    "client_type" character varying(20) not null,
    "full_name" character varying(150),
    "company_name" character varying(150),
    "contact_person" character varying(150),
    "phone" character varying(50),
    "email" character varying(150),
    "address_line_1" character varying(255),
    "address_line_2" character varying(255),
    "city" character varying(100),
    "country" character varying(100),
    "business_number" character varying(100),
    "tax_number" character varying(100),
    "notes" text,
    "status" character varying(20) not null default 'active'::character varying,
    "created_at" timestamp without time zone not null default now(),
    "updated_at" timestamp without time zone not null default now(),
    "municipality_id" uuid,
    "location_id" uuid
      );



  create table "public"."company_bank_accounts" (
    "id" uuid not null default gen_random_uuid(),
    "bank_id" uuid,
    "account_name" text not null,
    "iban" text not null,
    "is_primary" boolean default false,
    "is_active" boolean default true,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."company_bank_accounts" enable row level security;


  create table "public"."company_settings" (
    "id" uuid not null default gen_random_uuid(),
    "company_name" text not null default 'Strehe-Prona'::text,
    "email" text,
    "phone" text,
    "address" text,
    "city" text,
    "country" text default 'Kosovo'::text,
    "logo_url" text,
    "vat_enabled" boolean default false,
    "vat_number" text,
    "vat_rate" numeric(5,2) default 18.00,
    "currency" text default 'EUR'::text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );



  create table "public"."invoice_items" (
    "id" uuid not null default gen_random_uuid(),
    "invoice_id" uuid not null,
    "description" text not null,
    "quantity" numeric(10,2) not null default 1.00,
    "unit_price_cents" integer not null,
    "total_cents" integer not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."invoice_items" enable row level security;


  create table "public"."key_logs" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "key_id" uuid,
    "action" text not null,
    "user_name" text,
    "notes" text,
    "created_at" timestamp without time zone default now(),
    "from_status" text,
    "to_status" text,
    "performed_by_user_id" uuid
      );



  create table "public"."keys" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "property_id" uuid,
    "name" text not null,
    "description" text,
    "status" text default 'available'::text,
    "created_at" timestamp without time zone default now(),
    "key_code" text not null default ('STH-KEY-'::text || lpad((nextval('public.key_code_seq'::regclass))::text, 4, '0'::text)),
    "key_type" text,
    "storage_location" text,
    "holder_name" text,
    "last_checked_out_at" timestamp without time zone,
    "holder_user_id" uuid
      );



  create table "public"."locations" (
    "id" uuid not null default gen_random_uuid(),
    "municipality_id" uuid not null,
    "name" text not null,
    "type" text not null,
    "created_at" timestamp with time zone not null default now()
      );



  create table "public"."municipalities" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "country" text not null default 'Kosovo'::text,
    "created_at" timestamp with time zone not null default now()
      );



  create table "public"."package_services" (
    "id" uuid not null default gen_random_uuid(),
    "package_id" uuid not null,
    "service_id" uuid not null,
    "included_quantity" integer not null default 1,
    "created_at" timestamp with time zone default now()
      );



  create table "public"."permissions" (
    "id" uuid not null default gen_random_uuid(),
    "resource" text not null,
    "action" text not null,
    "description" text
      );



  create table "public"."role_permissions" (
    "role_id" uuid not null,
    "permission_id" uuid not null
      );



  create table "public"."roles" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "description" text,
    "is_system" boolean default false,
    "created_at" timestamp with time zone default now()
      );



  create table "public"."users" (
    "id" uuid not null default gen_random_uuid(),
    "auth_id" uuid,
    "full_name" text not null,
    "email" text not null,
    "phone" text,
    "role" text not null,
    "is_active" boolean not null default true,
    "password_changed_at" timestamp with time zone,
    "notes" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "role_id" uuid,
    "avatar_url" text
      );


alter table "public"."banks" drop column "account_number";

alter table "public"."banks" drop column "account_type";

alter table "public"."banks" drop column "bank_name";

alter table "public"."banks" drop column "is_primary";

alter table "public"."banks" drop column "routing_number";

alter table "public"."banks" drop column "updated_at";

alter table "public"."banks" drop column "user_id";

alter table "public"."banks" add column "country" text not null default 'Kosovo'::text;

alter table "public"."banks" add column "is_active" boolean default true;

alter table "public"."banks" add column "name" text not null;

alter table "public"."banks" add column "swift_code" text;

alter table "public"."banks" alter column "id" set default gen_random_uuid();

alter table "public"."invoices" drop column "amount";

alter table "public"."invoices" drop column "description";

alter table "public"."invoices" drop column "lease_id";

alter table "public"."invoices" drop column "tenant_id";

alter table "public"."invoices" add column "invoice_type" public.invoice_type not null default 'standard'::public.invoice_type;

alter table "public"."invoices" add column "issue_date" date not null default CURRENT_DATE;

alter table "public"."invoices" add column "notes" text;

alter table "public"."invoices" add column "property_id" uuid not null;

alter table "public"."invoices" add column "subtotal_cents" integer not null;

alter table "public"."invoices" add column "total_cents" integer not null;

alter table "public"."invoices" add column "user_id" uuid not null;

alter table "public"."invoices" add column "vat_amount_cents" integer not null;

alter table "public"."invoices" add column "vat_rate" numeric(5,2) not null default 0.00;

alter table "public"."invoices" alter column "created_at" set not null;

alter table "public"."invoices" alter column "id" set default gen_random_uuid();

alter table "public"."invoices" alter column "status" set default 'draft'::public.invoice_status;

alter table "public"."invoices" alter column "status" set not null;

alter table "public"."invoices" alter column "status" set data type public.invoice_status using "status"::public.invoice_status;

alter table "public"."invoices" alter column "updated_at" set not null;

alter table "public"."packages" drop column "billing_cycle";

alter table "public"."packages" drop column "features";

alter table "public"."packages" drop column "price";

alter table "public"."packages" add column "monthly_price" numeric(12,2);

alter table "public"."packages" alter column "id" set default gen_random_uuid();

alter table "public"."packages" alter column "is_active" set not null;

alter table "public"."packages" disable row level security;

alter table "public"."payments" drop column "amount";

alter table "public"."payments" drop column "lease_id";

alter table "public"."payments" drop column "status";

alter table "public"."payments" drop column "tenant_id";

alter table "public"."payments" drop column "updated_at";

alter table "public"."payments" add column "amount_cents" integer not null;

alter table "public"."payments" add column "bank_id" uuid;

alter table "public"."payments" add column "invoice_id" uuid not null;

alter table "public"."payments" alter column "created_at" set not null;

alter table "public"."payments" alter column "id" set default gen_random_uuid();

alter table "public"."payments" alter column "payment_date" set default CURRENT_DATE;

alter table "public"."payments" alter column "payment_method" set not null;

alter table "public"."payments" alter column "payment_method" set data type public.payment_method using "payment_method"::public.payment_method;

alter table "public"."properties" drop column "address";

alter table "public"."properties" drop column "description";

alter table "public"."properties" drop column "name";

alter table "public"."properties" drop column "total_units";

alter table "public"."properties" drop column "user_id";

alter table "public"."properties" add column "access_note" text;

alter table "public"."properties" add column "address_line_1" character varying(255) not null;

alter table "public"."properties" add column "address_line_2" character varying(255);

alter table "public"."properties" add column "city" character varying(100) not null;

alter table "public"."properties" add column "contract_end_date" date;

alter table "public"."properties" add column "contract_start_date" date;

alter table "public"."properties" add column "country" character varying(100);

alter table "public"."properties" add column "has_keys_in_office" boolean not null default false;

alter table "public"."properties" add column "key_access_note" text;

alter table "public"."properties" add column "location_id" uuid;

alter table "public"."properties" add column "location_text" text;

alter table "public"."properties" add column "monthly_fee" numeric(12,2);

alter table "public"."properties" add column "monthly_package_name" character varying(150);

alter table "public"."properties" add column "municipality_id" uuid;

alter table "public"."properties" add column "notes" text;

alter table "public"."properties" add column "owner_client_id" uuid not null;

alter table "public"."properties" add column "property_code" character varying(50) not null default ('PROP-'::text || lpad((nextval('public.property_code_seq'::regclass))::text, 4, '0'::text));

alter table "public"."properties" add column "property_contact_email" character varying(150);

alter table "public"."properties" add column "property_contact_name" character varying(150);

alter table "public"."properties" add column "property_contact_phone" character varying(50);

alter table "public"."properties" add column "title" character varying(150) not null;

alter table "public"."properties" alter column "created_at" set not null;

alter table "public"."properties" alter column "created_at" set data type timestamp without time zone using "created_at"::timestamp without time zone;

alter table "public"."properties" alter column "id" set default gen_random_uuid();

alter table "public"."properties" alter column "property_type" set not null;

alter table "public"."properties" alter column "property_type" set data type character varying(30) using "property_type"::character varying(30);

alter table "public"."properties" alter column "status" set default 'active'::character varying;

alter table "public"."properties" alter column "status" set not null;

alter table "public"."properties" alter column "status" set data type character varying(20) using "status"::character varying(20);

alter table "public"."properties" alter column "updated_at" set not null;

alter table "public"."properties" alter column "updated_at" set data type timestamp without time zone using "updated_at"::timestamp without time zone;

alter table "public"."services" drop column "price";

alter table "public"."services" add column "base_price" numeric(12,2);

alter table "public"."services" add column "default_description" text;

alter table "public"."services" add column "default_priority" text not null default 'medium'::text;

alter table "public"."services" add column "default_title" text;

alter table "public"."services" alter column "category" set not null;

alter table "public"."services" alter column "id" set default gen_random_uuid();

alter table "public"."services" alter column "is_active" set not null;

alter table "public"."services" disable row level security;

alter table "public"."subscriptions" drop column "auto_renew";

alter table "public"."subscriptions" drop column "user_id";

alter table "public"."subscriptions" add column "client_id" uuid not null;

alter table "public"."subscriptions" add column "monthly_price" numeric(12,2);

alter table "public"."subscriptions" add column "notes" text;

alter table "public"."subscriptions" add column "property_id" uuid not null;

alter table "public"."subscriptions" alter column "id" set default gen_random_uuid();

alter table "public"."subscriptions" alter column "package_id" set not null;

alter table "public"."subscriptions" alter column "status" set not null;

alter table "public"."subscriptions" disable row level security;

alter table "public"."tasks" drop column "assigned_to";

alter table "public"."tasks" drop column "unit_id";

alter table "public"."tasks" add column "assigned_to_client_id" uuid;

alter table "public"."tasks" add column "assigned_to_user_id" uuid;

alter table "public"."tasks" add column "reported_by_client_id" uuid;

alter table "public"."tasks" add column "reported_by_user_id" uuid;

alter table "public"."tasks" add column "service_id" uuid;

alter table "public"."tasks" add column "subscription_id" uuid;

alter table "public"."tasks" alter column "completed_at" set data type timestamp without time zone using "completed_at"::timestamp without time zone;

alter table "public"."tasks" alter column "id" set default gen_random_uuid();

alter table "public"."tasks" alter column "priority" set not null;

alter table "public"."tasks" alter column "property_id" set not null;

alter table "public"."tasks" alter column "status" set default 'open'::text;

alter table "public"."tasks" alter column "status" set not null;

alter table "public"."tasks" disable row level security;

CREATE UNIQUE INDEX clients_pkey ON public.clients USING btree (id);

CREATE UNIQUE INDEX company_bank_accounts_iban_key ON public.company_bank_accounts USING btree (iban);

CREATE UNIQUE INDEX company_bank_accounts_pkey ON public.company_bank_accounts USING btree (id);

CREATE UNIQUE INDEX company_settings_pkey ON public.company_settings USING btree (id);

CREATE INDEX idx_company_bank_accounts_bank_id ON public.company_bank_accounts USING btree (bank_id);

CREATE INDEX idx_company_bank_accounts_primary ON public.company_bank_accounts USING btree (is_primary) WHERE (is_active = true);

CREATE INDEX idx_invoice_items_invoice_id ON public.invoice_items USING btree (invoice_id);

CREATE INDEX idx_invoices_due_date ON public.invoices USING btree (due_date);

CREATE INDEX idx_invoices_issue_date ON public.invoices USING btree (issue_date);

CREATE INDEX idx_invoices_property_id ON public.invoices USING btree (property_id);

CREATE INDEX idx_invoices_status ON public.invoices USING btree (status);

CREATE INDEX idx_invoices_user_id ON public.invoices USING btree (user_id);

CREATE INDEX idx_package_services_package_id ON public.package_services USING btree (package_id);

CREATE INDEX idx_package_services_service_id ON public.package_services USING btree (service_id);

CREATE INDEX idx_packages_is_active ON public.packages USING btree (is_active);

CREATE INDEX idx_payments_bank_id ON public.payments USING btree (bank_id);

CREATE INDEX idx_payments_invoice_id ON public.payments USING btree (invoice_id);

CREATE INDEX idx_payments_payment_date ON public.payments USING btree (payment_date);

CREATE INDEX idx_services_category ON public.services USING btree (category);

CREATE INDEX idx_services_is_active ON public.services USING btree (is_active);

CREATE INDEX idx_subscriptions_client_id ON public.subscriptions USING btree (client_id);

CREATE INDEX idx_subscriptions_package_id ON public.subscriptions USING btree (package_id);

CREATE INDEX idx_subscriptions_property_id ON public.subscriptions USING btree (property_id);

CREATE INDEX idx_subscriptions_status ON public.subscriptions USING btree (status);

CREATE INDEX idx_tasks_assigned_to ON public.tasks USING btree (assigned_to_client_id);

CREATE INDEX idx_tasks_service_id ON public.tasks USING btree (service_id);

CREATE INDEX idx_tasks_status ON public.tasks USING btree (status);

CREATE INDEX idx_tasks_subscription_id ON public.tasks USING btree (subscription_id);

CREATE INDEX idx_users_auth_id ON public.users USING btree (auth_id);

CREATE INDEX idx_users_is_active ON public.users USING btree (is_active);

CREATE INDEX idx_users_role ON public.users USING btree (role);

CREATE UNIQUE INDEX invoice_items_pkey ON public.invoice_items USING btree (id);

CREATE UNIQUE INDEX key_logs_pkey ON public.key_logs USING btree (id);

CREATE UNIQUE INDEX keys_key_code_key ON public.keys USING btree (key_code);

CREATE UNIQUE INDEX keys_key_code_unique ON public.keys USING btree (key_code);

CREATE UNIQUE INDEX keys_pkey ON public.keys USING btree (id);

CREATE UNIQUE INDEX locations_municipality_id_name_key ON public.locations USING btree (municipality_id, name);

CREATE UNIQUE INDEX locations_pkey ON public.locations USING btree (id);

CREATE UNIQUE INDEX municipalities_name_key ON public.municipalities USING btree (name);

CREATE UNIQUE INDEX municipalities_pkey ON public.municipalities USING btree (id);

CREATE UNIQUE INDEX package_services_pkey ON public.package_services USING btree (id);

CREATE UNIQUE INDEX permissions_pkey ON public.permissions USING btree (id);

CREATE UNIQUE INDEX permissions_resource_action_key ON public.permissions USING btree (resource, action);

CREATE UNIQUE INDEX properties_property_code_key ON public.properties USING btree (property_code);

CREATE UNIQUE INDEX role_permissions_pkey ON public.role_permissions USING btree (role_id, permission_id);

CREATE UNIQUE INDEX roles_name_key ON public.roles USING btree (name);

CREATE UNIQUE INDEX roles_pkey ON public.roles USING btree (id);

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);

CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id);

alter table "public"."clients" add constraint "clients_pkey" PRIMARY KEY using index "clients_pkey";

alter table "public"."company_bank_accounts" add constraint "company_bank_accounts_pkey" PRIMARY KEY using index "company_bank_accounts_pkey";

alter table "public"."company_settings" add constraint "company_settings_pkey" PRIMARY KEY using index "company_settings_pkey";

alter table "public"."invoice_items" add constraint "invoice_items_pkey" PRIMARY KEY using index "invoice_items_pkey";

alter table "public"."key_logs" add constraint "key_logs_pkey" PRIMARY KEY using index "key_logs_pkey";

alter table "public"."keys" add constraint "keys_pkey" PRIMARY KEY using index "keys_pkey";

alter table "public"."locations" add constraint "locations_pkey" PRIMARY KEY using index "locations_pkey";

alter table "public"."municipalities" add constraint "municipalities_pkey" PRIMARY KEY using index "municipalities_pkey";

alter table "public"."package_services" add constraint "package_services_pkey" PRIMARY KEY using index "package_services_pkey";

alter table "public"."permissions" add constraint "permissions_pkey" PRIMARY KEY using index "permissions_pkey";

alter table "public"."role_permissions" add constraint "role_permissions_pkey" PRIMARY KEY using index "role_permissions_pkey";

alter table "public"."roles" add constraint "roles_pkey" PRIMARY KEY using index "roles_pkey";

alter table "public"."users" add constraint "users_pkey" PRIMARY KEY using index "users_pkey";

alter table "public"."clients" add constraint "clients_location_id_fkey" FOREIGN KEY (location_id) REFERENCES public.locations(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."clients" validate constraint "clients_location_id_fkey";

alter table "public"."clients" add constraint "clients_municipality_id_fkey" FOREIGN KEY (municipality_id) REFERENCES public.municipalities(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."clients" validate constraint "clients_municipality_id_fkey";

alter table "public"."clients" add constraint "clients_name_required_chk" CHECK (((((client_type)::text = 'individual'::text) AND (full_name IS NOT NULL) AND (btrim((full_name)::text) <> ''::text)) OR (((client_type)::text = 'business'::text) AND (company_name IS NOT NULL) AND (btrim((company_name)::text) <> ''::text)))) not valid;

alter table "public"."clients" validate constraint "clients_name_required_chk";

alter table "public"."clients" add constraint "clients_status_chk" CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[]))) not valid;

alter table "public"."clients" validate constraint "clients_status_chk";

alter table "public"."clients" add constraint "clients_type_chk" CHECK (((client_type)::text = ANY ((ARRAY['individual'::character varying, 'business'::character varying])::text[]))) not valid;

alter table "public"."clients" validate constraint "clients_type_chk";

alter table "public"."company_bank_accounts" add constraint "company_bank_accounts_bank_id_fkey" FOREIGN KEY (bank_id) REFERENCES public.banks(id) ON DELETE SET NULL not valid;

alter table "public"."company_bank_accounts" validate constraint "company_bank_accounts_bank_id_fkey";

alter table "public"."company_bank_accounts" add constraint "company_bank_accounts_iban_key" UNIQUE using index "company_bank_accounts_iban_key";

alter table "public"."invoice_items" add constraint "invoice_items_invoice_id_fkey" FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE not valid;

alter table "public"."invoice_items" validate constraint "invoice_items_invoice_id_fkey";

alter table "public"."invoice_items" add constraint "invoice_items_quantity_check" CHECK ((quantity > (0)::numeric)) not valid;

alter table "public"."invoice_items" validate constraint "invoice_items_quantity_check";

alter table "public"."invoice_items" add constraint "invoice_items_total_cents_check" CHECK ((total_cents >= 0)) not valid;

alter table "public"."invoice_items" validate constraint "invoice_items_total_cents_check";

alter table "public"."invoice_items" add constraint "invoice_items_unit_price_cents_check" CHECK ((unit_price_cents >= 0)) not valid;

alter table "public"."invoice_items" validate constraint "invoice_items_unit_price_cents_check";

alter table "public"."invoices" add constraint "due_date_after_issue" CHECK ((due_date >= issue_date)) not valid;

alter table "public"."invoices" validate constraint "due_date_after_issue";

alter table "public"."invoices" add constraint "invoices_property_id_fkey" FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE RESTRICT not valid;

alter table "public"."invoices" validate constraint "invoices_property_id_fkey";

alter table "public"."invoices" add constraint "invoices_subtotal_cents_check" CHECK ((subtotal_cents >= 0)) not valid;

alter table "public"."invoices" validate constraint "invoices_subtotal_cents_check";

alter table "public"."invoices" add constraint "invoices_total_cents_check" CHECK ((total_cents >= 0)) not valid;

alter table "public"."invoices" validate constraint "invoices_total_cents_check";

alter table "public"."invoices" add constraint "invoices_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT not valid;

alter table "public"."invoices" validate constraint "invoices_user_id_fkey";

alter table "public"."invoices" add constraint "invoices_vat_amount_cents_check" CHECK ((vat_amount_cents >= 0)) not valid;

alter table "public"."invoices" validate constraint "invoices_vat_amount_cents_check";

alter table "public"."invoices" add constraint "invoices_vat_rate_check" CHECK ((vat_rate = ANY (ARRAY[0.00, 18.00]))) not valid;

alter table "public"."invoices" validate constraint "invoices_vat_rate_check";

alter table "public"."key_logs" add constraint "key_logs_action_check" CHECK ((action = ANY (ARRAY['created'::text, 'assigned'::text, 'returned'::text, 'lost'::text, 'damaged'::text, 'retired'::text]))) not valid;

alter table "public"."key_logs" validate constraint "key_logs_action_check";

alter table "public"."key_logs" add constraint "key_logs_key_id_fkey" FOREIGN KEY (key_id) REFERENCES public.keys(id) ON DELETE CASCADE not valid;

alter table "public"."key_logs" validate constraint "key_logs_key_id_fkey";

alter table "public"."key_logs" add constraint "key_logs_performed_by_user_fk" FOREIGN KEY (performed_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL not valid;

alter table "public"."key_logs" validate constraint "key_logs_performed_by_user_fk";

alter table "public"."key_logs" add constraint "key_logs_performed_by_user_id_fkey" FOREIGN KEY (performed_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL not valid;

alter table "public"."key_logs" validate constraint "key_logs_performed_by_user_id_fkey";

alter table "public"."keys" add constraint "keys_holder_user_fk" FOREIGN KEY (holder_user_id) REFERENCES public.users(id) ON DELETE SET NULL not valid;

alter table "public"."keys" validate constraint "keys_holder_user_fk";

alter table "public"."keys" add constraint "keys_holder_user_id_fkey" FOREIGN KEY (holder_user_id) REFERENCES public.users(id) ON DELETE SET NULL not valid;

alter table "public"."keys" validate constraint "keys_holder_user_id_fkey";

alter table "public"."keys" add constraint "keys_key_code_key" UNIQUE using index "keys_key_code_key";

alter table "public"."keys" add constraint "keys_key_code_unique" UNIQUE using index "keys_key_code_unique";

alter table "public"."keys" add constraint "keys_property_id_fkey" FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE not valid;

alter table "public"."keys" validate constraint "keys_property_id_fkey";

alter table "public"."keys" add constraint "keys_status_check" CHECK ((status = ANY (ARRAY['available'::text, 'assigned'::text, 'lost'::text, 'damaged'::text, 'retired'::text]))) not valid;

alter table "public"."keys" validate constraint "keys_status_check";

alter table "public"."locations" add constraint "locations_municipality_id_fkey" FOREIGN KEY (municipality_id) REFERENCES public.municipalities(id) ON DELETE CASCADE not valid;

alter table "public"."locations" validate constraint "locations_municipality_id_fkey";

alter table "public"."locations" add constraint "locations_municipality_id_name_key" UNIQUE using index "locations_municipality_id_name_key";

alter table "public"."locations" add constraint "locations_type_check" CHECK ((type = ANY (ARRAY['neighborhood'::text, 'village'::text, 'other'::text]))) not valid;

alter table "public"."locations" validate constraint "locations_type_check";

alter table "public"."municipalities" add constraint "municipalities_name_key" UNIQUE using index "municipalities_name_key";

alter table "public"."package_services" add constraint "package_services_package_fk" FOREIGN KEY (package_id) REFERENCES public.packages(id) ON DELETE CASCADE not valid;

alter table "public"."package_services" validate constraint "package_services_package_fk";

alter table "public"."package_services" add constraint "package_services_quantity_check" CHECK ((included_quantity > 0)) not valid;

alter table "public"."package_services" validate constraint "package_services_quantity_check";

alter table "public"."package_services" add constraint "package_services_service_fk" FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE RESTRICT not valid;

alter table "public"."package_services" validate constraint "package_services_service_fk";

alter table "public"."payments" add constraint "bank_required_for_transfer" CHECK ((((payment_method = 'bank_transfer'::public.payment_method) AND (bank_id IS NOT NULL)) OR (payment_method <> 'bank_transfer'::public.payment_method))) not valid;

alter table "public"."payments" validate constraint "bank_required_for_transfer";

alter table "public"."payments" add constraint "payments_amount_cents_check" CHECK ((amount_cents > 0)) not valid;

alter table "public"."payments" validate constraint "payments_amount_cents_check";

alter table "public"."payments" add constraint "payments_bank_id_fkey" FOREIGN KEY (bank_id) REFERENCES public.banks(id) ON DELETE RESTRICT not valid;

alter table "public"."payments" validate constraint "payments_bank_id_fkey";

alter table "public"."payments" add constraint "payments_invoice_id_fkey" FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE RESTRICT not valid;

alter table "public"."payments" validate constraint "payments_invoice_id_fkey";

alter table "public"."permissions" add constraint "permissions_resource_action_key" UNIQUE using index "permissions_resource_action_key";

alter table "public"."properties" add constraint "properties_location_id_fkey" FOREIGN KEY (location_id) REFERENCES public.locations(id) not valid;

alter table "public"."properties" validate constraint "properties_location_id_fkey";

alter table "public"."properties" add constraint "properties_monthly_fee_chk" CHECK (((monthly_fee IS NULL) OR (monthly_fee >= (0)::numeric))) not valid;

alter table "public"."properties" validate constraint "properties_monthly_fee_chk";

alter table "public"."properties" add constraint "properties_municipality_id_fkey" FOREIGN KEY (municipality_id) REFERENCES public.municipalities(id) not valid;

alter table "public"."properties" validate constraint "properties_municipality_id_fkey";

alter table "public"."properties" add constraint "properties_owner_fk" FOREIGN KEY (owner_client_id) REFERENCES public.clients(id) not valid;

alter table "public"."properties" validate constraint "properties_owner_fk";

alter table "public"."properties" add constraint "properties_property_code_key" UNIQUE using index "properties_property_code_key";

alter table "public"."properties" add constraint "properties_status_chk" CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'vacant'::character varying, 'inactive'::character varying])::text[]))) not valid;

alter table "public"."properties" validate constraint "properties_status_chk";

alter table "public"."properties" add constraint "properties_type_chk" CHECK (((property_type)::text = ANY ((ARRAY['apartment'::character varying, 'house'::character varying, 'office'::character varying, 'shop'::character varying, 'other'::character varying])::text[]))) not valid;

alter table "public"."properties" validate constraint "properties_type_chk";

alter table "public"."role_permissions" add constraint "role_permissions_permission_id_fkey" FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE not valid;

alter table "public"."role_permissions" validate constraint "role_permissions_permission_id_fkey";

alter table "public"."role_permissions" add constraint "role_permissions_role_id_fkey" FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE not valid;

alter table "public"."role_permissions" validate constraint "role_permissions_role_id_fkey";

alter table "public"."roles" add constraint "roles_name_key" UNIQUE using index "roles_name_key";

alter table "public"."subscriptions" add constraint "subscriptions_client_fk" FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT not valid;

alter table "public"."subscriptions" validate constraint "subscriptions_client_fk";

alter table "public"."subscriptions" add constraint "subscriptions_package_fk" FOREIGN KEY (package_id) REFERENCES public.packages(id) ON DELETE RESTRICT not valid;

alter table "public"."subscriptions" validate constraint "subscriptions_package_fk";

alter table "public"."subscriptions" add constraint "subscriptions_property_fk" FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE RESTRICT not valid;

alter table "public"."subscriptions" validate constraint "subscriptions_property_fk";

alter table "public"."tasks" add constraint "tasks_assigned_to_fk" FOREIGN KEY (assigned_to_client_id) REFERENCES public.clients(id) ON DELETE SET NULL not valid;

alter table "public"."tasks" validate constraint "tasks_assigned_to_fk";

alter table "public"."tasks" add constraint "tasks_assigned_to_user_id_fkey" FOREIGN KEY (assigned_to_user_id) REFERENCES public.users(id) not valid;

alter table "public"."tasks" validate constraint "tasks_assigned_to_user_id_fkey";

alter table "public"."tasks" add constraint "tasks_property_fk" FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE not valid;

alter table "public"."tasks" validate constraint "tasks_property_fk";

alter table "public"."tasks" add constraint "tasks_reported_by_fk" FOREIGN KEY (reported_by_client_id) REFERENCES public.clients(id) ON DELETE SET NULL not valid;

alter table "public"."tasks" validate constraint "tasks_reported_by_fk";

alter table "public"."tasks" add constraint "tasks_reported_by_user_id_fkey" FOREIGN KEY (reported_by_user_id) REFERENCES public.users(id) not valid;

alter table "public"."tasks" validate constraint "tasks_reported_by_user_id_fkey";

alter table "public"."tasks" add constraint "tasks_service_fk" FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL not valid;

alter table "public"."tasks" validate constraint "tasks_service_fk";

alter table "public"."tasks" add constraint "tasks_subscription_fk" FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) ON DELETE SET NULL not valid;

alter table "public"."tasks" validate constraint "tasks_subscription_fk";

alter table "public"."users" add constraint "users_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."users" validate constraint "users_auth_id_fkey";

alter table "public"."users" add constraint "users_email_key" UNIQUE using index "users_email_key";

alter table "public"."users" add constraint "users_role_check" CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text, 'staff'::text, 'operator'::text, 'contractor'::text, 'finance'::text, 'operations'::text]))) not valid;

alter table "public"."users" validate constraint "users_role_check";

alter table "public"."users" add constraint "users_role_id_fkey" FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE SET NULL not valid;

alter table "public"."users" validate constraint "users_role_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Only generate if invoice_number is NULL or empty
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := 'INV-' || 
                         TO_CHAR(CURRENT_DATE, 'YYYY') || '-' ||
                         LPAD(nextval('invoice_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_packages_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_services_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_subscriptions_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_tasks_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

grant delete on table "public"."clients" to "anon";

grant insert on table "public"."clients" to "anon";

grant references on table "public"."clients" to "anon";

grant select on table "public"."clients" to "anon";

grant trigger on table "public"."clients" to "anon";

grant truncate on table "public"."clients" to "anon";

grant update on table "public"."clients" to "anon";

grant delete on table "public"."clients" to "authenticated";

grant insert on table "public"."clients" to "authenticated";

grant references on table "public"."clients" to "authenticated";

grant select on table "public"."clients" to "authenticated";

grant trigger on table "public"."clients" to "authenticated";

grant truncate on table "public"."clients" to "authenticated";

grant update on table "public"."clients" to "authenticated";

grant delete on table "public"."clients" to "service_role";

grant insert on table "public"."clients" to "service_role";

grant references on table "public"."clients" to "service_role";

grant select on table "public"."clients" to "service_role";

grant trigger on table "public"."clients" to "service_role";

grant truncate on table "public"."clients" to "service_role";

grant update on table "public"."clients" to "service_role";

grant delete on table "public"."company_bank_accounts" to "anon";

grant insert on table "public"."company_bank_accounts" to "anon";

grant references on table "public"."company_bank_accounts" to "anon";

grant select on table "public"."company_bank_accounts" to "anon";

grant trigger on table "public"."company_bank_accounts" to "anon";

grant truncate on table "public"."company_bank_accounts" to "anon";

grant update on table "public"."company_bank_accounts" to "anon";

grant delete on table "public"."company_bank_accounts" to "authenticated";

grant insert on table "public"."company_bank_accounts" to "authenticated";

grant references on table "public"."company_bank_accounts" to "authenticated";

grant select on table "public"."company_bank_accounts" to "authenticated";

grant trigger on table "public"."company_bank_accounts" to "authenticated";

grant truncate on table "public"."company_bank_accounts" to "authenticated";

grant update on table "public"."company_bank_accounts" to "authenticated";

grant delete on table "public"."company_bank_accounts" to "service_role";

grant insert on table "public"."company_bank_accounts" to "service_role";

grant references on table "public"."company_bank_accounts" to "service_role";

grant select on table "public"."company_bank_accounts" to "service_role";

grant trigger on table "public"."company_bank_accounts" to "service_role";

grant truncate on table "public"."company_bank_accounts" to "service_role";

grant update on table "public"."company_bank_accounts" to "service_role";

grant delete on table "public"."company_settings" to "anon";

grant insert on table "public"."company_settings" to "anon";

grant references on table "public"."company_settings" to "anon";

grant select on table "public"."company_settings" to "anon";

grant trigger on table "public"."company_settings" to "anon";

grant truncate on table "public"."company_settings" to "anon";

grant update on table "public"."company_settings" to "anon";

grant delete on table "public"."company_settings" to "authenticated";

grant insert on table "public"."company_settings" to "authenticated";

grant references on table "public"."company_settings" to "authenticated";

grant select on table "public"."company_settings" to "authenticated";

grant trigger on table "public"."company_settings" to "authenticated";

grant truncate on table "public"."company_settings" to "authenticated";

grant update on table "public"."company_settings" to "authenticated";

grant delete on table "public"."company_settings" to "service_role";

grant insert on table "public"."company_settings" to "service_role";

grant references on table "public"."company_settings" to "service_role";

grant select on table "public"."company_settings" to "service_role";

grant trigger on table "public"."company_settings" to "service_role";

grant truncate on table "public"."company_settings" to "service_role";

grant update on table "public"."company_settings" to "service_role";

grant delete on table "public"."invoice_items" to "anon";

grant insert on table "public"."invoice_items" to "anon";

grant references on table "public"."invoice_items" to "anon";

grant select on table "public"."invoice_items" to "anon";

grant trigger on table "public"."invoice_items" to "anon";

grant truncate on table "public"."invoice_items" to "anon";

grant update on table "public"."invoice_items" to "anon";

grant delete on table "public"."invoice_items" to "authenticated";

grant insert on table "public"."invoice_items" to "authenticated";

grant references on table "public"."invoice_items" to "authenticated";

grant select on table "public"."invoice_items" to "authenticated";

grant trigger on table "public"."invoice_items" to "authenticated";

grant truncate on table "public"."invoice_items" to "authenticated";

grant update on table "public"."invoice_items" to "authenticated";

grant delete on table "public"."invoice_items" to "service_role";

grant insert on table "public"."invoice_items" to "service_role";

grant references on table "public"."invoice_items" to "service_role";

grant select on table "public"."invoice_items" to "service_role";

grant trigger on table "public"."invoice_items" to "service_role";

grant truncate on table "public"."invoice_items" to "service_role";

grant update on table "public"."invoice_items" to "service_role";

grant delete on table "public"."key_logs" to "anon";

grant insert on table "public"."key_logs" to "anon";

grant references on table "public"."key_logs" to "anon";

grant select on table "public"."key_logs" to "anon";

grant trigger on table "public"."key_logs" to "anon";

grant truncate on table "public"."key_logs" to "anon";

grant update on table "public"."key_logs" to "anon";

grant delete on table "public"."key_logs" to "authenticated";

grant insert on table "public"."key_logs" to "authenticated";

grant references on table "public"."key_logs" to "authenticated";

grant select on table "public"."key_logs" to "authenticated";

grant trigger on table "public"."key_logs" to "authenticated";

grant truncate on table "public"."key_logs" to "authenticated";

grant update on table "public"."key_logs" to "authenticated";

grant delete on table "public"."key_logs" to "service_role";

grant insert on table "public"."key_logs" to "service_role";

grant references on table "public"."key_logs" to "service_role";

grant select on table "public"."key_logs" to "service_role";

grant trigger on table "public"."key_logs" to "service_role";

grant truncate on table "public"."key_logs" to "service_role";

grant update on table "public"."key_logs" to "service_role";

grant delete on table "public"."keys" to "anon";

grant insert on table "public"."keys" to "anon";

grant references on table "public"."keys" to "anon";

grant select on table "public"."keys" to "anon";

grant trigger on table "public"."keys" to "anon";

grant truncate on table "public"."keys" to "anon";

grant update on table "public"."keys" to "anon";

grant delete on table "public"."keys" to "authenticated";

grant insert on table "public"."keys" to "authenticated";

grant references on table "public"."keys" to "authenticated";

grant select on table "public"."keys" to "authenticated";

grant trigger on table "public"."keys" to "authenticated";

grant truncate on table "public"."keys" to "authenticated";

grant update on table "public"."keys" to "authenticated";

grant delete on table "public"."keys" to "service_role";

grant insert on table "public"."keys" to "service_role";

grant references on table "public"."keys" to "service_role";

grant select on table "public"."keys" to "service_role";

grant trigger on table "public"."keys" to "service_role";

grant truncate on table "public"."keys" to "service_role";

grant update on table "public"."keys" to "service_role";

grant delete on table "public"."locations" to "anon";

grant insert on table "public"."locations" to "anon";

grant references on table "public"."locations" to "anon";

grant select on table "public"."locations" to "anon";

grant trigger on table "public"."locations" to "anon";

grant truncate on table "public"."locations" to "anon";

grant update on table "public"."locations" to "anon";

grant delete on table "public"."locations" to "authenticated";

grant insert on table "public"."locations" to "authenticated";

grant references on table "public"."locations" to "authenticated";

grant select on table "public"."locations" to "authenticated";

grant trigger on table "public"."locations" to "authenticated";

grant truncate on table "public"."locations" to "authenticated";

grant update on table "public"."locations" to "authenticated";

grant delete on table "public"."locations" to "service_role";

grant insert on table "public"."locations" to "service_role";

grant references on table "public"."locations" to "service_role";

grant select on table "public"."locations" to "service_role";

grant trigger on table "public"."locations" to "service_role";

grant truncate on table "public"."locations" to "service_role";

grant update on table "public"."locations" to "service_role";

grant delete on table "public"."municipalities" to "anon";

grant insert on table "public"."municipalities" to "anon";

grant references on table "public"."municipalities" to "anon";

grant select on table "public"."municipalities" to "anon";

grant trigger on table "public"."municipalities" to "anon";

grant truncate on table "public"."municipalities" to "anon";

grant update on table "public"."municipalities" to "anon";

grant delete on table "public"."municipalities" to "authenticated";

grant insert on table "public"."municipalities" to "authenticated";

grant references on table "public"."municipalities" to "authenticated";

grant select on table "public"."municipalities" to "authenticated";

grant trigger on table "public"."municipalities" to "authenticated";

grant truncate on table "public"."municipalities" to "authenticated";

grant update on table "public"."municipalities" to "authenticated";

grant delete on table "public"."municipalities" to "service_role";

grant insert on table "public"."municipalities" to "service_role";

grant references on table "public"."municipalities" to "service_role";

grant select on table "public"."municipalities" to "service_role";

grant trigger on table "public"."municipalities" to "service_role";

grant truncate on table "public"."municipalities" to "service_role";

grant update on table "public"."municipalities" to "service_role";

grant delete on table "public"."package_services" to "anon";

grant insert on table "public"."package_services" to "anon";

grant references on table "public"."package_services" to "anon";

grant select on table "public"."package_services" to "anon";

grant trigger on table "public"."package_services" to "anon";

grant truncate on table "public"."package_services" to "anon";

grant update on table "public"."package_services" to "anon";

grant delete on table "public"."package_services" to "authenticated";

grant insert on table "public"."package_services" to "authenticated";

grant references on table "public"."package_services" to "authenticated";

grant select on table "public"."package_services" to "authenticated";

grant trigger on table "public"."package_services" to "authenticated";

grant truncate on table "public"."package_services" to "authenticated";

grant update on table "public"."package_services" to "authenticated";

grant delete on table "public"."package_services" to "service_role";

grant insert on table "public"."package_services" to "service_role";

grant references on table "public"."package_services" to "service_role";

grant select on table "public"."package_services" to "service_role";

grant trigger on table "public"."package_services" to "service_role";

grant truncate on table "public"."package_services" to "service_role";

grant update on table "public"."package_services" to "service_role";

grant delete on table "public"."permissions" to "anon";

grant insert on table "public"."permissions" to "anon";

grant references on table "public"."permissions" to "anon";

grant select on table "public"."permissions" to "anon";

grant trigger on table "public"."permissions" to "anon";

grant truncate on table "public"."permissions" to "anon";

grant update on table "public"."permissions" to "anon";

grant delete on table "public"."permissions" to "authenticated";

grant insert on table "public"."permissions" to "authenticated";

grant references on table "public"."permissions" to "authenticated";

grant select on table "public"."permissions" to "authenticated";

grant trigger on table "public"."permissions" to "authenticated";

grant truncate on table "public"."permissions" to "authenticated";

grant update on table "public"."permissions" to "authenticated";

grant delete on table "public"."permissions" to "service_role";

grant insert on table "public"."permissions" to "service_role";

grant references on table "public"."permissions" to "service_role";

grant select on table "public"."permissions" to "service_role";

grant trigger on table "public"."permissions" to "service_role";

grant truncate on table "public"."permissions" to "service_role";

grant update on table "public"."permissions" to "service_role";

grant delete on table "public"."role_permissions" to "anon";

grant insert on table "public"."role_permissions" to "anon";

grant references on table "public"."role_permissions" to "anon";

grant select on table "public"."role_permissions" to "anon";

grant trigger on table "public"."role_permissions" to "anon";

grant truncate on table "public"."role_permissions" to "anon";

grant update on table "public"."role_permissions" to "anon";

grant delete on table "public"."role_permissions" to "authenticated";

grant insert on table "public"."role_permissions" to "authenticated";

grant references on table "public"."role_permissions" to "authenticated";

grant select on table "public"."role_permissions" to "authenticated";

grant trigger on table "public"."role_permissions" to "authenticated";

grant truncate on table "public"."role_permissions" to "authenticated";

grant update on table "public"."role_permissions" to "authenticated";

grant delete on table "public"."role_permissions" to "service_role";

grant insert on table "public"."role_permissions" to "service_role";

grant references on table "public"."role_permissions" to "service_role";

grant select on table "public"."role_permissions" to "service_role";

grant trigger on table "public"."role_permissions" to "service_role";

grant truncate on table "public"."role_permissions" to "service_role";

grant update on table "public"."role_permissions" to "service_role";

grant delete on table "public"."roles" to "anon";

grant insert on table "public"."roles" to "anon";

grant references on table "public"."roles" to "anon";

grant select on table "public"."roles" to "anon";

grant trigger on table "public"."roles" to "anon";

grant truncate on table "public"."roles" to "anon";

grant update on table "public"."roles" to "anon";

grant delete on table "public"."roles" to "authenticated";

grant insert on table "public"."roles" to "authenticated";

grant references on table "public"."roles" to "authenticated";

grant select on table "public"."roles" to "authenticated";

grant trigger on table "public"."roles" to "authenticated";

grant truncate on table "public"."roles" to "authenticated";

grant update on table "public"."roles" to "authenticated";

grant delete on table "public"."roles" to "service_role";

grant insert on table "public"."roles" to "service_role";

grant references on table "public"."roles" to "service_role";

grant select on table "public"."roles" to "service_role";

grant trigger on table "public"."roles" to "service_role";

grant truncate on table "public"."roles" to "service_role";

grant update on table "public"."roles" to "service_role";

grant delete on table "public"."users" to "anon";

grant insert on table "public"."users" to "anon";

grant references on table "public"."users" to "anon";

grant select on table "public"."users" to "anon";

grant trigger on table "public"."users" to "anon";

grant truncate on table "public"."users" to "anon";

grant update on table "public"."users" to "anon";

grant delete on table "public"."users" to "authenticated";

grant insert on table "public"."users" to "authenticated";

grant references on table "public"."users" to "authenticated";

grant select on table "public"."users" to "authenticated";

grant trigger on table "public"."users" to "authenticated";

grant truncate on table "public"."users" to "authenticated";

grant update on table "public"."users" to "authenticated";

grant delete on table "public"."users" to "service_role";

grant insert on table "public"."users" to "service_role";

grant references on table "public"."users" to "service_role";

grant select on table "public"."users" to "service_role";

grant trigger on table "public"."users" to "service_role";

grant truncate on table "public"."users" to "service_role";

grant update on table "public"."users" to "service_role";


  create policy "Banks are viewable by authenticated users"
  on "public"."banks"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Service role can manage banks"
  on "public"."banks"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "Service role can manage company bank accounts"
  on "public"."company_bank_accounts"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "Users can view company bank accounts"
  on "public"."company_bank_accounts"
  as permissive
  for select
  to authenticated
using ((is_active = true));



  create policy "Authenticated users can delete invoice items"
  on "public"."invoice_items"
  as permissive
  for delete
  to authenticated
using (true);



  create policy "Authenticated users can insert invoice items"
  on "public"."invoice_items"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "Authenticated users can read invoice items"
  on "public"."invoice_items"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Authenticated users can update invoice items"
  on "public"."invoice_items"
  as permissive
  for update
  to authenticated
using (true)
with check (true);



  create policy "Authenticated users can delete draft invoices only"
  on "public"."invoices"
  as permissive
  for delete
  to authenticated
using ((status = 'draft'::public.invoice_status));



  create policy "Authenticated users can insert invoices"
  on "public"."invoices"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "Authenticated users can read invoices"
  on "public"."invoices"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Authenticated users can update invoices"
  on "public"."invoices"
  as permissive
  for update
  to authenticated
using (true)
with check (true);



  create policy "Authenticated users can delete payments"
  on "public"."payments"
  as permissive
  for delete
  to authenticated
using (true);



  create policy "Authenticated users can insert payments"
  on "public"."payments"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "Authenticated users can read payments"
  on "public"."payments"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Authenticated users can update payments"
  on "public"."payments"
  as permissive
  for update
  to authenticated
using (true)
with check (true);



  create policy "Allow authenticated users to create properties"
  on "public"."properties"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "Allow authenticated users to delete properties"
  on "public"."properties"
  as permissive
  for delete
  to authenticated
using (true);



  create policy "Allow authenticated users to update properties"
  on "public"."properties"
  as permissive
  for update
  to authenticated
using (true)
with check (true);



  create policy "Allow authenticated users to view properties"
  on "public"."properties"
  as permissive
  for select
  to authenticated
using (true);


CREATE TRIGGER trg_generate_invoice_number BEFORE INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.generate_invoice_number();

CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trigger_update_packages_updated_at BEFORE UPDATE ON public.packages FOR EACH ROW EXECUTE FUNCTION public.update_packages_updated_at();

CREATE TRIGGER trigger_update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_services_updated_at();

CREATE TRIGGER trigger_update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_subscriptions_updated_at();

CREATE TRIGGER trigger_update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_tasks_updated_at();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();



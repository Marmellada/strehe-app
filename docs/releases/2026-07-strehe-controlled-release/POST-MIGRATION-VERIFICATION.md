# Post-Migration Verification

Run read-only checks before any application deployment. Preserve results with
UTC timestamps and redact connection details.

## Read-only checks

### Migration history

```sql
select version
from supabase_migrations.schema_migrations
where version >= '20260728120000'
order by version;
```

Require exactly `20260728120000`, `20260729000000`, and `20260729001000`.

### Funnel relations and sequence

```sql
select
  to_regclass('public.lead_consultations') as consultations,
  to_regclass('public.lead_offers') as offers,
  to_regclass('public.founding_customer_capacity') as capacity,
  to_regclass('public.lead_offer_number_seq') as offer_sequence;
```

All values must be non-null.

### Columns and constraints

```sql
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'promotion_campaigns', 'leads', 'lead_consultations',
    'lead_offers', 'founding_customer_capacity'
  )
order by table_name, ordinal_position;

select conrelid::regclass::text as table_name, conname,
       pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in (
  'public.leads'::regclass,
  'public.promotion_campaigns'::regclass,
  'public.lead_consultations'::regclass,
  'public.lead_offers'::regclass,
  'public.founding_customer_capacity'::regclass,
  'public.lead_events'::regclass
)
order by table_name, conname;
```

Compare with the pending migration; no extra or missing funnel constraint is
acceptable.

### Indexes

```sql
select schemaname, tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'leads', 'promotion_campaigns', 'lead_consultations', 'lead_offers'
  )
order by tablename, indexname;
```

Require all four lead milestone indexes, consultation lead/schedule index, offer
lead/version and status indexes, unique offer number, unique lead/version, and
partial one-active-founding-offer index.

### Functions and triggers

```sql
select p.oid::regprocedure::text as function_name,
       p.prosecdef as security_definer,
       p.provolatile,
       pg_get_functiondef(p.oid) as definition
from pg_proc p
where p.oid in (
  'public.protect_lead_first_touch()'::regprocedure,
  'public.enforce_founding_customer_capacity()'::regprocedure,
  'public.can_manage_sales_funnel()'::regprocedure
)
order by function_name;

select c.relname as table_name, t.tgname,
       pg_get_triggerdef(t.oid) as definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and t.tgname in (
    'protect_lead_first_touch_trigger',
    'enforce_founding_customer_capacity_trigger'
  )
order by t.tgname;
```

Require the capacity and funnel-access functions to be security definer with
fixed search paths. Require both triggers exactly once.

### Capacity state

```sql
select singleton, maximum_places, reserved_places
from public.founding_customer_capacity;
```

Require exactly one row: `true, 3, 0`. Any other value is STOP.

### RLS and policies

```sql
select n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where (n.nspname, c.relname) in (
  ('public', 'lead_consultations'),
  ('public', 'lead_offers'),
  ('public', 'founding_customer_capacity'),
  ('storage', 'objects')
)
order by n.nspname, c.relname;

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where (schemaname, tablename) in (
  ('public', 'lead_consultations'),
  ('public', 'lead_offers'),
  ('public', 'founding_customer_capacity'),
  ('storage', 'objects')
)
order by schemaname, tablename, policyname;
```

Require funnel RLS enabled, no capacity policy, exactly the approved
admin/office funnel policies, and the restrictive task-attachment policy.
Confirm no other storage policy was removed.

### Grants

```sql
select table_schema, table_name, grantee,
       string_agg(privilege_type, ',' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'app_users', 'leads', 'lead_interactions', 'lead_events',
    'promotion_campaigns', 'properties',
    'lead_consultations', 'lead_offers', 'founding_customer_capacity'
  )
  and grantee in ('anon', 'authenticated', 'service_role')
group by table_schema, table_name, grantee
order by table_name, grantee;
```

Require authenticated/service-role CRUD on the six reconciled CRM/property
tables, authenticated CRUD on consultations/offers, and no effective anonymous
funnel access. Existing historical ACLs must be interpreted together with RLS.

### Identity boundary

```sql
select count(*) as human_agent_overlap
from public.app_users u
join public.agent_principals a on a.id = u.id;

select count(*) as incompatible_app_roles
from public.app_users
where role not in ('admin', 'office', 'field', 'contractor', 'household');
```

Both counts must be zero.

## Controlled write checks — separate authorization required

Do not run these as part of the read-only release:

1. Create clearly marked synthetic admin, office, field, and lead fixtures.
2. Confirm admin and office can create/read/update/delete consultations/offers.
3. Confirm field and anonymous access fails.
4. Race two final-place founding reservations and require one winner.
5. Race two conditional offer transitions and require one event.
6. Generate and hash an authenticated Albanian offer PDF.
7. Convert the synthetic lead, record an invoice/payment, validate CAC.
8. Delete every fixture and prove cleanup by ID and marker.

The Founder must authorize the exact fixture scope and cleanup before execution.

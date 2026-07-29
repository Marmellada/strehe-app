\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

-- STREHE-RELEASE-003
-- Read-only, pre-migration production gate for psql.
-- This script emits one JSON object and exits 3 when any STOP check is present.
-- It deliberately returns metadata and aggregate counts only; it never returns
-- customer, lead, offer, or other row-level application data.

BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';

WITH
required_relations(schema_name, relation_name) AS (
  VALUES
    ('public', 'agent_principals'),
    ('public', 'app_users'),
    ('public', 'clients'),
    ('public', 'invoices'),
    ('public', 'lead_events'),
    ('public', 'lead_interactions'),
    ('public', 'leads'),
    ('public', 'payments'),
    ('public', 'promotion_campaigns'),
    ('public', 'properties'),
    ('public', 'subscriptions'),
    ('storage', 'objects')
),
required_columns(schema_name, table_name, column_name, data_type, udt_name) AS (
  VALUES
    ('public', 'app_users', 'id', 'uuid', 'uuid'),
    ('public', 'app_users', 'role', 'text', 'text'),
    ('public', 'agent_principals', 'id', 'uuid', 'uuid'),
    ('public', 'clients', 'id', 'uuid', 'uuid'),
    ('public', 'properties', 'id', 'uuid', 'uuid'),
    ('public', 'subscriptions', 'id', 'uuid', 'uuid'),
    ('public', 'leads', 'id', 'uuid', 'uuid'),
    ('public', 'leads', 'source', 'text', 'text'),
    ('public', 'lead_events', 'event_type', 'text', 'text'),
    ('public', 'promotion_campaigns', 'id', 'uuid', 'uuid'),
    ('storage', 'objects', 'bucket_id', 'text', 'text')
),
pending_columns(schema_name, table_name, column_name) AS (
  VALUES
    ('public', 'promotion_campaigns', 'channel'),
    ('public', 'promotion_campaigns', 'campaign_status'),
    ('public', 'promotion_campaigns', 'planned_budget_cents'),
    ('public', 'promotion_campaigns', 'actual_spend_cents'),
    ('public', 'promotion_campaigns', 'campaign_notes'),
    ('public', 'leads', 'source_detail'),
    ('public', 'leads', 'campaign_id'),
    ('public', 'leads', 'campaign_name'),
    ('public', 'leads', 'utm_source'),
    ('public', 'leads', 'utm_medium'),
    ('public', 'leads', 'utm_campaign'),
    ('public', 'leads', 'utm_content'),
    ('public', 'leads', 'utm_term'),
    ('public', 'leads', 'click_id'),
    ('public', 'leads', 'landing_locale'),
    ('public', 'leads', 'landing_page'),
    ('public', 'leads', 'first_touch_at'),
    ('public', 'leads', 'qualification_outcome'),
    ('public', 'leads', 'qualification_notes'),
    ('public', 'leads', 'qualified_at'),
    ('public', 'leads', 'disqualified_at'),
    ('public', 'leads', 'consultation_scheduled_at'),
    ('public', 'leads', 'consultation_status'),
    ('public', 'leads', 'consultation_completed_at'),
    ('public', 'leads', 'consultation_outcome'),
    ('public', 'leads', 'recommended_package'),
    ('public', 'leads', 'offer_drafted_at'),
    ('public', 'leads', 'current_offer_status'),
    ('public', 'leads', 'offer_sent_at'),
    ('public', 'leads', 'offer_follow_up_date'),
    ('public', 'leads', 'offer_accepted_at'),
    ('public', 'leads', 'offer_rejected_at'),
    ('public', 'leads', 'offer_rejection_reason')
),
pending_object_names(object_kind, object_name) AS (
  VALUES
    ('relation', 'public.lead_consultations'),
    ('relation', 'public.lead_offers'),
    ('relation', 'public.founding_customer_capacity'),
    ('relation', 'public.lead_offer_number_seq'),
    ('function', 'public.protect_lead_first_touch()'),
    ('function', 'public.enforce_founding_customer_capacity()'),
    ('function', 'public.can_manage_sales_funnel()'),
    ('trigger', 'protect_lead_first_touch_trigger'),
    ('trigger', 'enforce_founding_customer_capacity_trigger'),
    ('index', 'idx_leads_campaign_id'),
    ('index', 'idx_leads_qualified_at'),
    ('index', 'idx_leads_consultation_completed_at'),
    ('index', 'idx_leads_offer_sent_at'),
    ('index', 'idx_lead_consultations_lead_id'),
    ('index', 'idx_lead_offers_lead_id'),
    ('index', 'idx_lead_offers_status'),
    ('index', 'idx_lead_offers_one_active_founding_per_lead'),
    ('policy', 'Authorized internal users can manage consultations'),
    ('policy', 'Authorized internal users can manage offers')
),
checks(check_name, status, observed_count, details) AS (
  SELECT
    'required_relations_exist',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'STOP' END,
    count(*)::bigint,
    'Missing required public/storage relations'
  FROM required_relations r
  WHERE to_regclass(format('%I.%I', r.schema_name, r.relation_name)) IS NULL

  UNION ALL

  SELECT
    'required_columns_match',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'STOP' END,
    count(*)::bigint,
    'Missing required columns or incompatible PostgreSQL types'
  FROM required_columns r
  LEFT JOIN information_schema.columns c
    ON c.table_schema = r.schema_name
   AND c.table_name = r.table_name
   AND c.column_name = r.column_name
   AND c.data_type = r.data_type
   AND c.udt_name = r.udt_name
  WHERE c.column_name IS NULL

  UNION ALL

  SELECT
    'required_roles_exist',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'STOP' END,
    count(*)::bigint,
    'Missing anon, authenticated, or service_role database roles'
  FROM (VALUES ('anon'), ('authenticated'), ('service_role')) AS r(role_name)
  LEFT JOIN pg_roles p ON p.rolname = r.role_name
  WHERE p.rolname IS NULL

  UNION ALL

  SELECT
    'active_business_user_helper',
    CASE
      WHEN count(*) = 1
       AND bool_and(p.prosecdef)
       AND bool_and(coalesce(array_to_string(p.proconfig, ','), '') LIKE '%search_path=%')
      THEN 'PASS'
      ELSE 'STOP'
    END,
    count(*)::bigint,
    'Expected exactly public.is_active_business_user(), SECURITY DEFINER, with a fixed search_path'
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'is_active_business_user'
    AND pg_get_function_identity_arguments(p.oid) = ''

  UNION ALL

  SELECT
    'pending_relations_absent',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'STOP' END,
    count(*)::bigint,
    'Pending funnel tables and sequence must not exist before migration'
  FROM pending_object_names o
  WHERE o.object_kind = 'relation'
    AND to_regclass(o.object_name) IS NOT NULL

  UNION ALL

  SELECT
    'pending_columns_absent',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'STOP' END,
    count(*)::bigint,
    'Pending lead/campaign columns must not exist before migration'
  FROM pending_columns p
  JOIN information_schema.columns c
    ON c.table_schema = p.schema_name
   AND c.table_name = p.table_name
   AND c.column_name = p.column_name

  UNION ALL

  SELECT
    'pending_functions_absent',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'STOP' END,
    count(*)::bigint,
    'Pending funnel functions must not exist before migration'
  FROM pending_object_names o
  WHERE o.object_kind = 'function'
    AND to_regprocedure(o.object_name) IS NOT NULL

  UNION ALL

  SELECT
    'pending_triggers_absent',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'STOP' END,
    count(*)::bigint,
    'Pending funnel triggers must not exist before migration'
  FROM pending_object_names o
  JOIN pg_trigger t ON t.tgname = o.object_name AND NOT t.tgisinternal
  WHERE o.object_kind = 'trigger'

  UNION ALL

  SELECT
    'pending_indexes_absent',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'STOP' END,
    count(*)::bigint,
    'Pending funnel index names must not exist before migration'
  FROM pending_object_names o
  JOIN pg_class c ON c.relname = o.object_name AND c.relkind IN ('i', 'I')
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
  WHERE o.object_kind = 'index'

  UNION ALL

  SELECT
    'pending_policies_absent',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'STOP' END,
    count(*)::bigint,
    'Pending funnel policies must not exist before migration'
  FROM pending_object_names o
  JOIN pg_policies p ON p.policyname = o.object_name
  WHERE o.object_kind = 'policy'

  UNION ALL

  SELECT
    'task_attachment_restrictive_policy_absent',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'STOP' END,
    count(*)::bigint,
    'Forward-repair policy must be absent before migration 20260729000000'
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Business identities gate task attachments'

  UNION ALL

  SELECT
    'task_attachment_bucket_inventory',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'STOP' END,
    count(*)::bigint,
    'Expected exactly one storage bucket named task-attachments'
  FROM storage.buckets
  WHERE id = 'task-attachments'

  UNION ALL

  SELECT
    'app_user_roles_compatible',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'STOP' END,
    count(*)::bigint,
    'App-user roles outside admin, office, field, or blocked'
  FROM public.app_users
  WHERE role IS NULL OR role NOT IN ('admin', 'office', 'field', 'blocked')

  UNION ALL

  SELECT
    'human_agent_identity_overlap',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'STOP' END,
    count(*)::bigint,
    'User IDs present in both app_users and agent_principals'
  FROM public.app_users u
  JOIN public.agent_principals a ON a.id = u.id

  UNION ALL

  SELECT
    'lead_source_values_bounded',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'STOP' END,
    count(*)::bigint,
    'Lead source is blank, exceeds 100 characters, or contains control characters'
  FROM public.leads
  WHERE source IS NOT NULL
    AND (
      btrim(source) = ''
      OR length(source) > 100
      OR source ~ '[[:cntrl:]]'
    )

  UNION ALL

  SELECT
    'lead_event_types_compatible',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'STOP' END,
    count(*)::bigint,
    'Lead events outside the post-migration allowed event-type set'
  FROM public.lead_events
  WHERE event_type NOT IN (
    'created',
    'updated',
    'interaction',
    'status_changed',
    'assigned',
    'follow_up_changed',
    'converted',
    'qualified',
    'disqualified',
    'consultation_booked',
    'consultation_completed',
    'consultation_status_changed',
    'offer_created',
    'offer_sent',
    'offer_accepted',
    'offer_rejected',
    'offer_expired',
    'offer_superseded'
  )

  UNION ALL

  SELECT
    'required_rls_enabled',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'STOP' END,
    count(*)::bigint,
    'Existing CRM tables expected to have RLS enabled'
  FROM (VALUES
    ('app_users'),
    ('leads'),
    ('lead_interactions'),
    ('lead_events'),
    ('promotion_campaigns'),
    ('properties')
  ) AS expected(table_name)
  LEFT JOIN pg_class c ON c.relname = expected.table_name AND c.relkind = 'r'
  LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
  WHERE c.oid IS NULL OR NOT c.relrowsecurity

  UNION ALL

  SELECT
    'current_policy_inventory',
    'PASS',
    count(*)::bigint,
    'Aggregate policy count on affected existing relations'
  FROM pg_policies
  WHERE (schemaname = 'public' AND tablename IN (
    'app_users',
    'leads',
    'lead_interactions',
    'lead_events',
    'promotion_campaigns',
    'properties'
  ))
  OR (schemaname = 'storage' AND tablename = 'objects')

  UNION ALL

  SELECT
    'current_runtime_grant_inventory',
    'PASS',
    count(*)::bigint,
    'Aggregate grant count for anon/authenticated/service_role on affected existing relations'
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name IN (
      'app_users',
      'leads',
      'lead_interactions',
      'lead_events',
      'promotion_campaigns',
      'properties'
    )
    AND grantee IN ('anon', 'authenticated', 'service_role')

  UNION ALL

  SELECT
    'current_anonymous_grant_inventory',
    'PASS',
    count(*)::bigint,
    'Aggregate existing anon grants on affected tables; review with RLS and policies (the forward grant adds none)'
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name IN (
      'app_users',
      'leads',
      'lead_interactions',
      'lead_events',
      'promotion_campaigns',
      'properties'
    )
    AND grantee = 'anon'

  UNION ALL

  SELECT
    'long_running_transactions_absent',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'STOP' END,
    count(*)::bigint,
    'Other transactions active for more than five minutes'
  FROM pg_stat_activity
  WHERE pid <> pg_backend_pid()
    AND xact_start IS NOT NULL
    AND state <> 'idle'
    AND clock_timestamp() - xact_start > interval '5 minutes'

  UNION ALL

  SELECT
    'blocking_table_locks_absent',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'STOP' END,
    count(*)::bigint,
    'Granted locks on leads or promotion_campaigns that conflict with ACCESS EXCLUSIVE'
  FROM pg_locks l
  JOIN pg_class c ON c.oid = l.relation
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE l.pid <> pg_backend_pid()
    AND l.granted
    AND n.nspname = 'public'
    AND c.relname IN ('leads', 'promotion_campaigns')
    AND l.mode IN (
      'AccessShareLock',
      'RowShareLock',
      'RowExclusiveLock',
      'ShareUpdateExclusiveLock',
      'ShareLock',
      'ShareRowExclusiveLock',
      'ExclusiveLock',
      'AccessExclusiveLock'
    )

  UNION ALL

  SELECT
    'pending_migration_history_absent',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'STOP' END,
    count(*)::bigint,
    'Pending versions already present in supabase_migrations.schema_migrations'
  FROM supabase_migrations.schema_migrations
  WHERE version IN ('20260728120000', '20260729000000', '20260729001000')
),
result AS (
  SELECT
    jsonb_build_object(
      'release', 'STREHE-RELEASE-003',
      'mode', 'read-only-pre-migration',
      'database', current_database(),
      'checked_at', clock_timestamp(),
      'result', CASE WHEN bool_or(status = 'STOP') THEN 'STOP' ELSE 'PASS' END,
      'stop_count', count(*) FILTER (WHERE status = 'STOP'),
      'checks', jsonb_agg(
        jsonb_build_object(
          'check', check_name,
          'status', status,
          'observed_count', observed_count,
          'details', details
        )
        ORDER BY check_name
      )
    ) AS evidence,
    bool_or(status = 'STOP') AS has_stops
  FROM checks
)
SELECT evidence::text AS preflight_result, has_stops::text
FROM result
\gset

\echo :preflight_result
COMMIT;

\if :has_stops
  -- Deliberately fail after the read-only transaction commits so psql returns
  -- nonzero under ON_ERROR_STOP on clients that do not support \quit codes.
  SELECT 1 / 0 AS preflight_stop;
\endif

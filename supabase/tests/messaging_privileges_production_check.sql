-- STREHË Messaging Ingestion V1 — production privilege verification (READ ONLY).
--
-- Reports BOOLEANS ONLY (no payloads, no phone numbers, no Meta IDs, no PII).
-- Run with psql against the production database AFTER the remediation migration
-- (20260816190000_remediate_messaging_privileges.sql) is applied.
--
-- Expected posture:
--   worker RPCs:        anon = f, authenticated = f, service_role = t
--   can_manage_messaging: anon = f, authenticated = t
--   read tables:        authenticated SELECT = t (others f), anon = all f
--   meta_ingestion_queue: all roles all f
--   meta_webhook_events:  service_role INSERT = t (others f), anon/auth all f

\echo '=== 1. Function EXECUTE (anon | authenticated | service_role) ==='
select 'claim_meta_ingestion_batch(integer)' as object,
  has_function_privilege('anon','public.claim_meta_ingestion_batch(integer)','EXECUTE') as anon,
  has_function_privilege('authenticated','public.claim_meta_ingestion_batch(integer)','EXECUTE') as authenticated,
  has_function_privilege('service_role','public.claim_meta_ingestion_batch(integer)','EXECUTE') as service_role
union all
select 'meta_ingestion_mark_completed(uuid,text)',
  has_function_privilege('anon','public.meta_ingestion_mark_completed(uuid,text)','EXECUTE'),
  has_function_privilege('authenticated','public.meta_ingestion_mark_completed(uuid,text)','EXECUTE'),
  has_function_privilege('service_role','public.meta_ingestion_mark_completed(uuid,text)','EXECUTE')
union all
select 'meta_ingestion_mark_failure(uuid,text,text)',
  has_function_privilege('anon','public.meta_ingestion_mark_failure(uuid,text,text)','EXECUTE'),
  has_function_privilege('authenticated','public.meta_ingestion_mark_failure(uuid,text,text)','EXECUTE'),
  has_function_privilege('service_role','public.meta_ingestion_mark_failure(uuid,text,text)','EXECUTE')
union all
select 'upsert_contact_channel_identity(text,text,text,text,text)',
  has_function_privilege('anon','public.upsert_contact_channel_identity(text,text,text,text,text)','EXECUTE'),
  has_function_privilege('authenticated','public.upsert_contact_channel_identity(text,text,text,text,text)','EXECUTE'),
  has_function_privilege('service_role','public.upsert_contact_channel_identity(text,text,text,text,text)','EXECUTE')
union all
select 'resolve_contact_identity_whatsapp(uuid,text,text)',
  has_function_privilege('anon','public.resolve_contact_identity_whatsapp(uuid,text,text)','EXECUTE'),
  has_function_privilege('authenticated','public.resolve_contact_identity_whatsapp(uuid,text,text)','EXECUTE'),
  has_function_privilege('service_role','public.resolve_contact_identity_whatsapp(uuid,text,text)','EXECUTE')
union all
select 'ensure_conversation(uuid)',
  has_function_privilege('anon','public.ensure_conversation(uuid)','EXECUTE'),
  has_function_privilege('authenticated','public.ensure_conversation(uuid)','EXECUTE'),
  has_function_privilege('service_role','public.ensure_conversation(uuid)','EXECUTE')
union all
select 'ingest_conversation_message(uuid,text,text,text,text,text,text,jsonb,text,text,uuid,timestamptz)',
  has_function_privilege('anon','public.ingest_conversation_message(uuid,text,text,text,text,text,text,jsonb,text,text,uuid,timestamp with time zone)','EXECUTE'),
  has_function_privilege('authenticated','public.ingest_conversation_message(uuid,text,text,text,text,text,text,jsonb,text,text,uuid,timestamp with time zone)','EXECUTE'),
  has_function_privilege('service_role','public.ingest_conversation_message(uuid,text,text,text,text,text,text,jsonb,text,text,uuid,timestamp with time zone)','EXECUTE')
union all
select 'meta_webhook_events_enqueue()',
  has_function_privilege('anon','public.meta_webhook_events_enqueue()','EXECUTE'),
  has_function_privilege('authenticated','public.meta_webhook_events_enqueue()','EXECUTE'),
  has_function_privilege('service_role','public.meta_webhook_events_enqueue()','EXECUTE')
union all
select 'can_manage_messaging()',
  has_function_privilege('anon','public.can_manage_messaging()','EXECUTE'),
  has_function_privilege('authenticated','public.can_manage_messaging()','EXECUTE'),
  has_function_privilege('service_role','public.can_manage_messaging()','EXECUTE');

\echo '=== 2. Read-model table privileges (role | select | insert | update | delete) ==='
select 'authenticated' as role, 'contact_channel_identities' as table_name,
  has_table_privilege('authenticated','public.contact_channel_identities','SELECT') as sel,
  has_table_privilege('authenticated','public.contact_channel_identities','INSERT') as ins,
  has_table_privilege('authenticated','public.contact_channel_identities','UPDATE') as upd,
  has_table_privilege('authenticated','public.contact_channel_identities','DELETE') as del
union all
select 'authenticated','conversations',
  has_table_privilege('authenticated','public.conversations','SELECT'),
  has_table_privilege('authenticated','public.conversations','INSERT'),
  has_table_privilege('authenticated','public.conversations','UPDATE'),
  has_table_privilege('authenticated','public.conversations','DELETE')
union all
select 'authenticated','conversation_messages',
  has_table_privilege('authenticated','public.conversation_messages','SELECT'),
  has_table_privilege('authenticated','public.conversation_messages','INSERT'),
  has_table_privilege('authenticated','public.conversation_messages','UPDATE'),
  has_table_privilege('authenticated','public.conversation_messages','DELETE')
union all
select 'anon','contact_channel_identities',
  has_table_privilege('anon','public.contact_channel_identities','SELECT'),
  has_table_privilege('anon','public.contact_channel_identities','INSERT'),
  has_table_privilege('anon','public.contact_channel_identities','UPDATE'),
  has_table_privilege('anon','public.contact_channel_identities','DELETE')
union all
select 'anon','conversations',
  has_table_privilege('anon','public.conversations','SELECT'),
  has_table_privilege('anon','public.conversations','INSERT'),
  has_table_privilege('anon','public.conversations','UPDATE'),
  has_table_privilege('anon','public.conversations','DELETE')
union all
select 'anon','conversation_messages',
  has_table_privilege('anon','public.conversation_messages','SELECT'),
  has_table_privilege('anon','public.conversation_messages','INSERT'),
  has_table_privilege('anon','public.conversation_messages','UPDATE'),
  has_table_privilege('anon','public.conversation_messages','DELETE');

\echo '=== 3. meta_ingestion_queue table privileges (all roles all f expected) ==='
select 'anon' as role,
  has_table_privilege('anon','public.meta_ingestion_queue','SELECT') as sel,
  has_table_privilege('anon','public.meta_ingestion_queue','INSERT') as ins,
  has_table_privilege('anon','public.meta_ingestion_queue','UPDATE') as upd,
  has_table_privilege('anon','public.meta_ingestion_queue','DELETE') as del
union all
select 'authenticated',
  has_table_privilege('authenticated','public.meta_ingestion_queue','SELECT'),
  has_table_privilege('authenticated','public.meta_ingestion_queue','INSERT'),
  has_table_privilege('authenticated','public.meta_ingestion_queue','UPDATE'),
  has_table_privilege('authenticated','public.meta_ingestion_queue','DELETE')
union all
select 'service_role',
  has_table_privilege('service_role','public.meta_ingestion_queue','SELECT'),
  has_table_privilege('service_role','public.meta_ingestion_queue','INSERT'),
  has_table_privilege('service_role','public.meta_ingestion_queue','UPDATE'),
  has_table_privilege('service_role','public.meta_ingestion_queue','DELETE');

\echo '=== 4. meta_webhook_events (raw journal) table privileges ==='
select 'service_role' as role,
  has_table_privilege('service_role','public.meta_webhook_events','SELECT') as sel,
  has_table_privilege('service_role','public.meta_webhook_events','INSERT') as ins,
  has_table_privilege('service_role','public.meta_webhook_events','UPDATE') as upd,
  has_table_privilege('service_role','public.meta_webhook_events','DELETE') as del
union all
select 'anon',
  has_table_privilege('anon','public.meta_webhook_events','SELECT'),
  has_table_privilege('anon','public.meta_webhook_events','INSERT'),
  has_table_privilege('anon','public.meta_webhook_events','UPDATE'),
  has_table_privilege('anon','public.meta_webhook_events','DELETE')
union all
select 'authenticated',
  has_table_privilege('authenticated','public.meta_webhook_events','SELECT'),
  has_table_privilege('authenticated','public.meta_webhook_events','INSERT'),
  has_table_privilege('authenticated','public.meta_webhook_events','UPDATE'),
  has_table_privilege('authenticated','public.meta_webhook_events','DELETE');

-- STREHË Messaging Ingestion V1 — privilege remediation (forward-only).
--
-- Corrects an unintended privilege posture. Supabase default privileges
-- (ALTER DEFAULT PRIVILEGES ... GRANT ALL ON FUNCTIONS/TABLES to anon,
-- authenticated, service_role) caused the V1 SECURITY DEFINER worker RPCs to
-- be EXECUTE-able by anon/authenticated. The V1 migration's
-- `revoke ... from public` only removed the PUBLIC pseudo-role grant, not the
-- per-role default grants.
--
-- This migration explicitly revokes and re-grants the intended least-privilege
-- posture. It does NOT modify already-applied migration history, does NOT
-- touch public.meta_webhook_events (raw journal), and does NOT weaken
-- public.meta_ingestion_queue.

-- 1. Worker / internal processing functions: executable only by service_role.
revoke all on function public.meta_webhook_events_enqueue() from public, anon, authenticated;
grant execute on function public.meta_webhook_events_enqueue() to service_role;

revoke all on function public.claim_meta_ingestion_batch(integer) from public, anon, authenticated;
grant execute on function public.claim_meta_ingestion_batch(integer) to service_role;

revoke all on function public.meta_ingestion_mark_completed(uuid, text) from public, anon, authenticated;
grant execute on function public.meta_ingestion_mark_completed(uuid, text) to service_role;

revoke all on function public.meta_ingestion_mark_failure(uuid, text, text) from public, anon, authenticated;
grant execute on function public.meta_ingestion_mark_failure(uuid, text, text) to service_role;

revoke all on function public.upsert_contact_channel_identity(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.upsert_contact_channel_identity(text, text, text, text, text) to service_role;

revoke all on function public.resolve_contact_identity_whatsapp(uuid, text, text) from public, anon, authenticated;
grant execute on function public.resolve_contact_identity_whatsapp(uuid, text, text) to service_role;

revoke all on function public.ensure_conversation(uuid) from public, anon, authenticated;
grant execute on function public.ensure_conversation(uuid) to service_role;

revoke all on function public.ingest_conversation_message(uuid, text, text, text, text, text, text, jsonb, text, text, uuid, timestamp with time zone) from public, anon, authenticated;
grant execute on function public.ingest_conversation_message(uuid, text, text, text, text, text, text, jsonb, text, text, uuid, timestamp with time zone) to service_role;

-- 2. Operator RLS helper: authenticated only (required for admin/office RLS
--    evaluation). service_role does not require it.
revoke all on function public.can_manage_messaging() from public, anon, service_role;
grant execute on function public.can_manage_messaging() to authenticated;

-- 3. Operator read models: authenticated SELECT-only; anon none. service_role
--    is already revoked (functions are the only worker path) and is re-asserted
--    here for explicitness.
revoke all on table public.contact_channel_identities from authenticated, anon, service_role;
grant select on table public.contact_channel_identities to authenticated;

revoke all on table public.conversations from authenticated, anon, service_role;
grant select on table public.conversations to authenticated;

revoke all on table public.conversation_messages from authenticated, anon, service_role;
grant select on table public.conversation_messages to authenticated;

-- Intentionally unchanged:
--   * public.meta_ingestion_queue — remains fully revoked (no role has table
--     access; the SECURITY DEFINER functions are the only path).
--   * public.meta_webhook_events — raw journal permissions unchanged
--     (service_role INSERT-only).

-- STREHË Messaging Ingestion V1 — foundational tables.
-- The raw webhook journal (public.meta_webhook_events) is intentionally unchanged.

-- Contact-channel identity: one row per (channel, channel_account_id, external_id).
-- external_id is the customer-side Meta identity (wa_id phone, IGSID, PSID).
-- channel_account_id is the business-side Meta scope (WABA id, IG account id, page id).
create table public.contact_channel_identities (
  id uuid primary key default gen_random_uuid(),
  channel text not null,
  channel_account_id text not null,
  external_id text not null,
  display_name text,
  phone_e164 text,
  lead_id uuid references public.leads(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  resolution_status text not null default 'unresolved',
  first_seen_at timestamp with time zone not null default now(),
  last_seen_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint contact_channel_identities_channel_check
    check (channel in ('whatsapp', 'instagram', 'messenger')),
  constraint contact_channel_identities_resolution_status_check
    check (resolution_status in ('unresolved', 'resolved', 'needs_review')),
  constraint contact_channel_identities_single_owner_check
    check (lead_id is null or client_id is null),
  constraint contact_channel_identities_channel_account_external_key
    unique (channel, channel_account_id, external_id)
);

create index contact_channel_identities_lead_id_idx
  on public.contact_channel_identities (lead_id);

create index contact_channel_identities_client_id_idx
  on public.contact_channel_identities (client_id);

-- Conversations: one operational conversation per identity in V1.
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  contact_identity_id uuid not null references public.contact_channel_identities(id) on delete cascade,
  status text not null default 'open',
  attention_state text not null default 'none',
  assigned_user_id uuid references public.app_users(id) on delete set null,
  unread_count integer not null default 0,
  last_message_at timestamp with time zone,
  last_inbound_at timestamp with time zone,
  last_outbound_at timestamp with time zone,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint conversations_status_check
    check (status in ('open', 'resolved', 'archived')),
  constraint conversations_attention_state_check
    check (attention_state in ('needs_reply', 'waiting_customer', 'none')),
  constraint conversations_unread_count_check
    check (unread_count >= 0),
  constraint conversations_identity_key
    unique (contact_identity_id)
);

create index conversations_attention_idx
  on public.conversations (attention_state, status, assigned_user_id);

-- Normalized messages.
-- source_webhook_event_id is intentionally a plain uuid (no FK) so the raw
-- journal can be independently retained/purged without breaking message history.
create table public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  channel text not null,
  channel_account_id text not null,
  external_message_id text not null,
  direction text not null,
  message_type text not null,
  text_content text,
  content jsonb,
  sender_external_id text,
  recipient_external_id text,
  source_webhook_event_id uuid,
  occurred_at timestamp with time zone,
  received_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  constraint conversation_messages_channel_check
    check (channel in ('whatsapp', 'instagram', 'messenger')),
  constraint conversation_messages_direction_check
    check (direction in ('inbound', 'outbound')),
  constraint conversation_messages_type_check
    check (message_type in ('text', 'image', 'audio', 'video', 'document', 'reaction', 'unknown')),
  constraint conversation_messages_dedupe_key
    unique (channel, channel_account_id, external_message_id)
);

create index conversation_messages_conversation_time_idx
  on public.conversation_messages (conversation_id, occurred_at desc);

create index conversation_messages_source_event_idx
  on public.conversation_messages (source_webhook_event_id);

-- Raw-event ingestion queue. webhook_event_id is unique: each raw event is
-- enqueued at most once.
create table public.meta_ingestion_queue (
  id uuid primary key default gen_random_uuid(),
  webhook_event_id uuid not null unique references public.meta_webhook_events(id) on delete cascade,
  status text not null default 'pending',
  outcome text,
  attempt_count integer not null default 0,
  available_at timestamp with time zone not null default now(),
  claimed_at timestamp with time zone,
  lease_expires_at timestamp with time zone,
  processed_at timestamp with time zone,
  last_error_class text,
  last_error_step text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint meta_ingestion_queue_status_check
    check (status in ('pending', 'processing', 'completed', 'failed')),
  constraint meta_ingestion_queue_outcome_check
    check (outcome is null or outcome in ('message_created', 'duplicate', 'non_message', 'unsupported', 'synthetic_test')),
  constraint meta_ingestion_queue_attempt_count_check
    check (attempt_count >= 0)
);

create index meta_ingestion_queue_status_available_idx
  on public.meta_ingestion_queue (status, available_at);

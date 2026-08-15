-- Receive-only, append-only sink for authenticated Meta webhook deliveries.

create table public.meta_webhook_events (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'unknown',
  object_type text,
  event_type text,
  payload_sha256 text not null,
  payload jsonb not null,
  received_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  constraint meta_webhook_events_channel_check
    check (channel in ('facebook', 'messenger', 'instagram', 'whatsapp', 'unknown')),
  constraint meta_webhook_events_payload_sha256_check
    check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  constraint meta_webhook_events_payload_size_check
    check (octet_length(payload::text) <= 1048576)
);

create index meta_webhook_events_channel_received_at_idx
  on public.meta_webhook_events (channel, received_at desc);

alter table public.meta_webhook_events enable row level security;

revoke all on table public.meta_webhook_events from anon, authenticated;
revoke all on table public.meta_webhook_events from service_role;
grant insert on table public.meta_webhook_events to service_role;

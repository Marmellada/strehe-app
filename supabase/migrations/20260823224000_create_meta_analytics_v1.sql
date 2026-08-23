-- Meta Analytics V1
-- Stores normalized daily account metrics and daily snapshots of content metrics.
-- Meta credentials/tokens are never persisted here.

create table public.meta_analytics_daily (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  metric text not null,
  metric_date date not null,
  value_numeric numeric,
  value_json jsonb,
  observed_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),

  constraint meta_analytics_daily_platform_check
    check (platform in ('facebook', 'instagram')),

  constraint meta_analytics_daily_metric_check
    check (length(trim(metric)) > 0),

  constraint meta_analytics_daily_value_check
    check (
      (value_numeric is not null) <> (value_json is not null)
    ),

  constraint meta_analytics_daily_unique
    unique (platform, metric, metric_date)
);

create index meta_analytics_daily_date_idx
  on public.meta_analytics_daily (metric_date desc, platform);


create table public.meta_content_items (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  external_content_id text not null,
  content_type text,
  published_at timestamp with time zone,
  caption text,
  permalink text,
  last_synced_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  constraint meta_content_items_platform_check
    check (platform in ('facebook', 'instagram')),

  constraint meta_content_items_external_id_check
    check (length(trim(external_content_id)) > 0),

  constraint meta_content_items_unique
    unique (platform, external_content_id)
);

create index meta_content_items_published_idx
  on public.meta_content_items (platform, published_at desc);


create table public.meta_content_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null
    references public.meta_content_items(id)
    on delete cascade,
  metric text not null,
  snapshot_date date not null,
  value_numeric numeric,
  value_json jsonb,
  observed_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),

  constraint meta_content_metric_snapshots_metric_check
    check (length(trim(metric)) > 0),

  constraint meta_content_metric_snapshots_value_check
    check (
      (value_numeric is not null) <> (value_json is not null)
    ),

  constraint meta_content_metric_snapshots_unique
    unique (content_item_id, metric, snapshot_date)
);

create index meta_content_metric_snapshots_date_idx
  on public.meta_content_metric_snapshots
  (snapshot_date desc, content_item_id);


alter table public.meta_analytics_daily enable row level security;
alter table public.meta_content_items enable row level security;
alter table public.meta_content_metric_snapshots enable row level security;

revoke all on table public.meta_analytics_daily
  from anon, authenticated, service_role;

revoke all on table public.meta_content_items
  from anon, authenticated, service_role;

revoke all on table public.meta_content_metric_snapshots
  from anon, authenticated, service_role;

grant select, insert, update
  on table public.meta_analytics_daily
  to service_role;

grant select, insert, update
  on table public.meta_content_items
  to service_role;

grant select, insert, update
  on table public.meta_content_metric_snapshots
  to service_role;
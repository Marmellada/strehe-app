import { getAdminClient } from "@/lib/supabase/admin";

const INSTAGRAM_ACCOUNT_METRICS = [
  "reach",
  "profile_views",
];

const FACEBOOK_ACCOUNT_METRICS = [
  "page_media_view",
  "page_total_media_view_unique",
  "page_views_total",
  "page_post_engagements",
  "page_follows",
  "page_daily_follows",
];

const INSTAGRAM_CONTENT_METRICS = [
  "views",
  "reach",
  "likes",
  "comments",
  "shares",
  "saved",
  "total_interactions",
];

const FACEBOOK_CONTENT_METRICS = [
  "post_media_view",
  "post_total_media_view_unique",
  "post_clicks",
  "post_reactions_by_type_total",
];

const CONTENT_LIMIT = 25;
const BUSINESS_TIME_ZONE = "Europe/Belgrade";

type Platform = "facebook" | "instagram";

type MetaResponse = {
  ok: boolean;
  status: number;
  payload: unknown;
};

type PlatformSummary = {
  accountMetrics: number;
  contentItems: number;
  contentMetrics: number;
};

export type MetaAnalyticsSyncSummary = {
  instagram: PlatformSummary;
  facebook: PlatformSummary;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function dataArray(payload: unknown): unknown[] {
  const record = asRecord(payload);
  return record && Array.isArray(record.data)
    ? record.data
    : [];
}

async function metaGet(
  url: URL | string,
  token: string
): Promise<MetaResponse> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  let payload: unknown = null;

  try {
    payload = await response.json();
  } catch {
    // Keep provider response bodies out of logs and API output.
  }

  return {
    ok: response.ok,
    status: response.status,
    payload,
  };
}

function todayInBusinessTimeZone(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return new Date().toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}

function previousCalendarDate(endTime: unknown): string | null {
  if (typeof endTime !== "string") return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(endTime);
  if (!match) return null;

  const date = new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3])
    )
  );

  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function storedValue(value: unknown) {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return {
      value_numeric: value,
      value_json: null,
    };
  }

  if (value !== undefined && value !== null) {
    return {
      value_numeric: null,
      value_json: value,
    };
  }

  return null;
}

async function fetchInsights(
  baseUrl: string,
  token: string,
  metrics: readonly string[],
  period?: string
): Promise<unknown[]> {
  const combined = new URL(baseUrl);
  combined.searchParams.set("metric", metrics.join(","));

  if (period) {
    combined.searchParams.set("period", period);
  }

  const combinedResponse = await metaGet(combined, token);

  if (combinedResponse.ok) {
    return dataArray(combinedResponse.payload);
  }

  // Defensive fallback: one unsupported metric should not suppress all others.
  const successful: unknown[] = [];

  for (const metric of metrics) {
    const url = new URL(baseUrl);
    url.searchParams.set("metric", metric);

    if (period) {
      url.searchParams.set("period", period);
    }

    const response = await metaGet(url, token);

    if (response.ok) {
      successful.push(...dataArray(response.payload));
    }
  }

  if (successful.length === 0) {
    throw new Error(
      `Meta Insights request failed with HTTP ${combinedResponse.status}.`
    );
  }

  return successful;
}

function accountMetricRows(
  platform: Platform,
  insights: unknown[]
) {
  const rows: Array<{
    platform: Platform;
    metric: string;
    metric_date: string;
    value_numeric: number | null;
    value_json: unknown | null;
    observed_at: string;
  }> = [];

  const observedAt = new Date().toISOString();

  for (const rawMetric of insights) {
    const metric = asRecord(rawMetric);
    const name =
      typeof metric?.name === "string"
        ? metric.name
        : null;

    if (!name || !Array.isArray(metric?.values)) {
      continue;
    }

    for (const rawPoint of metric.values) {
      const point = asRecord(rawPoint);
      if (!point || !("value" in point)) continue;

      const date = previousCalendarDate(point.end_time);
      if (!date) continue;

      const value = storedValue(point.value);
      if (!value) continue;

      rows.push({
        platform,
        metric: name,
        metric_date: date,
        ...value,
        observed_at: observedAt,
      });
    }
  }

  return rows;
}

function snapshotMetricRows(
  contentItemId: string,
  insights: unknown[],
  snapshotDate: string
) {
  const rows: Array<{
    content_item_id: string;
    metric: string;
    snapshot_date: string;
    value_numeric: number | null;
    value_json: unknown | null;
    observed_at: string;
  }> = [];

  const observedAt = new Date().toISOString();

  for (const rawMetric of insights) {
    const metric = asRecord(rawMetric);
    const name =
      typeof metric?.name === "string"
        ? metric.name
        : null;

    if (!name || !Array.isArray(metric?.values)) {
      continue;
    }

    const rawPoint = metric.values.at(-1);
    const point = asRecord(rawPoint);

    if (!point || !("value" in point)) continue;

    const value = storedValue(point.value);
    if (!value) continue;

    rows.push({
      content_item_id: contentItemId,
      metric: name,
      snapshot_date: snapshotDate,
      ...value,
      observed_at: observedAt,
    });
  }

  // Meta can return duplicate entries for the same logical content metric.
  // Our storage model keeps one snapshot per content + metric + day,
  // so normalize the batch before upserting.
  const uniqueRows = new Map<string, (typeof rows)[number]>();

  for (const row of rows) {
    uniqueRows.set(row.metric, row);
  }

  return Array.from(uniqueRows.values());
}

async function persistAccountMetrics(
  platform: Platform,
  insights: unknown[]
): Promise<number> {
  const supabase = getAdminClient();
  const rows = accountMetricRows(platform, insights);

  if (rows.length === 0) return 0;

  const { error } = await supabase
    .from("meta_analytics_daily")
    .upsert(rows, {
      onConflict: "platform,metric,metric_date",
    });

  if (error) {
    throw new Error(
      `Unable to persist ${platform} account analytics.`
    );
  }

  return rows.length;
}

async function persistContent(
  platform: Platform,
  item: {
    externalId: string;
    contentType: string | null;
    publishedAt: string | null;
    caption: string | null;
    permalink: string | null;
  },
  insights: unknown[],
  snapshotDate: string
): Promise<number> {
  const supabase = getAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("meta_content_items")
    .upsert(
      {
        platform,
        external_content_id: item.externalId,
        content_type: item.contentType,
        published_at: item.publishedAt,
        caption: item.caption,
        permalink: item.permalink,
        last_synced_at: now,
        updated_at: now,
      },
      {
        onConflict: "platform,external_content_id",
      }
    )
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(
      `Unable to persist ${platform} content item.`
    );
  }

  const rows = snapshotMetricRows(
    data.id,
    insights,
    snapshotDate
  );

  if (rows.length === 0) return 0;

  const metricResult = await supabase
    .from("meta_content_metric_snapshots")
    .upsert(rows, {
      onConflict: "content_item_id,metric,snapshot_date",
    });

  if (metricResult.error) {
    throw new Error(
      `Unable to persist ${platform} content analytics: ` +
      `${metricResult.error.code ?? "unknown"} - ` +
      `${metricResult.error.message ?? "unknown"}`
    );
  }

  return rows.length;
}

async function syncInstagram(
  version: string,
  token: string,
  snapshotDate: string
): Promise<PlatformSummary> {
  const accountResponse = await metaGet(
    `https://graph.instagram.com/${encodeURIComponent(version)}/me?fields=id`,
    token
  );

  if (!accountResponse.ok) {
    throw new Error("Instagram account lookup failed.");
  }

  const account = asRecord(accountResponse.payload);
  const accountId =
    typeof account?.id === "string"
      ? account.id.trim()
      : "";

  if (!accountId) {
    throw new Error("Instagram account ID was not returned.");
  }

  const accountInsights = await fetchInsights(
    `https://graph.instagram.com/${encodeURIComponent(version)}/${encodeURIComponent(accountId)}/insights`,
    token,
    INSTAGRAM_ACCOUNT_METRICS,
    "day"
  );

  const accountMetrics = await persistAccountMetrics(
    "instagram",
    accountInsights
  );

  const mediaUrl = new URL(
    `https://graph.instagram.com/${encodeURIComponent(version)}/${encodeURIComponent(accountId)}/media`
  );

  mediaUrl.searchParams.set(
    "fields",
    "id,media_type,timestamp,caption,permalink"
  );
  mediaUrl.searchParams.set(
    "limit",
    String(CONTENT_LIMIT)
  );

  const mediaResponse = await metaGet(mediaUrl, token);

  if (!mediaResponse.ok) {
    throw new Error("Instagram media lookup failed.");
  }

  let contentItems = 0;
  let contentMetrics = 0;

  for (const rawItem of dataArray(mediaResponse.payload)) {
    const item = asRecord(rawItem);

    const externalId =
      typeof item?.id === "string"
        ? item.id.trim()
        : "";

    if (!externalId) continue;

    const insights = await fetchInsights(
      `https://graph.instagram.com/${encodeURIComponent(version)}/${encodeURIComponent(externalId)}/insights`,
      token,
      INSTAGRAM_CONTENT_METRICS
    );

    contentMetrics += await persistContent(
      "instagram",
      {
        externalId,
        contentType:
          typeof item?.media_type === "string"
            ? item.media_type
            : null,
        publishedAt:
          typeof item?.timestamp === "string"
            ? item.timestamp
            : null,
        caption:
          typeof item?.caption === "string"
            ? item.caption
            : null,
        permalink:
          typeof item?.permalink === "string"
            ? item.permalink
            : null,
      },
      insights,
      snapshotDate
    );

    contentItems += 1;
  }

  return {
    accountMetrics,
    contentItems,
    contentMetrics,
  };
}

async function syncFacebook(
  version: string,
  token: string,
  snapshotDate: string
): Promise<PlatformSummary> {
  const accountResponse = await metaGet(
    `https://graph.facebook.com/${encodeURIComponent(version)}/me?fields=id`,
    token
  );

  if (!accountResponse.ok) {
    throw new Error("Facebook Page lookup failed.");
  }

  const accountInsights = await fetchInsights(
    `https://graph.facebook.com/${encodeURIComponent(version)}/me/insights`,
    token,
    FACEBOOK_ACCOUNT_METRICS,
    "day"
  );

  const accountMetrics = await persistAccountMetrics(
    "facebook",
    accountInsights
  );

  const postsUrl = new URL(
    `https://graph.facebook.com/${encodeURIComponent(version)}/me/posts`
  );

  postsUrl.searchParams.set(
    "fields",
    "id,created_time,message,permalink_url"
  );
  postsUrl.searchParams.set(
    "limit",
    String(CONTENT_LIMIT)
  );

  const postsResponse = await metaGet(postsUrl, token);

  if (!postsResponse.ok) {
    throw new Error("Facebook post lookup failed.");
  }

  let contentItems = 0;
  let contentMetrics = 0;

  for (const rawItem of dataArray(postsResponse.payload)) {
    const item = asRecord(rawItem);

    const externalId =
      typeof item?.id === "string"
        ? item.id.trim()
        : "";

    if (!externalId) continue;

    const insights = await fetchInsights(
      `https://graph.facebook.com/${encodeURIComponent(version)}/${encodeURIComponent(externalId)}/insights`,
      token,
      FACEBOOK_CONTENT_METRICS
    );

    contentMetrics += await persistContent(
      "facebook",
      {
        externalId,
        contentType: "POST",
        publishedAt:
          typeof item?.created_time === "string"
            ? item.created_time
            : null,
        caption:
          typeof item?.message === "string"
            ? item.message
            : null,
        permalink:
          typeof item?.permalink_url === "string"
            ? item.permalink_url
            : null,
      },
      insights,
      snapshotDate
    );

    contentItems += 1;
  }

  return {
    accountMetrics,
    contentItems,
    contentMetrics,
  };
}

export async function runMetaAnalyticsSync(): Promise<MetaAnalyticsSyncSummary> {
  const version =
    process.env.META_GRAPH_API_VERSION?.trim();

  const instagramToken =
    process.env.META_INSTAGRAM_ACCESS_TOKEN?.trim();

  const facebookToken =
    process.env.META_MESSENGER_ACCESS_TOKEN?.trim();

  if (!version || !instagramToken || !facebookToken) {
    throw new Error(
      "Meta Analytics configuration is incomplete."
    );
  }

  const snapshotDate = todayInBusinessTimeZone();

  const instagram = await syncInstagram(
    version,
    instagramToken,
    snapshotDate
  );

  const facebook = await syncFacebook(
    version,
    facebookToken,
    snapshotDate
  );

  return {
    instagram,
    facebook,
  };
}
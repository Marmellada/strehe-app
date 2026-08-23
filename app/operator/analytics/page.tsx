import { PageHeader } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
} from "@/components/ui/Table";
import { requireRole } from "@/lib/auth/require-role";
import { getAdminClient } from "@/lib/supabase/admin";

type Platform = "facebook" | "instagram";

type AccountMetricRow = {
  platform: Platform;
  metric: string;
  metric_date: string;
  value_numeric: number | string | null;
  value_json: unknown | null;
  observed_at: string;
};

type ContentItemRow = {
  id: string;
  platform: Platform;
  external_content_id: string;
  content_type: string | null;
  published_at: string | null;
  caption: string | null;
  permalink: string | null;
};

type ContentMetricRow = {
  content_item_id: string;
  metric: string;
  snapshot_date: string;
  value_numeric: number | string | null;
  value_json: unknown | null;
};

const ACCOUNT_LABELS: Record<string, string> = {
  reach: "Reach",
  profile_views: "Profile views",
  page_media_view: "Media views",
  page_total_media_view_unique: "Unique media viewers",
  page_views_total: "Page views",
  page_post_engagements: "Post engagements",
  page_follows: "Follows",
  page_daily_follows: "Daily follows",
};

function numericValue(value: number | string | null) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function formatMetricValue(
  numeric: number | string | null,
  json: unknown | null
) {
  const value = numericValue(numeric);

  if (value !== null) {
    return new Intl.NumberFormat("en-GB").format(value);
  }

  if (json !== null && json !== undefined) {
    if (typeof json === "string") return json;

    try {
      return JSON.stringify(json);
    } catch {
      return "Available";
    }
  }

  return "—";
}

function metricLabel(metric: string) {
  return (
    ACCOUNT_LABELS[metric] ||
    metric
      .replace(/^page_/, "")
      .replace(/^post_/, "")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

function platformLabel(platform: Platform) {
  return platform === "instagram" ? "Instagram" : "Facebook";
}

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function shortCaption(value: string | null) {
  if (!value?.trim()) return "Untitled content";

  const text = value.trim();
  return text.length > 100
    ? `${text.slice(0, 97)}...`
    : text;
}

function metricNumber(
  metrics: Map<string, ContentMetricRow>,
  name: string
) {
  return numericValue(metrics.get(name)?.value_numeric ?? null) ?? 0;
}

export default async function MetaAnalyticsPage() {
  await requireRole(["admin", "office"]);

  const supabase = getAdminClient();

  const { data: accountData, error: accountError } = await supabase
    .from("meta_analytics_daily")
    .select(
      "platform,metric,metric_date,value_numeric,value_json,observed_at"
    )
    .order("metric_date", { ascending: false })
    .order("observed_at", { ascending: false })
    .limit(200);

  if (accountError) {
    throw new Error(
      `Unable to load Meta account analytics: ${accountError.message}`
    );
  }

  const accountRows = (accountData || []) as AccountMetricRow[];

  const latestAccount = new Map<string, AccountMetricRow>();

  for (const row of accountRows) {
    const key = `${row.platform}:${row.metric}`;

    if (!latestAccount.has(key)) {
      latestAccount.set(key, row);
    }
  }

  const { data: latestSnapshotData, error: latestSnapshotError } =
    await supabase
      .from("meta_content_metric_snapshots")
      .select("snapshot_date")
      .order("snapshot_date", { ascending: false })
      .limit(1);

  if (latestSnapshotError) {
    throw new Error(
      `Unable to determine latest Meta content snapshot: ${latestSnapshotError.message}`
    );
  }

  const latestSnapshotDate =
    latestSnapshotData?.[0]?.snapshot_date ?? null;

  let contentItems: ContentItemRow[] = [];
  let contentMetrics: ContentMetricRow[] = [];

  if (latestSnapshotDate) {
    const { data: metricData, error: metricError } = await supabase
      .from("meta_content_metric_snapshots")
      .select(
        "content_item_id,metric,snapshot_date,value_numeric,value_json"
      )
      .eq("snapshot_date", latestSnapshotDate);

    if (metricError) {
      throw new Error(
        `Unable to load Meta content metrics: ${metricError.message}`
      );
    }

    contentMetrics = (metricData || []) as ContentMetricRow[];

    const contentIds = [
      ...new Set(
        contentMetrics.map((row) => row.content_item_id)
      ),
    ];

    if (contentIds.length > 0) {
      const { data: itemData, error: itemError } = await supabase
        .from("meta_content_items")
        .select(
          "id,platform,external_content_id,content_type,published_at,caption,permalink"
        )
        .in("id", contentIds);

      if (itemError) {
        throw new Error(
          `Unable to load Meta content items: ${itemError.message}`
        );
      }

      contentItems = (itemData || []) as ContentItemRow[];
    }
  }

  const metricsByContent = new Map<
    string,
    Map<string, ContentMetricRow>
  >();

  for (const row of contentMetrics) {
    if (!metricsByContent.has(row.content_item_id)) {
      metricsByContent.set(row.content_item_id, new Map());
    }

    metricsByContent
      .get(row.content_item_id)!
      .set(row.metric, row);
  }

  const rankedContent = contentItems
    .map((item) => {
      const metrics =
        metricsByContent.get(item.id) ||
        new Map<string, ContentMetricRow>();

      const views =
        item.platform === "instagram"
          ? metricNumber(metrics, "views")
          : metricNumber(metrics, "post_media_view");

      const reachOrUnique =
        item.platform === "instagram"
          ? metricNumber(metrics, "reach")
          : metricNumber(
              metrics,
              "post_total_media_view_unique"
            );

      const engagement =
        item.platform === "instagram"
          ? metricNumber(metrics, "total_interactions")
          : metricNumber(metrics, "post_clicks");

      return {
        item,
        views,
        reachOrUnique,
        engagement,
      };
    })
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  const summaryMetrics = [
    {
      label: "Instagram reach",
      row: latestAccount.get("instagram:reach"),
    },
    {
      label: "Facebook media views",
      row: latestAccount.get("facebook:page_media_view"),
    },
    {
      label: "Facebook unique viewers",
      row: latestAccount.get(
        "facebook:page_total_media_view_unique"
      ),
    },
    {
      label: "Facebook engagements",
      row: latestAccount.get(
        "facebook:page_post_engagements"
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meta Analytics"
        description="Facebook and Instagram performance collected directly from Meta."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryMetrics.map(({ label, row }) => (
          <div
            key={label}
            className="rounded-lg border bg-background p-4"
          >
            <p className="text-sm text-muted-foreground">
              {label}
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {row
                ? formatMetricValue(
                    row.value_numeric,
                    row.value_json
                  )
                : "—"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {row
                ? `Daily metric · ${formatDate(row.metric_date)}`
                : "No data yet"}
            </p>
          </div>
        ))}
      </div>

      <SectionCard title="Latest account metrics">
        <TableShell className="rounded-none border-x-0 border-b-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Platform</TableHead>
                <TableHead>Metric</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Date</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {[...latestAccount.values()]
                .sort((a, b) =>
                  `${a.platform}:${a.metric}`.localeCompare(
                    `${b.platform}:${b.metric}`
                  )
                )
                .map((row) => (
                  <TableRow key={`${row.platform}:${row.metric}`}>
                    <TableCell>
                      {platformLabel(row.platform)}
                    </TableCell>
                    <TableCell>
                      {metricLabel(row.metric)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMetricValue(
                        row.value_numeric,
                        row.value_json
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatDate(row.metric_date)}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableShell>
      </SectionCard>

      <SectionCard
        title={
          latestSnapshotDate
            ? `Top content · ${formatDate(latestSnapshotDate)}`
            : "Top content"
        }
      >
        {rankedContent.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No Meta content analytics have been synchronized yet.
          </p>
        ) : (
          <TableShell className="rounded-none border-x-0 border-b-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Platform</TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">
                    Reach / unique
                  </TableHead>
                  <TableHead className="text-right">
                    Interactions / clicks
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {rankedContent.map(
                  ({
                    item,
                    views,
                    reachOrUnique,
                    engagement,
                  }) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {platformLabel(item.platform)}
                      </TableCell>

                      <TableCell className="max-w-md">
                        {item.permalink ? (
                          <a
                            href={item.permalink}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:underline"
                          >
                            {shortCaption(item.caption)}
                          </a>
                        ) : (
                          shortCaption(item.caption)
                        )}
                      </TableCell>

                      <TableCell>
                        {formatDate(item.published_at)}
                      </TableCell>

                      <TableCell className="text-right">
                        {new Intl.NumberFormat("en-GB").format(
                          views
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        {new Intl.NumberFormat("en-GB").format(
                          reachOrUnique
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        {new Intl.NumberFormat("en-GB").format(
                          engagement
                        )}
                      </TableCell>
                    </TableRow>
                  )
                )}
              </TableBody>
            </Table>
          </TableShell>
        )}
      </SectionCard>
    </div>
  );
}
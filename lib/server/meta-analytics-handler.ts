import type { NextRequest } from "next/server";
import {
  runMetaAnalyticsSync,
  type MetaAnalyticsSyncSummary,
} from "@/lib/meta/analytics-sync";

type RunMetaAnalyticsFn =
  () => Promise<MetaAnalyticsSyncSummary>;

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader =
    request.headers.get("authorization");

  return authHeader === `Bearer ${cronSecret}`;
}

export function createMetaAnalyticsHandler(
  run: RunMetaAnalyticsFn = runMetaAnalyticsSync
) {
  return async function handleMetaAnalytics(
    request: NextRequest
  ) {
    if (!isAuthorized(request)) {
      return Response.json(
        {
          ok: false,
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    try {
      const result = await run();

      return Response.json({
        ok: true,
        mode: "cron",
        result,
      });
    } catch {
      return Response.json(
        {
          ok: false,
          error: "Meta Analytics sync failed.",
        },
        {
          status: 500,
        }
      );
    }
  };
}
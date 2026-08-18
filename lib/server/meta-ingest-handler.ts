import type { NextRequest } from "next/server";
import { runMetaIngest, type IngestSummary } from "@/lib/messaging/ingest";
import { drainInboxNotifications } from "@/lib/messaging/notify";

type RunMetaIngestFn = () => Promise<IngestSummary>;

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

export function createMetaIngestHandler(run: RunMetaIngestFn = runMetaIngest) {
  return async function handleMetaIngest(request: NextRequest) {
    if (!isAuthorized(request)) {
      return Response.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const result = await run();

    let notifications = { claimed: 0, sent: 0, failed: 0 };
    try {
      notifications = await drainInboxNotifications();
    } catch {
      // Best-effort: a notification-drain failure must not fail the ingest run.
    }

    return Response.json({
      ok: true,
      mode: "cron",
      result,
      notifications,
    });
  };
}

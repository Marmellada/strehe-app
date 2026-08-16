import type { NextRequest } from "next/server";
import { runMetaIngest, type IngestSummary } from "@/lib/messaging/ingest";

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

    return Response.json({
      ok: true,
      mode: "cron",
      result,
    });
  };
}

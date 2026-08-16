import { createMetaWebhookHandlers } from "@/lib/meta/create-handlers";
import { persistMetaWebhookEvent } from "@/lib/meta/persist";
import { runMetaIngest } from "@/lib/messaging/ingest";

export const runtime = "nodejs";

function bestEffortIngest() {
  runMetaIngest().catch(() => {
    // Never throw from after(); the durable queue is the retry source.
  });
}

const handlers = createMetaWebhookHandlers(persistMetaWebhookEvent, {
  afterIngest: bestEffortIngest,
});

export const GET = handlers.GET;
export const POST = handlers.POST;

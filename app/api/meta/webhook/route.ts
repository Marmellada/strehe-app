import { createMetaWebhookHandlers } from "@/lib/meta/create-handlers";
import { persistMetaWebhookEvent } from "@/lib/meta/persist";

export const runtime = "nodejs";

const handlers = createMetaWebhookHandlers(persistMetaWebhookEvent);

export const GET = handlers.GET;
export const POST = handlers.POST;

import { getAdminClient } from "@/lib/supabase/admin";
import type { MetaWebhookChannel } from "@/lib/meta/schema";

export type MetaWebhookEventInsert = {
  channel: MetaWebhookChannel;
  objectType: string | null;
  eventType: string | null;
  payloadSha256: string;
  payload: unknown;
};

export async function persistMetaWebhookEvent(event: MetaWebhookEventInsert) {
  const result = await getAdminClient()
    .from("meta_webhook_events")
    .insert([
      {
        channel: event.channel,
        object_type: event.objectType,
        event_type: event.eventType,
        payload_sha256: event.payloadSha256,
        payload: event.payload,
      },
    ]);

  if (result.error) {
    throw new Error("Meta webhook persistence failed.");
  }
}

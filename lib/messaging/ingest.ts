// Messaging ingestion orchestrator. Claims queued raw events via the trusted
// SECURITY DEFINER RPC, normalizes them through the pure parser, resolves
// identities, and persists idempotently through SQL functions. No message text
// or identity values are logged on failure paths.

import { getAdminClient } from "@/lib/supabase/admin";
import { parseMetaWebhookEvent } from "./parser";
import { normalizeE164, phoneDigits } from "./normalize";
import type { NormalizedMessage, QueueOutcome } from "./types";

type ClaimedItem = {
  queue_id: string;
  webhook_event_id: string;
  channel: string;
  object_type: string;
  event_type: string;
  payload: unknown;
  received_at: string;
};

type IdentityRow = {
  id: string;
  lead_id: string | null;
  client_id: string | null;
  resolution_status: string;
};

type RpcResult<T> = { data: T | null; error: unknown };

type IngestMessageArgs = {
  p_conversation_id: string;
  p_channel: string;
  p_channel_account_id: string;
  p_external_message_id: string;
  p_direction: string;
  p_message_type: string;
  p_text_content: string | null;
  p_content: Record<string, unknown> | null;
  p_sender_external_id: string | null;
  p_recipient_external_id: string | null;
  p_source_webhook_event_id: string;
  p_occurred_at: string | null;
};

// Narrow structural contract for the RPCs the ingestion worker needs.
// The real service-role client satisfies this (cast at the call site).
export type IngestClient = {
  rpc(
    fn: "claim_meta_ingestion_batch",
    args: { limit_rows: number }
  ): Promise<RpcResult<ClaimedItem[]>>;
  rpc(
    fn: "meta_ingestion_mark_completed",
    args: { p_queue_id: string; p_outcome: string }
  ): Promise<RpcResult<null>>;
  rpc(
    fn: "meta_ingestion_mark_failure",
    args: { p_queue_id: string; p_error_class: string; p_error_step: string }
  ): Promise<RpcResult<null>>;
  rpc(
    fn: "upsert_contact_channel_identity",
    args: {
      p_channel: string;
      p_channel_account_id: string;
      p_external_id: string;
      p_display_name: string | null;
      p_phone_e164: string | null;
    }
  ): Promise<RpcResult<IdentityRow[]>>;
  rpc(
    fn: "resolve_contact_identity_whatsapp",
    args: { p_identity_id: string; p_phone_e164: string; p_phone_digits: string }
  ): Promise<RpcResult<string>>;
  rpc(
    fn: "ensure_conversation",
    args: { p_identity_id: string }
  ): Promise<RpcResult<string>>;
  rpc(
    fn: "ingest_conversation_message",
    args: IngestMessageArgs
  ): Promise<RpcResult<string>>;
};

export type IngestSummary = {
  claimed: number;
  message_created: number;
  duplicate: number;
  non_message: number;
  unsupported: number;
  synthetic_test: number;
  failed: number;
};

const DEFAULT_LIMIT = 10;

export function emptyIngestSummary(): IngestSummary {
  return {
    claimed: 0,
    message_created: 0,
    duplicate: 0,
    non_message: 0,
    unsupported: 0,
    synthetic_test: 0,
    failed: 0,
  };
}

export async function runMetaIngest(
  limit = DEFAULT_LIMIT,
  client?: IngestClient
): Promise<IngestSummary> {
  const supabase = client ?? (getAdminClient() as unknown as IngestClient);
  const summary = emptyIngestSummary();

  let batch: ClaimedItem[];
  try {
    const claim = await supabase.rpc("claim_meta_ingestion_batch", {
      limit_rows: limit,
    });
    if (claim.error || !claim.data || claim.data.length === 0) return summary;
    batch = claim.data;
  } catch {
    return summary;
  }

  for (const item of batch) {
    summary.claimed += 1;
    try {
      const outcome = await processEvent(supabase, item);
      await supabase.rpc("meta_ingestion_mark_completed", {
        p_queue_id: item.queue_id,
        p_outcome: outcome,
      });
      incrementOutcome(summary, outcome);
    } catch {
      await supabase.rpc("meta_ingestion_mark_failure", {
        p_queue_id: item.queue_id,
        p_error_class: "ingestion_error",
        p_error_step: "ingest",
      });
      summary.failed += 1;
    }
  }

  return summary;
}

function incrementOutcome(summary: IngestSummary, outcome: QueueOutcome) {
  if (outcome === "message_created") summary.message_created += 1;
  else if (outcome === "duplicate") summary.duplicate += 1;
  else if (outcome === "non_message") summary.non_message += 1;
  else if (outcome === "unsupported") summary.unsupported += 1;
  else if (outcome === "synthetic_test") summary.synthetic_test += 1;
}

async function processEvent(
  supabase: IngestClient,
  item: ClaimedItem
): Promise<QueueOutcome> {
  const parsed = parseMetaWebhookEvent(item.payload);

  if (parsed.kind === "synthetic_test") return "synthetic_test";
  if (parsed.kind === "non_message") return "non_message";
  if (parsed.kind === "unsupported") return "unsupported";

  let createdAny = false;
  let duplicateAny = false;

  for (const message of parsed.messages) {
    const result = await ingestMessage(supabase, item.webhook_event_id, message);
    if (result === "message_created") createdAny = true;
    else duplicateAny = true;
  }

  if (createdAny) return "message_created";
  if (duplicateAny) return "duplicate";
  return "non_message";
}

async function ingestMessage(
  supabase: IngestClient,
  sourceWebhookEventId: string,
  message: NormalizedMessage
): Promise<"message_created" | "duplicate"> {
  const senderExternalId = message.sender_external_id ?? "";
  const phoneE164 =
    message.channel === "whatsapp" ? normalizeE164(senderExternalId) : null;

  const identityResult = await supabase.rpc("upsert_contact_channel_identity", {
    p_channel: message.channel,
    p_channel_account_id: message.channel_account_id ?? "",
    p_external_id: senderExternalId,
    p_display_name: null,
    p_phone_e164: phoneE164,
  });
  if (identityResult.error) throw new Error("identity_upsert_failed");

  const identity = identityResult.data?.[0];
  if (!identity) throw new Error("identity_missing");

  if (
    message.channel === "whatsapp" &&
    identity.resolution_status === "unresolved" &&
    phoneE164
  ) {
    await supabase.rpc("resolve_contact_identity_whatsapp", {
      p_identity_id: identity.id,
      p_phone_e164: phoneE164,
      p_phone_digits: phoneDigits(phoneE164) ?? "",
    });
  }

  const conversationResult = await supabase.rpc("ensure_conversation", {
    p_identity_id: identity.id,
  });
  if (conversationResult.error || !conversationResult.data) {
    throw new Error("conversation_ensure_failed");
  }

  const messageResult = await supabase.rpc("ingest_conversation_message", {
    p_conversation_id: conversationResult.data,
    p_channel: message.channel,
    p_channel_account_id: message.channel_account_id ?? "",
    p_external_message_id: message.external_message_id,
    p_direction: message.direction,
    p_message_type: message.message_type,
    p_text_content: message.text_content,
    p_content: message.content,
    p_sender_external_id: message.sender_external_id,
    p_recipient_external_id: message.recipient_external_id,
    p_source_webhook_event_id: sourceWebhookEventId,
    p_occurred_at: message.occurred_at,
  });
  if (messageResult.error) throw new Error("message_ingest_failed");

  return messageResult.data === "message_created" ? "message_created" : "duplicate";
}

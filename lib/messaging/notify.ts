// Inbox notification worker: enqueue + drain. Best-effort and fully decoupled
// from messaging ingestion. No notification content or recipient email is
// logged or returned; summaries are aggregate counts only.

import { getAdminClient } from "@/lib/supabase/admin";
import { getCompanyProfile } from "@/lib/marketing/company-profile";
import { sendInboxNotificationEmail } from "@/lib/email/inbox-notification-email";
import type { MessagingChannel, MessageType } from "@/lib/messaging/types";

export type EnqueueNotificationInput = {
  conversationId: string;
  channel: MessagingChannel;
  messageType: MessageType;
  textContent: string | null;
  occurredAt: string | null;
};

export type EnqueueNotificationOutcome = "queued" | "suppressed" | "failed";

export type NotificationRow = {
  id: string;
  conversation_id: string;
  channel: MessagingChannel;
  identity_label: string;
  message_type: string;
  text_preview: string | null;
  occurred_at: string | null;
};

export type NotifyDrainSummary = {
  claimed: number;
  sent: number;
  failed: number;
};

type RpcResult<T> = { data: T | null; error: unknown };

export type NotifyEnqueueClient = {
  rpc(
    fn: "enqueue_inbox_notification",
    args: {
      p_conversation_id: string;
      p_channel: string;
      p_message_type: string;
      p_text_content: string | null;
      p_occurred_at: string | null;
    }
  ): Promise<RpcResult<string>>;
};

export type NotifyDrainClient = {
  rpc(
    fn: "claim_inbox_notification_batch",
    args: { p_limit: number }
  ): Promise<RpcResult<NotificationRow[]>>;
  rpc(
    fn: "inbox_notification_mark_sent",
    args: { p_id: string }
  ): Promise<RpcResult<null>>;
  rpc(
    fn: "inbox_notification_mark_failure",
    args: { p_id: string; p_error_class: string }
  ): Promise<RpcResult<null>>;
};

const DRAIN_LIMIT = 20;

export async function enqueueInboxNotification(
  client: NotifyEnqueueClient,
  input: EnqueueNotificationInput
): Promise<EnqueueNotificationOutcome> {
  try {
    const result = await client.rpc("enqueue_inbox_notification", {
      p_conversation_id: input.conversationId,
      p_channel: input.channel,
      p_message_type: input.messageType,
      p_text_content: input.textContent,
      p_occurred_at: input.occurredAt,
    });
    if (result.error || !result.data) return "failed";
    return result.data === "queued" ? "queued" : "suppressed";
  } catch {
    return "failed";
  }
}

export async function drainInboxNotifications(
  client?: NotifyDrainClient
): Promise<NotifyDrainSummary> {
  const summary: NotifyDrainSummary = { claimed: 0, sent: 0, failed: 0 };

  let supabase: NotifyDrainClient;
  try {
    supabase = client ?? (getAdminClient() as unknown as NotifyDrainClient);
  } catch {
    return summary;
  }

  let batch: NotificationRow[];
  try {
    const claim = await supabase.rpc("claim_inbox_notification_batch", {
      p_limit: DRAIN_LIMIT,
    });
    if (claim.error || !claim.data || claim.data.length === 0) return summary;
    batch = claim.data;
  } catch {
    return summary;
  }

  let recipient: string;
  try {
    recipient = (await getCompanyProfile()).email;
  } catch {
    recipient = "info@streheprona.com";
  }

  for (const row of batch) {
    summary.claimed += 1;
    try {
      const result = await sendInboxNotificationEmail({
        notificationId: row.id,
        conversationId: row.conversation_id,
        channel: row.channel,
        identityLabel: row.identity_label,
        messageType: row.message_type,
        textPreview: row.text_preview,
        occurredAt: row.occurred_at,
        to: recipient,
      });

      if (result.ok) {
        await supabase.rpc("inbox_notification_mark_sent", { p_id: row.id });
        summary.sent += 1;
      } else {
        await supabase.rpc("inbox_notification_mark_failure", {
          p_id: row.id,
          p_error_class: `email_${result.reason}`,
        });
        summary.failed += 1;
      }
    } catch {
      try {
        await supabase.rpc("inbox_notification_mark_failure", {
          p_id: row.id,
          p_error_class: "send_error",
        });
      } catch {
        // Ignore: the lease will expire and the row will be re-claimed later.
      }
      summary.failed += 1;
    }
  }

  return summary;
}

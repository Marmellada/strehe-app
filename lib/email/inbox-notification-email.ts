import { z } from "zod";
import type { MessagingChannel } from "@/lib/messaging/types";

type InboxNotificationEmailInput = {
  notificationId: string;
  conversationId: string;
  channel: MessagingChannel;
  identityLabel: string;
  messageType: string;
  textPreview: string | null;
  occurredAt: string | null;
};

export type InboxNotificationEmailResult =
  | { ok: true; providerMessageId: string | null }
  | {
      ok: false;
      reason:
        | "missing_api_key"
        | "invalid_from_address"
        | "invalid_recipient"
        | "provider_rejected"
        | "provider_unavailable";
    };

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function extractAddress(value: string) {
  const friendlyAddress = value.match(/<([^<>]+)>\s*$/);
  return (friendlyAddress?.[1] || value).trim();
}

function isEmailAddress(value: string) {
  return z.email().safeParse(extractAddress(value)).success;
}

function formatTimestamp(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Warsaw",
  });
}

function getAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000"
  );
}

function channelLabel(channel: MessagingChannel) {
  if (channel === "whatsapp") return "WhatsApp";
  if (channel === "instagram") return "Instagram";
  return "Messenger";
}

function messageTypeLabel(messageType: string) {
  const labels: Record<string, string> = {
    text: "Message",
    image: "Image",
    audio: "Audio",
    video: "Video",
    document: "Document",
    reaction: "Reaction",
    unknown: "Message",
  };
  return labels[messageType] ?? "Message";
}

export function buildInboxNotificationEmail(input: InboxNotificationEmailInput) {
  const channel = channelLabel(input.channel);
  const subject = `STREHË Inbox — New ${channel} message`;
  const preview =
    input.textPreview?.trim() || messageTypeLabel(input.messageType);
  const link = `${getAppUrl()}/operator/inbox/${input.conversationId}`;

  const details: Array<[string, string]> = [
    ["Channel", channel],
    ["Contact", input.identityLabel],
    ["Message", preview],
    ["Received", formatTimestamp(input.occurredAt)],
  ];

  const text = [
    "A new customer message needs your attention in the STREHË Inbox.",
    "",
    ...details.map(([label, value]) => `${label}: ${value}`),
    "",
    `Open conversation: ${link}`,
  ].join("\n");

  const rows = details
    .map(
      ([label, value]) =>
        `<tr><th align="left" style="padding:6px 12px 6px 0;vertical-align:top;">${escapeHtml(label)}</th><td style="padding:6px 0;">${escapeHtml(value)}</td></tr>`
    )
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;color:#1f2933;line-height:1.5;">
      <p>A new customer message needs your attention in the STREHË Inbox.</p>
      <table style="border-collapse:collapse;">${rows}</table>
      <p style="margin:24px 0 8px;">
        <a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 18px;background:#1f2933;color:#ffffff;border-radius:6px;text-decoration:none;">Open conversation</a>
      </p>
    </div>
  `;

  return { subject, text, html };
}

export async function sendInboxNotificationEmail(
  input: InboxNotificationEmailInput & { to: string }
): Promise<InboxNotificationEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.PROMOTION_EMAIL_FROM || process.env.RESEND_FROM_EMAIL;

  if (!apiKey?.trim()) {
    return { ok: false, reason: "missing_api_key" };
  }
  if (!from?.trim() || !isEmailAddress(from)) {
    return { ok: false, reason: "invalid_from_address" };
  }
  if (!isEmailAddress(input.to)) {
    return { ok: false, reason: "invalid_recipient" };
  }

  const email = buildInboxNotificationEmail(input);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `inbox-notify/${input.notificationId}`,
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { id?: string }
      | null;

    if (!response.ok) {
      return { ok: false, reason: "provider_rejected" };
    }
    return { ok: true, providerMessageId: payload?.id || null };
  } catch {
    return { ok: false, reason: "provider_unavailable" };
  }
}

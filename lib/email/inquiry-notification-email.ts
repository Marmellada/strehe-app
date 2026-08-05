import { z } from "zod";
import type { PublicInquiryNotification } from "@/lib/security/public-contact";

type InquiryNotificationEmailInput = PublicInquiryNotification & {
  to: string;
};

export type InquiryNotificationEmailResult =
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

type InquiryNotificationEmailDependencies = {
  fetch: typeof fetch;
  getConfig: () => {
    apiKey: string | undefined;
    from: string | undefined;
  };
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

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Warsaw",
  });
}

function buildInquiryNotificationEmail(input: InquiryNotificationEmailInput) {
  const attribution = [
    ["First-touch source", input.source],
    ["Source detail", input.sourceDetail],
    ["Campaign name", input.campaignName],
    ["UTM source", input.utmSource],
    ["UTM medium", input.utmMedium],
    ["UTM campaign", input.utmCampaign],
    ["UTM content", input.utmContent],
    ["UTM term", input.utmTerm],
    ["Click ID", input.clickId],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  const details: Array<[string, string]> = [
    ["Inquiry ID", input.inquiryId],
    ["Customer name", input.customerName],
    ...(input.email ? [["Email", input.email] as [string, string]] : []),
    ...(input.phone ? [["Phone", input.phone] as [string, string]] : []),
    ["Language / locale", input.locale],
    ...attribution,
    ["Submitted at", formatTimestamp(input.submittedAt)],
  ];
  const message = input.message || "(No message supplied)";
  const subject = `New website inquiry: ${input.customerName}`;
  const text = [
    "A new website inquiry was saved successfully.",
    "",
    ...details.map(([label, value]) => `${label}: ${value}`),
    "",
    "Message:",
    message,
  ].join("\n");
  const rows = details
    .map(
      ([label, value]) =>
        `<tr><th align="left" style="padding:6px 12px 6px 0;vertical-align:top;">${escapeHtml(label)}</th><td style="padding:6px 0;">${escapeHtml(value)}</td></tr>`
    )
    .join("");
  const html = `
    <div style="font-family:Arial,sans-serif;color:#1f2933;line-height:1.5;">
      <p>A new website inquiry was saved successfully.</p>
      <table style="border-collapse:collapse;">${rows}</table>
      <h2 style="font-size:16px;margin:24px 0 8px;">Message</h2>
      <div style="white-space:pre-wrap;">${escapeHtml(message)}</div>
    </div>
  `;

  return { subject, text, html };
}

export function createInquiryNotificationEmailSender(
  dependencies: InquiryNotificationEmailDependencies = {
    fetch: globalThis.fetch,
    getConfig: () => ({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.PROMOTION_EMAIL_FROM || process.env.RESEND_FROM_EMAIL,
    }),
  }
) {
  return async function sendInquiryNotificationEmail(
    input: InquiryNotificationEmailInput
  ): Promise<InquiryNotificationEmailResult> {
    const config = dependencies.getConfig();
    if (!config.apiKey?.trim()) {
      return { ok: false, reason: "missing_api_key" };
    }
    if (!config.from?.trim() || !isEmailAddress(config.from)) {
      return { ok: false, reason: "invalid_from_address" };
    }
    if (!isEmailAddress(input.to)) {
      return { ok: false, reason: "invalid_recipient" };
    }

    const email = buildInquiryNotificationEmail(input);
    try {
      const response = await dependencies.fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `public-inquiry/${input.inquiryId}`,
        },
        body: JSON.stringify({
          from: config.from,
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
  };
}

export const sendInquiryNotificationEmail =
  createInquiryNotificationEmailSender();

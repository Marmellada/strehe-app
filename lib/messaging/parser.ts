// Pure parser/normalizer for Meta webhook payloads into normalized messages.
// No database access. Conservative: only plain text is normalized in V1;
// media/reaction/unsupported shapes are classified, never invented.

import type {
  NormalizedMessage,
  ParseResult,
} from "./types";

// Known Meta synthetic test placeholder (observed in production test events).
const SYNTHETIC_MESSAGE_IDS = new Set(["random_mid"]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isEcho(value: unknown): boolean {
  return value === true || value === "true";
}

// WhatsApp timestamps are Unix seconds; Instagram/Messenger are Unix
// milliseconds. Normalize either to an ISO-8601 string.
function toIso(ts: unknown): string | null {
  const raw = typeof ts === "string" ? ts : typeof ts === "number" ? String(ts) : null;
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  const ms = n < 1e12 ? n * 1000 : n;
  return new Date(ms).toISOString();
}

function isSyntheticMessageId(id: string | null): boolean {
  return id !== null && SYNTHETIC_MESSAGE_IDS.has(id);
}

// ---------- WhatsApp ----------

function parseWhatsApp(entries: unknown[]): ParseResult {
  const messages: NormalizedMessage[] = [];
  let sawStatusOnly = false;
  let sawNonTextMessage = false;
  let sawSynthetic = false;

  for (const entry of entries) {
    const entryRecord = asRecord(entry);
    const channelAccountId = str(entryRecord?.id);

    for (const change of asArray(entryRecord?.changes)) {
      const changeRecord = asRecord(change);
      if (changeRecord?.field !== "messages") continue;

      const value = asRecord(changeRecord.value);
      const inboundMessages = asArray(value?.messages);

      for (const rawMessage of inboundMessages) {
        const message = asRecord(rawMessage);
        const messageId = str(message?.id);
        const type = str(message?.type);
        const textBody = str(asRecord(message?.text)?.body);
        const from = str(message?.from);

        if (isSyntheticMessageId(messageId)) {
          sawSynthetic = true;
          continue;
        }

        if (type === "text") {
          messages.push({
            channel: "whatsapp",
            channel_account_id: channelAccountId,
            external_message_id: messageId ?? "",
            direction: "inbound",
            message_type: "text",
            text_content: textBody,
            content: null,
            sender_external_id: from,
            recipient_external_id: null,
            occurred_at: toIso(message?.timestamp),
          });
        } else {
          sawNonTextMessage = true;
        }
      }

      if (asArray(value?.statuses).length > 0 && inboundMessages.length === 0) {
        sawStatusOnly = true;
      }
    }
  }

  if (sawSynthetic && messages.length === 0) {
    return { kind: "synthetic_test" };
  }

  if (messages.length > 0) {
    return { kind: "messages", messages };
  }

  if (sawNonTextMessage) {
    return { kind: "unsupported" };
  }

  if (sawStatusOnly) {
    return { kind: "non_message" };
  }

  return { kind: "unsupported" };
}

// ---------- Instagram ----------

function parseInstagramMessaging(entries: unknown[]): ParseResult {
  const messages: NormalizedMessage[] = [];
  let sawNonText = false;
  let sawSynthetic = false;

  for (const entry of entries) {
    const entryRecord = asRecord(entry);
    const channelAccountId = str(entryRecord?.id);

    for (const rawEvent of asArray(entryRecord?.messaging)) {
      const event = asRecord(rawEvent);
      const message = asRecord(event?.message);
      const mid = str(message?.mid);
      const text = str(message?.text);
      const sender = str(asRecord(event?.sender)?.id);
      const recipient = str(asRecord(event?.recipient)?.id);

      if (isSyntheticMessageId(mid)) {
        sawSynthetic = true;
        continue;
      }

      if (text !== null) {
        messages.push({
          channel: "instagram",
          channel_account_id: channelAccountId,
          external_message_id: mid ?? "",
          direction: isEcho(message?.is_echo) ? "outbound" : "inbound",
          message_type: "text",
          text_content: text,
          content: null,
          sender_external_id: sender,
          recipient_external_id: recipient,
          occurred_at: toIso(event?.timestamp),
        });
      } else {
        sawNonText = true;
      }
    }
  }

  if (sawSynthetic && messages.length === 0) return { kind: "synthetic_test" };
  if (messages.length > 0) return { kind: "messages", messages };
  if (sawNonText) return { kind: "unsupported" };
  return { kind: "unsupported" };
}

function parseInstagramChanges(entries: unknown[]): ParseResult {
  const messages: NormalizedMessage[] = [];
  let sawNonText = false;
  let sawSynthetic = false;

  for (const entry of entries) {
    const entryRecord = asRecord(entry);
    const channelAccountId = str(entryRecord?.id);

    for (const change of asArray(entryRecord?.changes)) {
      const changeRecord = asRecord(change);
      if (changeRecord?.field !== "messages") continue;

      const value = asRecord(changeRecord.value);
      const message = asRecord(value?.message);
      const mid = str(message?.mid);
      const text = str(message?.text);
      const sender = str(asRecord(value?.sender)?.id);
      const recipient = str(asRecord(value?.recipient)?.id);

      if (isSyntheticMessageId(mid)) {
        sawSynthetic = true;
        continue;
      }

      if (text !== null) {
        messages.push({
          channel: "instagram",
          channel_account_id: channelAccountId,
          external_message_id: mid ?? "",
          direction: "inbound",
          message_type: "text",
          text_content: text,
          content: null,
          sender_external_id: sender,
          recipient_external_id: recipient,
          occurred_at: toIso(value?.timestamp),
        });
      } else {
        sawNonText = true;
      }
    }
  }

  if (sawSynthetic && messages.length === 0) return { kind: "synthetic_test" };
  if (messages.length > 0) return { kind: "messages", messages };
  if (sawNonText) return { kind: "unsupported" };
  return { kind: "unsupported" };
}

function parseInstagram(entries: unknown[]): ParseResult {
  // Two observed Instagram shapes: entry[].messaging[] and entry[].changes[].
  const hasMessaging = entries.some((e) => asArray(asRecord(e)?.messaging).length > 0);
  const hasMessagesField = entries.some((e) =>
    asArray(asRecord(e)?.changes).some((c) => asRecord(c)?.field === "messages")
  );

  if (hasMessaging) return parseInstagramMessaging(entries);
  if (hasMessagesField) return parseInstagramChanges(entries);
  return { kind: "unsupported" };
}

// ---------- Facebook Messenger ----------

function parsePage(entries: unknown[]): ParseResult {
  const messages: NormalizedMessage[] = [];
  let sawNonText = false;
  let sawSynthetic = false;

  for (const entry of entries) {
    const entryRecord = asRecord(entry);
    const channelAccountId = str(entryRecord?.id);

    for (const rawEvent of asArray(entryRecord?.messaging)) {
      const event = asRecord(rawEvent);
      const message = asRecord(event?.message);
      const mid = str(message?.mid);
      const text = str(message?.text);
      const sender = str(asRecord(event?.sender)?.id);
      const recipient = str(asRecord(event?.recipient)?.id);

      if (isSyntheticMessageId(mid)) {
        sawSynthetic = true;
        continue;
      }

      if (text !== null) {
        messages.push({
          channel: "messenger",
          channel_account_id: channelAccountId,
          external_message_id: mid ?? "",
          direction: isEcho(message?.is_echo) ? "outbound" : "inbound",
          message_type: "text",
          text_content: text,
          content: null,
          sender_external_id: sender,
          recipient_external_id: recipient,
          occurred_at: toIso(event?.timestamp),
        });
      } else {
        sawNonText = true;
      }
    }
  }

  if (sawSynthetic && messages.length === 0) return { kind: "synthetic_test" };
  if (messages.length > 0) return { kind: "messages", messages };
  if (sawNonText) return { kind: "unsupported" };
  // A page event with no messaging[] is a generic non-messaging Facebook event.
  return { kind: "unsupported" };
}

// ---------- Dispatch ----------

export function parseMetaWebhookEvent(payload: unknown): ParseResult {
  const record = asRecord(payload);
  const objectType = str(record?.object);
  const entries = asArray(record?.entry);

  if (objectType === "whatsapp_business_account") return parseWhatsApp(entries);
  if (objectType === "instagram") return parseInstagram(entries);
  if (objectType === "page") return parsePage(entries);

  return { kind: "unsupported" };
}

export type MetaWebhookChannel =
  | "facebook"
  | "messenger"
  | "instagram"
  | "whatsapp"
  | "unknown";

export type MetaWebhookMetadata = {
  channel: MetaWebhookChannel;
  objectType: string | null;
  eventType: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function entriesFrom(payload: Record<string, unknown> | null) {
  return Array.isArray(payload?.entry) ? payload.entry : [];
}

function hasMessagingEntries(payload: Record<string, unknown> | null) {
  return entriesFrom(payload).some((entry) => {
    const record = asRecord(entry);
    return Array.isArray(record?.messaging);
  });
}

function deriveEventType(payload: Record<string, unknown> | null) {
  const types = new Set<string>();

  for (const entry of entriesFrom(payload)) {
    const entryRecord = asRecord(entry);
    const changes = Array.isArray(entryRecord?.changes)
      ? entryRecord.changes
      : [];
    for (const change of changes) {
      const field = asRecord(change)?.field;
      if (typeof field === "string" && field) types.add(field);
    }

    const messaging = Array.isArray(entryRecord?.messaging)
      ? entryRecord.messaging
      : [];
    for (const event of messaging) {
      const eventRecord = asRecord(event);
      if (!eventRecord) continue;
      for (const candidate of [
        "message",
        "postback",
        "delivery",
        "read",
        "reaction",
        "referral",
        "optin",
      ]) {
        if (candidate in eventRecord) types.add(candidate);
      }
    }
  }

  if (types.size === 0) return null;
  if (types.size === 1) return [...types][0];
  return "mixed";
}

export function deriveMetaWebhookMetadata(
  payload: unknown
): MetaWebhookMetadata {
  const record = asRecord(payload);
  const objectType = typeof record?.object === "string" ? record.object : null;

  let channel: MetaWebhookChannel = "unknown";
  if (objectType === "whatsapp_business_account") channel = "whatsapp";
  else if (objectType === "instagram") channel = "instagram";
  else if (objectType === "page") {
    channel = hasMessagingEntries(record) ? "messenger" : "facebook";
  }

  return {
    channel,
    objectType,
    eventType: deriveEventType(record),
  };
}

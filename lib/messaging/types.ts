export type MessagingChannel = "whatsapp" | "instagram" | "messenger";

export type MessageDirection = "inbound" | "outbound";

export type MessageType =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "document"
  | "reaction"
  | "unknown";

export type NormalizedMessage = {
  channel: MessagingChannel;
  channel_account_id: string | null;
  external_message_id: string;
  direction: MessageDirection;
  message_type: MessageType;
  text_content: string | null;
  content: Record<string, unknown> | null;
  sender_external_id: string | null;
  recipient_external_id: string | null;
  occurred_at: string | null;
};

export type ParseResult =
  | { kind: "messages"; messages: NormalizedMessage[] }
  | { kind: "synthetic_test" }
  | { kind: "non_message" }
  | { kind: "unsupported" };

export type QueueOutcome =
  | "message_created"
  | "duplicate"
  | "non_message"
  | "unsupported"
  | "synthetic_test";

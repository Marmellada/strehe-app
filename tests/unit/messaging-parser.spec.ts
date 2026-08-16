import { expect, test } from "@playwright/test";
import { parseMetaWebhookEvent } from "@/lib/messaging/parser";

// Sanitized fixtures modeled on the three real production payload shapes.
// No real customer PII, phone numbers, or message IDs are present.

const whatsAppText = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "waba_100",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { display_phone_number: "15550001234", phone_number_id: "900" },
            contacts: [{ profile: { name: "Example" }, wa_id: "38344111222" }],
            messages: [
              {
                from: "38344111222",
                id: "wamid.example.aaa",
                timestamp: "1784143899",
                type: "text",
                text: { body: "hello there" },
              },
            ],
          },
        },
      ],
    },
  ],
};

const whatsAppMultipleMessages = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "waba_100",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: {},
            contacts: [],
            messages: [
              {
                from: "38344111222",
                id: "wamid.example.one",
                timestamp: "1784143900",
                type: "text",
                text: { body: "first" },
              },
              {
                from: "38344111222",
                id: "wamid.example.two",
                timestamp: "1784143901",
                type: "text",
                text: { body: "second" },
              },
            ],
          },
        },
      ],
    },
  ],
};

const whatsAppStatusOnly = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "waba_100",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: {},
            contacts: [],
            statuses: [
              { id: "wamid.status.1", status: "delivered", timestamp: "1784143900" },
            ],
          },
        },
      ],
    },
  ],
};

const whatsAppImageOnly = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "waba_100",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: {},
            contacts: [],
            messages: [
              {
                from: "38344111222",
                id: "wamid.example.img",
                timestamp: "1784143900",
                type: "image",
                image: { caption: "a photo", mime_type: "image/jpeg" },
              },
            ],
          },
        },
      ],
    },
  ],
};

const instagramMessagingText = {
  object: "instagram",
  entry: [
    {
      id: "ig_account_1",
      time: 1784143899110,
      messaging: [
        {
          sender: { id: "igsid_1" },
          recipient: { id: "ig_account_1" },
          timestamp: 1784143899110,
          message: { mid: "ig_mid_text_1", text: "hello" },
        },
      ],
    },
  ],
};

const instagramMessagingEcho = {
  object: "instagram",
  entry: [
    {
      id: "ig_account_1",
      time: 1784143899110,
      messaging: [
        {
          sender: { id: "ig_account_1" },
          recipient: { id: "igsid_1" },
          timestamp: 1784143899110,
          message: { mid: "ig_mid_echo_1", text: "auto reply", is_echo: true },
        },
      ],
    },
  ],
};

const instagramChangesMessages = {
  object: "instagram",
  entry: [
    {
      id: "ig_account_1",
      time: 1784143899110,
      changes: [
        {
          field: "messages",
          value: {
            sender: { id: "igsid_1" },
            recipient: { id: "ig_account_1" },
            timestamp: 1784143899110,
            message: { mid: "ig_mid_changes_1", text: "hi" },
          },
        },
      ],
    },
  ],
};

const instagramSynthetic = {
  object: "instagram",
  entry: [
    {
      id: "ig_account_1",
      time: 1784143899110,
      messaging: [
        {
          sender: { id: "12334" },
          recipient: { id: "ig_account_1" },
          timestamp: 1784143899110,
          message: { mid: "random_mid", text: "test" },
        },
      ],
    },
  ],
};

const messengerText = {
  object: "page",
  entry: [
    {
      id: "page_1",
      time: 1784143899110,
      messaging: [
        {
          sender: { id: "psid_1" },
          recipient: { id: "page_1" },
          timestamp: 1784143899110,
          message: { mid: "m_test_1", text: "hi from messenger" },
        },
      ],
    },
  ],
};

const genericPageEvent = {
  object: "page",
  entry: [{ id: "page_1", time: 1784143899, changes: [{ field: "feed", value: {} }] }],
};

test.describe("Meta webhook parser", () => {
  test("normalizes a WhatsApp inbound text message", () => {
    const result = parseMetaWebhookEvent(whatsAppText);
    expect(result.kind).toBe("messages");
    if (result.kind !== "messages") return;

    expect(result.messages).toHaveLength(1);
    const m = result.messages[0];
    expect(m.channel).toBe("whatsapp");
    expect(m.channel_account_id).toBe("waba_100");
    expect(m.external_message_id).toBe("wamid.example.aaa");
    expect(m.direction).toBe("inbound");
    expect(m.text_content).toBe("hello there");
    expect(m.sender_external_id).toBe("38344111222");
    expect(m.occurred_at).toContain("2026");
  });

  test("normalizes multiple WhatsApp messages in one event", () => {
    const result = parseMetaWebhookEvent(whatsAppMultipleMessages);
    expect(result.kind).toBe("messages");
    if (result.kind !== "messages") return;
    expect(result.messages).toHaveLength(2);
    expect(result.messages.map((m) => m.external_message_id)).toEqual([
      "wamid.example.one",
      "wamid.example.two",
    ]);
  });

  test("classifies a WhatsApp status-only event as non_message", () => {
    expect(parseMetaWebhookEvent(whatsAppStatusOnly)).toEqual({ kind: "non_message" });
  });

  test("classifies a WhatsApp media-only event as unsupported", () => {
    expect(parseMetaWebhookEvent(whatsAppImageOnly)).toEqual({ kind: "unsupported" });
  });

  test("normalizes an Instagram messaging[] inbound text message", () => {
    const result = parseMetaWebhookEvent(instagramMessagingText);
    expect(result.kind).toBe("messages");
    if (result.kind !== "messages") return;
    const m = result.messages[0];
    expect(m.channel).toBe("instagram");
    expect(m.external_message_id).toBe("ig_mid_text_1");
    expect(m.direction).toBe("inbound");
    expect(m.text_content).toBe("hello");
    expect(m.sender_external_id).toBe("igsid_1");
  });

  test("treats an Instagram is_echo message as outbound", () => {
    const result = parseMetaWebhookEvent(instagramMessagingEcho);
    expect(result.kind).toBe("messages");
    if (result.kind !== "messages") return;
    expect(result.messages[0].direction).toBe("outbound");
  });

  test("normalizes an Instagram changes[field=messages] message", () => {
    const result = parseMetaWebhookEvent(instagramChangesMessages);
    expect(result.kind).toBe("messages");
    if (result.kind !== "messages") return;
    const m = result.messages[0];
    expect(m.channel).toBe("instagram");
    expect(m.external_message_id).toBe("ig_mid_changes_1");
    expect(m.direction).toBe("inbound");
    expect(m.sender_external_id).toBe("igsid_1");
  });

  test("classifies a synthetic random_mid test event", () => {
    expect(parseMetaWebhookEvent(instagramSynthetic)).toEqual({ kind: "synthetic_test" });
  });

  test("normalizes a Messenger page messaging[] text message", () => {
    const result = parseMetaWebhookEvent(messengerText);
    expect(result.kind).toBe("messages");
    if (result.kind !== "messages") return;
    const m = result.messages[0];
    expect(m.channel).toBe("messenger");
    expect(m.external_message_id).toBe("m_test_1");
    expect(m.direction).toBe("inbound");
    expect(m.text_content).toBe("hi from messenger");
    expect(m.sender_external_id).toBe("psid_1");
  });

  test("does not confuse a generic Page feed event with Messenger", () => {
    expect(parseMetaWebhookEvent(genericPageEvent)).toEqual({ kind: "unsupported" });
  });

  test("classifies unknown objects and malformed payloads as unsupported", () => {
    expect(parseMetaWebhookEvent({ object: "future_object", entry: [] })).toEqual({
      kind: "unsupported",
    });
    expect(parseMetaWebhookEvent(null)).toEqual({ kind: "unsupported" });
    expect(parseMetaWebhookEvent("not an object")).toEqual({ kind: "unsupported" });
  });
});

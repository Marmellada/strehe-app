import { expect, test } from "@playwright/test";
import { buildInboxNotificationEmail } from "@/lib/email/inbox-notification-email";

test.describe("inbox notification email builder", () => {
  const base = {
    notificationId: "n1",
    conversationId: "conv-1",
    occurredAt: null as string | null,
  };

  test("uses a channel-specific subject", () => {
    const email = buildInboxNotificationEmail({
      ...base,
      channel: "whatsapp",
      identityLabel: "Besnik",
      messageType: "text",
      textPreview: "Hello there",
    });
    expect(email.subject).toBe("STREHË Inbox — New WhatsApp message");
  });

  test("falls back to a message-type label for non-text", () => {
    const email = buildInboxNotificationEmail({
      ...base,
      channel: "instagram",
      identityLabel: "Ana",
      messageType: "image",
      textPreview: null,
    });
    expect(email.text).toContain("Message: Image");
  });

  test("builds a direct conversation link", () => {
    const email = buildInboxNotificationEmail({
      ...base,
      conversationId: "abc-123",
      channel: "messenger",
      identityLabel: "Unknown contact",
      messageType: "text",
      textPreview: "hi",
    });
    expect(email.text).toContain("/operator/inbox/abc-123");
  });

  test("escapes HTML in labels and preview", () => {
    const email = buildInboxNotificationEmail({
      ...base,
      channel: "whatsapp",
      identityLabel: "<script>",
      messageType: "text",
      textPreview: "<b>hi</b>",
    });
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("&lt;b&gt;hi&lt;/b&gt;");
  });
});

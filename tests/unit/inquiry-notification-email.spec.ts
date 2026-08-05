import { expect, test } from "@playwright/test";
import { createInquiryNotificationEmailSender } from "@/lib/email/inquiry-notification-email";

const notification = {
  inquiryId: "b1d6984f-00d9-4d2d-9580-0dc20f734191",
  customerName: "Ada <Example>",
  email: "ada@example.com",
  phone: null,
  message: "Please inspect <the apartment>.",
  locale: "en" as const,
  source: "website" as const,
  sourceDetail: "instagram_profile",
  campaignName: "strehe_meta_diaspora_founders_202608",
  utmSource: "meta",
  utmMedium: "paid_social",
  utmCampaign: "strehe_meta_diaspora_founders_202608",
  utmContent: null,
  utmTerm: null,
  clickId: null,
  submittedAt: "2026-07-23T12:00:00.000Z",
  to: "info@streheprona.com",
};

function createFetchHarness(response = new Response(JSON.stringify({ id: "email-1" }))) {
  const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fetchMock = (async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), init });
    return response;
  }) as typeof fetch;
  return { fetchMock, requests };
}

test.describe("inquiry notification email", () => {
  test("sends only to the supplied business recipient with an inquiry idempotency key", async () => {
    const harness = createFetchHarness();
    const send = createInquiryNotificationEmailSender({
      fetch: harness.fetchMock,
      getConfig: () => ({
        apiKey: "test-api-key",
        from: "STREHË <notifications@streheprona.com>",
      }),
    });

    const result = await send(notification);

    expect(result).toEqual({ ok: true, providerMessageId: "email-1" });
    expect(harness.requests).toHaveLength(1);
    expect(harness.requests[0].url).toBe("https://api.resend.com/emails");
    expect(harness.requests[0].init?.headers).toMatchObject({
      "Idempotency-Key": `public-inquiry/${notification.inquiryId}`,
    });
    const body = JSON.parse(String(harness.requests[0].init?.body));
    expect(body.to).toBe("info@streheprona.com");
    expect(body).not.toHaveProperty("cc");
    expect(body).not.toHaveProperty("bcc");
    expect(body.text).toContain(notification.inquiryId);
    expect(body.text).toContain(notification.message);
    expect(body.text).toContain(notification.utmCampaign);
    expect(body.html).toContain("Ada &lt;Example&gt;");
    expect(body.html).not.toContain("Ada <Example>");
  });

  test("does not call Resend when the API key is absent", async () => {
    const harness = createFetchHarness();
    const send = createInquiryNotificationEmailSender({
      fetch: harness.fetchMock,
      getConfig: () => ({ apiKey: undefined, from: "alerts@streheprona.com" }),
    });

    await expect(send(notification)).resolves.toEqual({
      ok: false,
      reason: "missing_api_key",
    });
    expect(harness.requests).toHaveLength(0);
  });

  test("does not call Resend for a missing or malformed from address", async () => {
    for (const from of [undefined, "not-an-email"]) {
      const harness = createFetchHarness();
      const send = createInquiryNotificationEmailSender({
        fetch: harness.fetchMock,
        getConfig: () => ({ apiKey: "test-api-key", from }),
      });

      await expect(send(notification)).resolves.toEqual({
        ok: false,
        reason: "invalid_from_address",
      });
      expect(harness.requests).toHaveLength(0);
    }
  });

  test("does not call Resend for a malformed business recipient", async () => {
    const harness = createFetchHarness();
    const send = createInquiryNotificationEmailSender({
      fetch: harness.fetchMock,
      getConfig: () => ({
        apiKey: "test-api-key",
        from: "alerts@streheprona.com",
      }),
    });

    await expect(send({ ...notification, to: "not-an-email" })).resolves.toEqual({
      ok: false,
      reason: "invalid_recipient",
    });
    expect(harness.requests).toHaveLength(0);
  });

  test("returns a non-sensitive failure reason when Resend rejects the request", async () => {
    const harness = createFetchHarness(
      new Response(JSON.stringify({ message: "provider detail" }), { status: 422 })
    );
    const send = createInquiryNotificationEmailSender({
      fetch: harness.fetchMock,
      getConfig: () => ({
        apiKey: "test-api-key",
        from: "alerts@streheprona.com",
      }),
    });

    await expect(send(notification)).resolves.toEqual({
      ok: false,
      reason: "provider_rejected",
    });
  });
});

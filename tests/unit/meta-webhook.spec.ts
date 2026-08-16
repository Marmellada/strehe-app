import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createMetaWebhookHandlers } from "@/lib/meta/create-handlers";
import type { MetaWebhookEventInsert } from "@/lib/meta/persist";

const originalVerifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
const originalAppSecret = process.env.META_APP_SECRET;
const originalInstagramAppSecret = process.env.META_INSTAGRAM_APP_SECRET;
const verifyToken = "unit-test-verify-token";
const appSecret = "unit-test-app-secret";
const instagramAppSecret = "unit-test-instagram-app-secret";
const unauthorizedAppSecret = "unit-test-unauthorized-app-secret";

test.afterEach(() => {
  if (originalVerifyToken === undefined) {
    delete process.env.META_WEBHOOK_VERIFY_TOKEN;
  } else {
    process.env.META_WEBHOOK_VERIFY_TOKEN = originalVerifyToken;
  }

  if (originalAppSecret === undefined) {
    delete process.env.META_APP_SECRET;
  } else {
    process.env.META_APP_SECRET = originalAppSecret;
  }

  if (originalInstagramAppSecret === undefined) {
    delete process.env.META_INSTAGRAM_APP_SECRET;
  } else {
    process.env.META_INSTAGRAM_APP_SECRET = originalInstagramAppSecret;
  }
});

function signature(rawBody: Buffer, secret = appSecret) {
  return `sha256=${createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex")}`;
}

function postRequest(
  rawBody: Buffer,
  signatureHeader: string | null = signature(rawBody)
) {
  const headers = new Headers({ "content-type": "application/json" });
  if (signatureHeader !== null) {
    headers.set("x-hub-signature-256", signatureHeader);
  }
  return new Request("http://localhost/api/meta/webhook", {
    method: "POST",
    headers,
    body: rawBody.buffer.slice(
      rawBody.byteOffset,
      rawBody.byteOffset + rawBody.byteLength
    ) as ArrayBuffer,
  });
}

function recordingHandlers() {
  const persisted: MetaWebhookEventInsert[] = [];
  const handlers = createMetaWebhookHandlers(async (event) => {
    persisted.push(event);
  });
  return { handlers, persisted };
}

test.describe("Meta webhook verification handshake", () => {
  test.beforeEach(() => {
    process.env.META_WEBHOOK_VERIFY_TOKEN = verifyToken;
  });

  test("returns the exact challenge for the valid mode and token", async () => {
    const { handlers } = recordingHandlers();
    const response = await handlers.GET(
      new Request(
        `http://localhost/api/meta/webhook?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=123456`
      )
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("123456");
    expect(response.headers.get("content-type")).toContain("text/plain");
  });

  test("rejects a bad token", async () => {
    const { handlers } = recordingHandlers();
    const response = await handlers.GET(
      new Request(
        "http://localhost/api/meta/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1"
      )
    );
    expect(response.status).toBe(403);
  });

  test("rejects a missing verify token", async () => {
    const { handlers } = recordingHandlers();
    const response = await handlers.GET(
      new Request(
        "http://localhost/api/meta/webhook?hub.mode=subscribe&hub.challenge=1"
      )
    );
    expect(response.status).toBe(403);
  });

  test("rejects a missing challenge", async () => {
    const { handlers } = recordingHandlers();
    const response = await handlers.GET(
      new Request(
        `http://localhost/api/meta/webhook?hub.mode=subscribe&hub.verify_token=${verifyToken}`
      )
    );
    expect(response.status).toBe(403);
  });

  for (const query of [
    `hub.verify_token=${verifyToken}&hub.challenge=1`,
    `hub.mode=wrong&hub.verify_token=${verifyToken}&hub.challenge=1`,
  ]) {
    test(`rejects a wrong or missing mode: ${query}`, async () => {
      const { handlers } = recordingHandlers();
      const response = await handlers.GET(
        new Request(`http://localhost/api/meta/webhook?${query}`)
      );
      expect(response.status).toBe(403);
    });
  }

  test("returns 500 when the verify token is not configured", async () => {
    delete process.env.META_WEBHOOK_VERIFY_TOKEN;
    const { handlers } = recordingHandlers();
    const response = await handlers.GET(
      new Request("http://localhost/api/meta/webhook")
    );
    expect(response.status).toBe(500);
  });
});

test.describe("Meta webhook authenticated ingestion", () => {
  test.beforeEach(() => {
    process.env.META_APP_SECRET = appSecret;
    process.env.META_INSTAGRAM_APP_SECRET = instagramAppSecret;
  });

  for (const rejected of [
    { name: "missing signature", header: null },
    { name: "malformed signature", header: "sha256=not-hex" },
    { name: "incorrect signature", header: `sha256=${"00".repeat(32)}` },
  ]) {
    test(`rejects a ${rejected.name} without persistence`, async () => {
      const { handlers, persisted } = recordingHandlers();
      const response = await handlers.POST(
        postRequest(Buffer.from('{"object":"page"}'), rejected.header)
      );

      expect(response.status).toBe(401);
      expect(persisted).toHaveLength(0);
    });
  }

  const payloadCases = [
    {
      name: "WhatsApp",
      payload: { object: "whatsapp_business_account", entry: [] },
      channel: "whatsapp",
    },
    {
      name: "Messenger Page",
      payload: { object: "page", entry: [{ messaging: [{ message: {} }] }] },
      channel: "messenger",
    },
    {
      name: "Instagram",
      payload: { object: "instagram", entry: [{ messaging: [] }] },
      channel: "instagram",
    },
    {
      name: "unknown object",
      payload: { object: "future_meta_object", entry: [{ future: true }] },
      channel: "unknown",
    },
  ] as const;

  for (const payloadCase of payloadCases) {
    test(`persists a correctly signed ${payloadCase.name} payload once`, async () => {
      const { handlers, persisted } = recordingHandlers();
      const rawBody = Buffer.from(JSON.stringify(payloadCase.payload));
      const response = await handlers.POST(postRequest(rawBody));

      expect(response.status).toBe(200);
      expect(persisted).toHaveLength(1);
      expect(persisted[0].channel).toBe(payloadCase.channel);
      expect(persisted[0].payload).toEqual(payloadCase.payload);
      expect(persisted[0].payloadSha256).toMatch(/^[0-9a-f]{64}$/);
    });
  }

  test("accepts an Instagram payload signed with the Instagram app secret", async () => {
    process.env.META_INSTAGRAM_APP_SECRET = instagramAppSecret;
    const { handlers, persisted } = recordingHandlers();
    const payload = { object: "instagram", entry: [{ messaging: [] }] };
    const rawBody = Buffer.from(JSON.stringify(payload));

    const response = await handlers.POST(
      postRequest(rawBody, signature(rawBody, instagramAppSecret))
    );

    expect(response.status).toBe(200);
    expect(persisted).toHaveLength(1);
    expect(persisted[0].channel).toBe("instagram");
  });

  test("accepts an Instagram payload when only the Instagram app secret is configured", async () => {
    delete process.env.META_APP_SECRET;
    process.env.META_INSTAGRAM_APP_SECRET = instagramAppSecret;
    const { handlers, persisted } = recordingHandlers();
    const payload = { object: "instagram", entry: [{ messaging: [] }] };
    const rawBody = Buffer.from(JSON.stringify(payload));

    const response = await handlers.POST(
      postRequest(rawBody, signature(rawBody, instagramAppSecret))
    );

    expect(response.status).toBe(200);
    expect(persisted).toHaveLength(1);
    expect(persisted[0].channel).toBe("instagram");
  });

  test("accepts a WhatsApp payload when only the existing app secret is configured", async () => {
    delete process.env.META_INSTAGRAM_APP_SECRET;
    const { handlers, persisted } = recordingHandlers();
    const payload = { object: "whatsapp_business_account", entry: [] };
    const rawBody = Buffer.from(JSON.stringify(payload));

    const response = await handlers.POST(postRequest(rawBody));

    expect(response.status).toBe(200);
    expect(persisted).toHaveLength(1);
    expect(persisted[0].channel).toBe("whatsapp");
  });

  test("rejects a signature produced with an unauthorized secret", async () => {
    process.env.META_INSTAGRAM_APP_SECRET = instagramAppSecret;
    const { handlers, persisted } = recordingHandlers();
    const rawBody = Buffer.from('{"object":"instagram","entry":[]}');

    const response = await handlers.POST(
      postRequest(rawBody, signature(rawBody, unauthorizedAppSecret))
    );

    expect(response.status).toBe(401);
    expect(persisted).toHaveLength(0);
  });

  test("ignores an empty Instagram app secret", async () => {
    process.env.META_INSTAGRAM_APP_SECRET = "";
    const { handlers, persisted } = recordingHandlers();
    const rawBody = Buffer.from('{"object":"whatsapp_business_account","entry":[]}');

    const response = await handlers.POST(postRequest(rawBody));

    expect(response.status).toBe(200);
    expect(persisted).toHaveLength(1);
    expect(persisted[0].channel).toBe("whatsapp");
  });

  test("rejects correctly signed malformed JSON without persistence", async () => {
    const { handlers, persisted } = recordingHandlers();
    const rawBody = Buffer.from('{"object":');
    const response = await handlers.POST(postRequest(rawBody));

    expect(response.status).toBe(400);
    expect(persisted).toHaveLength(0);
  });

  test("rejects bodies over 1 MiB without persistence", async () => {
    const { handlers, persisted } = recordingHandlers();
    const rawBody = Buffer.alloc(1024 * 1024 + 1, 0x20);
    const response = await handlers.POST(postRequest(rawBody));

    expect(response.status).toBe(413);
    expect(persisted).toHaveLength(0);
  });

  test("stops consuming a stream as soon as it exceeds 1 MiB", async () => {
    const chunks = [
      new Uint8Array(600 * 1024),
      new Uint8Array(600 * 1024),
      new Uint8Array(600 * 1024),
    ];
    let chunksRead = 0;
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          const chunk = chunks[chunksRead];
          if (!chunk) {
            controller.close();
            return;
          }
          chunksRead += 1;
          controller.enqueue(chunk);
        },
        cancel() {
          cancelled = true;
        },
      },
      { highWaterMark: 0 }
    );
    const { handlers, persisted } = recordingHandlers();
    const response = await handlers.POST({
      body,
      headers: new Headers(),
    } as Request);

    expect(response.status).toBe(413);
    expect(persisted).toHaveLength(0);
    expect(chunksRead).toBe(2);
    expect(cancelled).toBe(true);
  });

  test("returns 500 when persistence fails", async () => {
    const handlers = createMetaWebhookHandlers(async () => {
      throw new Error("database unavailable");
    });
    const rawBody = Buffer.from('{"object":"page"}');
    const response = await handlers.POST(postRequest(rawBody));

    expect(response.status).toBe(500);
  });

  test("returns 500 without persistence when no app secrets are configured", async () => {
    delete process.env.META_APP_SECRET;
    delete process.env.META_INSTAGRAM_APP_SECRET;
    const { handlers, persisted } = recordingHandlers();
    const rawBody = Buffer.from('{"object":"page"}');
    const response = await handlers.POST(postRequest(rawBody));

    expect(response.status).toBe(500);
    expect(persisted).toHaveLength(0);
  });

  test("authenticates the exact raw bytes instead of normalized JSON", async () => {
    const { handlers, persisted } = recordingHandlers();
    const signedBytes = Buffer.from('{ "object": "page", "entry": [] }');
    const differentlyFormattedBytes = Buffer.from(
      '{"object":"page","entry":[]}'
    );
    const response = await handlers.POST(
      postRequest(differentlyFormattedBytes, signature(signedBytes))
    );

    expect(response.status).toBe(401);
    expect(persisted).toHaveLength(0);
  });
});

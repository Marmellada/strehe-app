import { expect, test } from "@playwright/test";
import { NextRequest } from "next/server";
import { createMetaIngestHandler } from "@/lib/server/meta-ingest-handler";

const originalCronSecret = process.env.CRON_SECRET;

test.afterEach(() => {
  if (originalCronSecret === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = originalCronSecret;
  }
});

function createRequest(method: "GET" | "POST", headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/cron/meta-ingest", {
    method,
    headers,
  });
}

const deterministicSummary = {
  claimed: 1,
  message_created: 1,
  duplicate: 0,
  non_message: 0,
  unsupported: 0,
  synthetic_test: 0,
  failed: 0,
};

test.describe("meta ingest cron authorization", () => {
  const secret = "unit-test-cron-secret";

  const rejectedCases: Array<{
    name: string;
    serverSecret: string | undefined;
    headers: Record<string, string>;
  }> = [
    { name: "missing server-side CRON_SECRET", serverSecret: undefined, headers: { authorization: `Bearer ${secret}` } },
    { name: "empty server-side CRON_SECRET", serverSecret: "", headers: { authorization: "Bearer " } },
    { name: "missing Authorization header", serverSecret: secret, headers: {} },
    { name: "wrong Bearer secret", serverSecret: secret, headers: { authorization: "Bearer wrong" } },
    { name: "malformed Bearer authorization", serverSecret: secret, headers: { authorization: `Bearer  ${secret}` } },
    { name: "arbitrary x-vercel-cron without Authorization", serverSecret: secret, headers: { "x-vercel-cron": "1" } },
  ];

  for (const rejected of rejectedCases) {
    for (const method of ["GET", "POST"] as const) {
      test(`rejects ${rejected.name} on ${method}`, async () => {
        if (rejected.serverSecret === undefined) {
          delete process.env.CRON_SECRET;
        } else {
          process.env.CRON_SECRET = rejected.serverSecret;
        }

        let runCalls = 0;
        const handler = createMetaIngestHandler(async () => {
          runCalls += 1;
          return deterministicSummary;
        });

        const response = await handler(createRequest(method, rejected.headers));
        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({ ok: false, error: "Unauthorized" });
        expect(runCalls).toBe(0);
      });
    }
  }

  for (const method of ["GET", "POST"] as const) {
    test(`authorizes only the exact Bearer secret on ${method}`, async () => {
      process.env.CRON_SECRET = secret;
      let runCalls = 0;
      const handler = createMetaIngestHandler(async () => {
        runCalls += 1;
        return deterministicSummary;
      });

      const response = await handler(
        createRequest(method, { authorization: `Bearer ${secret}` })
      );
      expect(response.status).toBe(200);
      expect(runCalls).toBe(1);

      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.mode).toBe("cron");
      // Aggregate technical counts only — no message content or identity PII.
      expect(body.result).toEqual(deterministicSummary);
    });
  }
});

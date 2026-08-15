import { expect, test } from "@playwright/test";
import { NextRequest } from "next/server";
import { createGenerateTasksHandler } from "@/lib/server/generate-tasks-handler";

const originalCronSecret = process.env.CRON_SECRET;

test.afterEach(() => {
  if (originalCronSecret === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = originalCronSecret;
  }
});

function createRequest(headers: HeadersInit = {}) {
  return new NextRequest("http://localhost/api/cron/generate-tasks", {
    method: "POST",
    headers,
  });
}

test.describe("task cron authorization", () => {
  const secret = "unit-test-cron-secret";
  const rejectedCases = [
    {
      name: "missing server-side CRON_SECRET",
      serverSecret: undefined,
      headers: { authorization: `Bearer ${secret}` },
    },
    {
      name: "empty server-side CRON_SECRET",
      serverSecret: "",
      headers: { authorization: "Bearer " },
    },
    {
      name: "missing Authorization header",
      serverSecret: secret,
      headers: {},
    },
    {
      name: "Basic authorization",
      serverSecret: secret,
      headers: { authorization: `Basic ${secret}` },
    },
    {
      name: "malformed Bearer authorization",
      serverSecret: secret,
      headers: { authorization: `Bearer  ${secret}` },
    },
    {
      name: "wrong Bearer secret",
      serverSecret: secret,
      headers: { authorization: "Bearer wrong-secret" },
    },
    {
      name: "arbitrary x-vercel-cron without Authorization",
      serverSecret: secret,
      headers: { "x-vercel-cron": "1" },
    },
    {
      name: "arbitrary x-vercel-cron with wrong Authorization",
      serverSecret: secret,
      headers: {
        "x-vercel-cron": "1",
        authorization: "Bearer wrong-secret",
      },
    },
  ] as const;

  for (const rejectedCase of rejectedCases) {
    test(`rejects ${rejectedCase.name}`, async () => {
      if (rejectedCase.serverSecret === undefined) {
        delete process.env.CRON_SECRET;
      } else {
        process.env.CRON_SECRET = rejectedCase.serverSecret;
      }

      let generateTasksCalls = 0;
      const handler = createGenerateTasksHandler(async () => {
        generateTasksCalls += 1;
        return { createdCount: 99 };
      });

      const response = await handler(createRequest(rejectedCase.headers));

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        ok: false,
        error: "Unauthorized",
      });
      expect(generateTasksCalls).toBe(0);
    });
  }

  test("authorizes only the exact Bearer secret", async () => {
    process.env.CRON_SECRET = secret;
    const deterministicResult = {
      createdCount: 0,
      skippedDuplicateCount: 2,
    };
    let generateTasksCalls = 0;
    const handler = createGenerateTasksHandler(async () => {
      generateTasksCalls += 1;
      return deterministicResult;
    });

    const response = await handler(
      createRequest({ authorization: `Bearer ${secret}` })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      mode: "cron",
      result: deterministicResult,
    });
    expect(generateTasksCalls).toBe(1);
  });
});

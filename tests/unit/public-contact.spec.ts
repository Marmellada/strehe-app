import { expect, test } from "@playwright/test";
import {
  createPublicContactLeadHandler,
  type PublicContactAdminClient,
  type PublicContactLeadState,
} from "@/lib/security/public-contact";

const idleState: PublicContactLeadState = { status: "idle", message: "" };
const fixedNow = new Date("2026-07-23T12:00:00.000Z");

function validForm(overrides: Record<string, string> = {}) {
  const values = {
    company_email: "hello@streheprona.com",
    locale: "en",
    website_url: "",
    name: "Ada Example",
    contact: "ada@example.com",
    abroad: "yes",
    country: "Germany",
    area: "Dardania",
    message: "Please inspect the apartment.",
    utm_source: "meta",
    utm_medium: "paid_social",
    utm_campaign: "strehe_meta_diaspora_founders_202608",
    landing_locale: "en",
    landing_page: "/en/contact",
    ...overrides,
  };
  const formData = new FormData();
  Object.entries(values).forEach(([key, value]) => formData.set(key, value));
  return formData;
}

function createHarness(options: {
  recent?: Array<{
    full_name: string | null;
    email: string | null;
    phone: string | null;
    country: string | null;
    city: string | null;
    notes: string | null;
  }>;
  queryError?: unknown;
  insertError?: unknown;
} = {}) {
  let adminCalls = 0;
  let revalidateCalls = 0;
  const insertedRows: unknown[] = [];

  const query = {
    eq() {
      return query;
    },
    gte() {
      return query;
    },
    async limit() {
      return {
        data: options.recent || [],
        error: options.queryError || null,
      };
    },
  };

  const client = {
    from() {
      return {
        select() {
          return query;
        },
        async insert(rows: unknown[]) {
          insertedRows.push(...rows);
          return { error: options.insertError || null };
        },
      };
    },
  } as unknown as PublicContactAdminClient;

  const handler = createPublicContactLeadHandler({
    getAdminClient: () => {
      adminCalls += 1;
      return client;
    },
    now: () => fixedNow,
    revalidateLeads: () => {
      revalidateCalls += 1;
    },
  });

  return {
    handler,
    insertedRows,
    get adminCalls() {
      return adminCalls;
    },
    get revalidateCalls() {
      return revalidateCalls;
    },
  };
}

test.describe("public contact action containment", () => {
  test("normalizes and inserts a valid submission once", async () => {
    const harness = createHarness();
    const result = await harness.handler(
      idleState,
      validForm({
        name: "  Ada   Example  ",
        contact: " ADA@EXAMPLE.COM ",
        country: "  Germany ",
      })
    );

    expect(result.status).toBe("success");
    expect(harness.adminCalls).toBe(1);
    expect(harness.insertedRows).toHaveLength(1);
    expect(harness.insertedRows[0]).toMatchObject({
      full_name: "Ada Example",
      email: "ada@example.com",
      phone: null,
      country: "Germany",
      city: "Dardania",
      source: "website",
      status: "new",
      utm_source: "meta",
      first_touch_at: fixedNow.toISOString(),
    });
    expect(harness.revalidateCalls).toBe(1);
  });

  const invalidCases: Array<{
    name: string;
    values: Record<string, string>;
  }> = [
    { name: "empty submission", values: { name: "", contact: "" } },
    { name: "meaningless name", values: { name: "---" } },
    { name: "invalid contact", values: { contact: "call me" } },
    { name: "oversized name", values: { name: "A".repeat(101) } },
    { name: "oversized message", values: { message: "A".repeat(2001) } },
    { name: "unsafe attribution", values: { utm_campaign: "<script>" } },
    { name: "oversized click id", values: { click_id: "A".repeat(201) } },
  ];

  for (const invalidCase of invalidCases) {
    test("rejects " + invalidCase.name + " before admin access", async () => {
      const harness = createHarness();
      const result = await harness.handler(
        idleState,
        validForm(invalidCase.values)
      );

      expect(result.status).toBe("error");
      expect(harness.adminCalls).toBe(0);
      expect(harness.insertedRows).toHaveLength(0);
      expect(harness.revalidateCalls).toBe(0);
    });
  }

  test("silently contains honeypot submissions before admin access", async () => {
    const harness = createHarness();
    const result = await harness.handler(
      idleState,
      validForm({ website_url: "https://bot.example" })
    );

    expect(result.status).toBe("success");
    expect(harness.adminCalls).toBe(0);
    expect(harness.insertedRows).toHaveLength(0);
    expect(harness.revalidateCalls).toBe(0);
  });

  test("suppresses an equivalent submission within the duplicate window", async () => {
    const harness = createHarness({
      recent: [
        {
          full_name: "Ada Example",
          email: "ada@example.com",
          phone: null,
          country: "Germany",
          city: "Dardania",
          notes: [
            "Please inspect the apartment.",
            "Apartment area: Dardania",
            "Lives abroad: yes",
            "Country where they live: Germany",
            "Website locale: en",
          ].join("\n"),
        },
      ],
    });

    const result = await harness.handler(idleState, validForm());

    expect(result.status).toBe("success");
    expect(harness.adminCalls).toBe(1);
    expect(harness.insertedRows).toHaveLength(0);
    expect(harness.revalidateCalls).toBe(0);
  });

  test("fails closed with a generic message when duplicate lookup fails", async () => {
    const harness = createHarness({ queryError: { message: "private database detail" } });
    const result = await harness.handler(idleState, validForm());

    expect(result.status).toBe("error");
    expect(result.message).not.toContain("private database detail");
    expect(harness.insertedRows).toHaveLength(0);
  });

  test("returns a generic error when insertion fails", async () => {
    const harness = createHarness({ insertError: { message: "private database detail" } });
    const result = await harness.handler(idleState, validForm());

    expect(result.status).toBe("error");
    expect(result.message).not.toContain("private database detail");
    expect(harness.insertedRows).toHaveLength(1);
    expect(harness.revalidateCalls).toBe(0);
  });
});

import { expect, test } from "@playwright/test";
import { runMetaIngest, type IngestClient } from "@/lib/messaging/ingest";

type FakeConfig = {
  claim?: unknown[];
  upsert?: unknown[];
  ingestResult?: string;
  failOn?: string;
};

function makeFake(config: FakeConfig = {}) {
  const calls: string[] = [];
  const client = {
    async rpc(fn: string) {
      calls.push(fn);
      if (config.failOn === fn) return { data: null, error: new Error("boom") };
      switch (fn) {
        case "claim_meta_ingestion_batch":
          return { data: config.claim ?? [], error: null };
        case "meta_ingestion_mark_completed":
          return { data: null, error: null };
        case "meta_ingestion_mark_failure":
          return { data: null, error: null };
        case "upsert_contact_channel_identity":
          return {
            data:
              config.upsert ?? [
                { id: "id_1", lead_id: null, client_id: null, resolution_status: "unresolved" },
              ],
            error: null,
          };
        case "resolve_contact_identity_whatsapp":
          return { data: "unresolved", error: null };
        case "ensure_conversation":
          return { data: "conv_1", error: null };
        case "ingest_conversation_message":
          return { data: config.ingestResult ?? "message_created", error: null };
        default:
          return { data: null, error: new Error(`unexpected rpc: ${fn}`) };
      }
    },
  };
  return { client: client as unknown as IngestClient, calls };
}

function claimItem(payload: unknown): Record<string, unknown> {
  return {
    queue_id: "q1",
    webhook_event_id: "w1",
    channel: "whatsapp",
    object_type: "whatsapp_business_account",
    event_type: "messages",
    payload,
    received_at: "2026-08-16T17:00:00Z",
  };
}

const whatsAppTextPayload = {
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
                id: "wamid.example.aaa",
                timestamp: "1784143899",
                type: "text",
                text: { body: "hello" },
              },
            ],
          },
        },
      ],
    },
  ],
};

const syntheticPayload = {
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

const statusOnlyPayload = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "waba_100",
      changes: [
        {
          field: "messages",
          value: { messaging_product: "whatsapp", metadata: {}, contacts: [], statuses: [{ id: "s1" }] },
        },
      ],
    },
  ],
};

test.describe("ingestion orchestrator", () => {
  test("returns an empty summary when nothing is claimable", async () => {
    const { client } = makeFake({ claim: [] });
    const summary = await runMetaIngest(10, client);
    expect(summary).toEqual({
      claimed: 0,
      message_created: 0,
      duplicate: 0,
      non_message: 0,
      unsupported: 0,
      synthetic_test: 0,
      failed: 0,
    });
  });

  test("persists a text message and marks the event message_created", async () => {
    const { client, calls } = makeFake({ claim: [claimItem(whatsAppTextPayload)] });
    const summary = await runMetaIngest(10, client);

    expect(summary.claimed).toBe(1);
    expect(summary.message_created).toBe(1);
    expect(calls).toContain("claim_meta_ingestion_batch");
    expect(calls).toContain("upsert_contact_channel_identity");
    expect(calls).toContain("ensure_conversation");
    expect(calls).toContain("ingest_conversation_message");
    expect(calls).toContain("meta_ingestion_mark_completed");
  });

  test("classifies a synthetic test event without creating messages", async () => {
    const { client, calls } = makeFake({ claim: [claimItem(syntheticPayload)] });
    const summary = await runMetaIngest(10, client);

    expect(summary.synthetic_test).toBe(1);
    expect(summary.message_created).toBe(0);
    expect(calls).not.toContain("ingest_conversation_message");
    expect(calls).not.toContain("upsert_contact_channel_identity");
  });

  test("classifies a status-only event as non_message", async () => {
    const { client, calls } = makeFake({ claim: [claimItem(statusOnlyPayload)] });
    const summary = await runMetaIngest(10, client);

    expect(summary.non_message).toBe(1);
    expect(calls).not.toContain("ingest_conversation_message");
  });

  test("reports duplicate when the message insert is a no-op", async () => {
    const { client } = makeFake({
      claim: [claimItem(whatsAppTextPayload)],
      ingestResult: "duplicate",
    });
    const summary = await runMetaIngest(10, client);
    expect(summary.duplicate).toBe(1);
    expect(summary.message_created).toBe(0);
  });

  test("marks failure and does not complete when a message write throws", async () => {
    const { client, calls } = makeFake({
      claim: [claimItem(whatsAppTextPayload)],
      failOn: "ingest_conversation_message",
    });
    const summary = await runMetaIngest(10, client);

    expect(summary.failed).toBe(1);
    expect(summary.message_created).toBe(0);
    expect(calls).toContain("meta_ingestion_mark_failure");
    expect(calls).not.toContain("meta_ingestion_mark_completed");
  });

  test("a claim failure yields an empty summary rather than throwing", async () => {
    const { client } = makeFake({ failOn: "claim_meta_ingestion_batch" });
    const summary = await runMetaIngest(10, client);
    expect(summary.claimed).toBe(0);
  });
});

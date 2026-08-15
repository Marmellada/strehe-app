import {
  type MetaWebhookEventInsert,
  persistMetaWebhookEvent,
} from "@/lib/meta/persist";
import { deriveMetaWebhookMetadata } from "@/lib/meta/schema";
import {
  constantTimeTokenEqual,
  readBodyWithLimit,
  sha256Hex,
  verifyMetaSignature,
} from "@/lib/meta/verify";

const MAX_BODY_BYTES = 1024 * 1024;

type PersistMetaWebhookEvent = (
  event: MetaWebhookEventInsert
) => Promise<void>;

export function createMetaWebhookHandlers(
  persistEvent: PersistMetaWebhookEvent = persistMetaWebhookEvent
) {
  async function GET(request: Request) {
    const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
    if (!verifyToken) {
      return new Response("Webhook verification is not configured.", {
        status: 500,
      });
    }

    const searchParams = new URL(request.url).searchParams;
    const mode = searchParams.get("hub.mode");
    const suppliedToken = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    if (
      mode !== "subscribe" ||
      suppliedToken === null ||
      challenge === null ||
      !constantTimeTokenEqual(suppliedToken, verifyToken)
    ) {
      return new Response("Forbidden", { status: 403 });
    }

    return new Response(challenge, {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  async function POST(request: Request) {
    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret) {
      return new Response("Webhook authentication is not configured.", {
        status: 500,
      });
    }

    let bodyResult;
    try {
      bodyResult = await readBodyWithLimit(request.body, MAX_BODY_BYTES);
    } catch {
      return new Response("Invalid request body.", { status: 400 });
    }

    if (!bodyResult.withinLimit) {
      return new Response("Payload too large.", { status: 413 });
    }
    const rawBody = bodyResult.rawBody;

    if (
      !verifyMetaSignature(
        rawBody,
        request.headers.get("x-hub-signature-256"),
        appSecret
      )
    ) {
      return new Response("Unauthorized", { status: 401 });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return new Response("Invalid JSON.", { status: 400 });
    }

    const metadata = deriveMetaWebhookMetadata(payload);

    try {
      await persistEvent({
        ...metadata,
        payloadSha256: sha256Hex(rawBody),
        payload,
      });
    } catch {
      return new Response("Persistence failed.", { status: 500 });
    }

    return new Response("OK", { status: 200 });
  }

  return { GET, POST };
}

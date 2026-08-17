import type { MessagingChannel } from "@/lib/messaging/types";

export type MetaSendInput = {
  channel: MessagingChannel;
  channelAccountId: string;
  recipientExternalId: string;
  text: string;
};

export type MetaSendErrorClass =
  | "auth"
  | "rate_limit"
  | "recipient_invalid"
  | "provider"
  | "unknown";

export type MetaSendResult =
  | { ok: true; externalMessageId: string }
  | { ok: false; errorClass: MetaSendErrorClass; message: string };

type MetaErrorPayload = {
  error?: { code?: unknown };
};

export function classifyMetaFailure(
  status: number,
  payload: unknown
): Exclude<MetaSendResult, { ok: true }> {
  const code = (payload as MetaErrorPayload | null)?.error?.code;

  if (status === 401 || status === 403 || code === 190) {
    return { ok: false, errorClass: "auth", message: "Meta channel authentication failed." };
  }

  if (status === 429 || [4, 17, 32, 613].includes(Number(code))) {
    return {
      ok: false,
      errorClass: "rate_limit",
      message: "Meta rate limit reached. Try again later.",
    };
  }

  if (status === 400 && [100, 551, 131026].includes(Number(code))) {
    return {
      ok: false,
      errorClass: "recipient_invalid",
      message: "Meta could not deliver to this recipient.",
    };
  }

  return { ok: false, errorClass: "provider", message: "Meta rejected the message." };
}

export function missingConfiguration(message: string): MetaSendResult {
  return { ok: false, errorClass: "provider", message };
}

export async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

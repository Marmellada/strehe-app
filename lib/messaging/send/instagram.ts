import {
  classifyMetaFailure,
  missingConfiguration,
  readJson,
  type MetaSendInput,
  type MetaSendResult,
} from "./types";

export async function sendInstagramMessage(
  input: MetaSendInput
): Promise<MetaSendResult> {
  const version = process.env.META_GRAPH_API_VERSION?.trim();
  const token = process.env.META_INSTAGRAM_ACCESS_TOKEN?.trim();

  if (!version || !input.channelAccountId.trim()) {
    return missingConfiguration("Instagram sending is not configured.");
  }
  if (!token) {
    return { ok: false, errorClass: "auth", message: "Instagram authentication is not configured." };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/${encodeURIComponent(version)}/${encodeURIComponent(input.channelAccountId)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipient: { id: input.recipientExternalId },
          message: { text: input.text },
        }),
      }
    );
    const payload = await readJson(response);

    if (!response.ok) return classifyMetaFailure(response.status, payload);

    const externalMessageId = (payload as { message_id?: unknown } | null)?.message_id;
    if (typeof externalMessageId !== "string" || !externalMessageId.trim()) {
      return { ok: false, errorClass: "provider", message: "Meta did not confirm the message." };
    }

    return { ok: true, externalMessageId: externalMessageId.trim() };
  } catch {
    return { ok: false, errorClass: "unknown", message: "Unable to reach Meta." };
  }
}

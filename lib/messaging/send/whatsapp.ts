import {
  classifyMetaFailure,
  missingConfiguration,
  readJson,
  type MetaSendInput,
  type MetaSendResult,
} from "./types";

export async function sendWhatsAppMessage(
  input: MetaSendInput
): Promise<MetaSendResult> {
  const version = process.env.META_GRAPH_API_VERSION?.trim();
  const token = process.env.META_WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim();

  if (!version || !phoneNumberId) {
    return missingConfiguration("WhatsApp sending is not configured.");
  }
  if (!token) {
    return { ok: false, errorClass: "auth", message: "WhatsApp authentication is not configured." };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/${encodeURIComponent(version)}/${encodeURIComponent(phoneNumberId)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: input.recipientExternalId,
          type: "text",
          text: { body: input.text },
        }),
      }
    );
    const payload = await readJson(response);

    if (!response.ok) return classifyMetaFailure(response.status, payload);

    const externalMessageId = (payload as { messages?: Array<{ id?: unknown }> } | null)
      ?.messages?.[0]?.id;
    if (typeof externalMessageId !== "string" || !externalMessageId.trim()) {
      return { ok: false, errorClass: "provider", message: "Meta did not confirm the message." };
    }

    return { ok: true, externalMessageId: externalMessageId.trim() };
  } catch {
    return { ok: false, errorClass: "unknown", message: "Unable to reach Meta." };
  }
}

import { sendInstagramMessage } from "./instagram";
import { sendMessengerMessage } from "./messenger";
import type { MetaSendInput, MetaSendResult } from "./types";
import { sendWhatsAppMessage } from "./whatsapp";

export type { MetaSendInput, MetaSendResult } from "./types";

export async function sendMetaMessage(input: MetaSendInput): Promise<MetaSendResult> {
  switch (input.channel) {
    case "whatsapp":
      return sendWhatsAppMessage(input);
    case "instagram":
      return sendInstagramMessage(input);
    case "messenger":
      return sendMessengerMessage(input);
    default:
      return { ok: false, errorClass: "provider", message: "Unsupported messaging channel." };
  }
}

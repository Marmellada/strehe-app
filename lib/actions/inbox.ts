"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export type InboxAction =
  | "mark_read"
  | "needs_reply"
  | "waiting_customer"
  | "clear_attention"
  | "resolve"
  | "reopen";

export type InboxActionResult =
  | { success: true }
  | { success: false; error: string };

const INBOX_ACTIONS: readonly InboxAction[] = [
  "mark_read",
  "needs_reply",
  "waiting_customer",
  "clear_attention",
  "resolve",
  "reopen",
];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isInboxAction(value: string): value is InboxAction {
  return INBOX_ACTIONS.includes(value as InboxAction);
}

export async function setConversationState(
  conversationId: string,
  action: string
): Promise<InboxActionResult> {
  await requireRole(["admin", "office"]);

  if (!UUID_PATTERN.test(conversationId)) {
    return { success: false, error: "Invalid conversation" };
  }

  if (!isInboxAction(action)) {
    return { success: false, error: "Invalid conversation action" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("operator_set_conversation_state", {
    p_conversation_id: conversationId,
    p_action: action,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/operator/inbox");
  revalidatePath(`/operator/inbox/${conversationId}`);

  return { success: true };
}

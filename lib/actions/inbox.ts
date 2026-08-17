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

export type IdentityAction =
  | "link_lead"
  | "link_client"
  | "unlink"
  | "needs_review";

export type LeadSearchItem = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
};

export type ClientSearchItem = {
  id: string;
  display_name: string;
  phone: string | null;
  email: string | null;
};

export type SearchResult<T> =
  | { success: true; results: T[] }
  | { success: false; error: string };

const INBOX_ACTIONS: readonly InboxAction[] = [
  "mark_read",
  "needs_reply",
  "waiting_customer",
  "clear_attention",
  "resolve",
  "reopen",
];

const IDENTITY_ACTIONS: readonly IdentityAction[] = [
  "link_lead",
  "link_client",
  "unlink",
  "needs_review",
];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isInboxAction(value: string): value is InboxAction {
  return INBOX_ACTIONS.includes(value as InboxAction);
}

function isIdentityAction(value: string): value is IdentityAction {
  return IDENTITY_ACTIONS.includes(value as IdentityAction);
}

function getSearchQuery(value: string) {
  const query = value.trim().slice(0, 100);
  if (query.length < 2) return null;

  const escaped = query
    .replace(/\\/g, "\\\\")
    .replace(/\"/g, '\\"')
    .replace(/,/g, "\\,")
    .replace(/[%_]/g, "\\$&");

  return `"%${escaped}%"`;
}

function revalidateInbox(conversationId: string) {
  revalidatePath("/operator/inbox");
  revalidatePath(`/operator/inbox/${conversationId}`);
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

  revalidateInbox(conversationId);

  return { success: true };
}

export async function setIdentityResolution(
  conversationId: string,
  identityId: string,
  action: string,
  targetId: string | null = null
): Promise<InboxActionResult> {
  await requireRole(["admin", "office"]);

  if (!UUID_PATTERN.test(conversationId) || !UUID_PATTERN.test(identityId)) {
    return { success: false, error: "Invalid identity" };
  }

  if (!isIdentityAction(action)) {
    return { success: false, error: "Invalid identity action" };
  }

  const expectsTarget = action === "link_lead" || action === "link_client";
  if (
    (expectsTarget && (!targetId || !UUID_PATTERN.test(targetId))) ||
    (!expectsTarget && targetId !== null)
  ) {
    return { success: false, error: "Invalid identity action" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("operator_set_identity_resolution", {
    p_identity_id: identityId,
    p_action: action,
    p_target_id: targetId,
  });

  if (error) return { success: false, error: error.message };

  revalidateInbox(conversationId);
  return { success: true };
}

export async function setConversationAssignment(
  conversationId: string,
  assigneeId: string | null
): Promise<InboxActionResult> {
  await requireRole(["admin", "office"]);

  if (
    !UUID_PATTERN.test(conversationId) ||
    (assigneeId !== null && !UUID_PATTERN.test(assigneeId))
  ) {
    return { success: false, error: "Invalid conversation assignment" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("operator_set_conversation_assignment", {
    p_conversation_id: conversationId,
    p_assignee_id: assigneeId,
  });

  if (error) return { success: false, error: error.message };

  revalidateInbox(conversationId);
  return { success: true };
}

export async function searchLeads(
  value: string
): Promise<SearchResult<LeadSearchItem>> {
  await requireRole(["admin", "office"]);
  const query = getSearchQuery(value);

  if (!query) {
    return { success: false, error: "Enter at least 2 characters" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select("id,full_name,phone,email")
    .or(`full_name.ilike.${query},phone.ilike.${query},email.ilike.${query}`)
    .order("full_name", { ascending: true })
    .limit(10);

  if (error) return { success: false, error: "Unable to search leads" };
  return { success: true, results: (data || []) as LeadSearchItem[] };
}

export async function searchClients(
  value: string
): Promise<SearchResult<ClientSearchItem>> {
  await requireRole(["admin", "office"]);
  const query = getSearchQuery(value);

  if (!query) {
    return { success: false, error: "Enter at least 2 characters" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id,full_name,company_name,contact_person,phone,email")
    .or(
      `full_name.ilike.${query},company_name.ilike.${query},contact_person.ilike.${query},phone.ilike.${query},email.ilike.${query}`
    )
    .order("full_name", { ascending: true })
    .limit(10);

  if (error) return { success: false, error: "Unable to search clients" };

  const results = (data || []).map((client) => ({
    id: client.id,
    display_name:
      client.full_name ||
      client.company_name ||
      client.contact_person ||
      "Unnamed client",
    phone: client.phone,
    email: client.email,
  }));

  return { success: true, results };
}

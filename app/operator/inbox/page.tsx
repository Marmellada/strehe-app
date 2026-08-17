import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
} from "@/components/ui/Table";
import { requireRole } from "@/lib/auth/require-role";
import type { MessageType, MessagingChannel } from "@/lib/messaging/types";
import { createClient } from "@/lib/supabase/server";
import { formatStatusLabel } from "@/lib/ui/status";

type RelatedRow<T> = T | T[] | null;

type IdentityRow = {
  channel: MessagingChannel;
  display_name: string | null;
  phone_e164: string | null;
  external_id: string;
  resolution_status: "unresolved" | "resolved" | "needs_review";
};

type AssignedUserRow = {
  full_name: string | null;
  email: string | null;
};

type ConversationRow = {
  id: string;
  attention_state: "needs_reply" | "waiting_customer" | "none";
  unread_count: number;
  last_message_at: string | null;
  identity: RelatedRow<IdentityRow>;
  assigned: RelatedRow<AssignedUserRow>;
};

type MessageRow = {
  conversation_id: string;
  message_type: MessageType;
  text_content: string | null;
  occurred_at: string | null;
};

type InboxPageProps = {
  searchParams?: Promise<{ filter?: string | string[] }>;
};

function getSingle<T>(value: RelatedRow<T>) {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

function getIdentityLabel(identity: IdentityRow | null) {
  return (
    identity?.display_name ||
    identity?.phone_e164 ||
    identity?.external_id ||
    "Unknown contact"
  );
}

function getMessagePreview(message: MessageRow | undefined) {
  if (!message) return "Message";
  if (message.message_type === "text" && message.text_content) {
    return message.text_content;
  }

  const labels: Record<MessageType, string> = {
    text: "Message",
    image: "Image",
    audio: "Audio",
    video: "Video",
    document: "Document",
    reaction: "Reaction",
    unknown: "Message",
  };

  return labels[message.message_type];
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getAttentionVariant(value: ConversationRow["attention_state"]) {
  return value === "needs_reply"
    ? ("warning" as const)
    : value === "waiting_customer"
      ? ("info" as const)
      : ("neutral" as const);
}

function getResolutionVariant(value: IdentityRow["resolution_status"] | undefined) {
  return value === "resolved"
    ? ("success" as const)
    : value === "needs_review"
      ? ("warning" as const)
      : ("neutral" as const);
}

export default async function InboxPage({ searchParams }: InboxPageProps) {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();
  const rawFilter = (await searchParams)?.filter;
  const filter = rawFilter === "all" ? "all" : "needs-reply";

  let conversationsQuery = supabase
    .from("conversations")
    .select(
      `
      id,
      attention_state,
      unread_count,
      last_message_at,
      identity:contact_channel_identities!conversations_contact_identity_id_fkey(
        channel,
        display_name,
        phone_e164,
        external_id,
        resolution_status
      ),
      assigned:app_users!conversations_assigned_user_id_fkey(full_name, email)
    `
    )
    .neq("status", "archived")
    .order("last_message_at", { ascending: false, nullsFirst: false });

  if (filter === "needs-reply") {
    conversationsQuery = conversationsQuery.eq("attention_state", "needs_reply");
  }

  const { data: conversationsData, error: conversationsError } =
    await conversationsQuery;

  if (conversationsError) {
    throw new Error(`Unable to load inbox: ${conversationsError.message}`);
  }

  const conversations = (conversationsData || []) as ConversationRow[];
  const conversationIds = conversations.map((conversation) => conversation.id);
  const latestMessageByConversation = new Map<string, MessageRow>();

  if (conversationIds.length > 0) {
    const { data: messagesData, error: messagesError } = await supabase
      .from("conversation_messages")
      .select("conversation_id,message_type,text_content,occurred_at")
      .in("conversation_id", conversationIds)
      .order("occurred_at", { ascending: false, nullsFirst: false });

    if (messagesError) {
      throw new Error(`Unable to load inbox messages: ${messagesError.message}`);
    }

    for (const message of (messagesData || []) as MessageRow[]) {
      if (!latestMessageByConversation.has(message.conversation_id)) {
        latestMessageByConversation.set(message.conversation_id, message);
      }
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inbox"
        description="Review inbound WhatsApp, Instagram, and Messenger conversations."
      />

      <SectionCard title="Conversations">
        <div className="mb-4 flex items-center gap-2">
          <Button asChild size="sm" variant={filter === "needs-reply" ? "default" : "outline"}>
            <Link href="/operator/inbox?filter=needs-reply">Needs Reply</Link>
          </Button>
          <Button asChild size="sm" variant={filter === "all" ? "default" : "outline"}>
            <Link href="/operator/inbox?filter=all">All</Link>
          </Button>
        </div>

        {conversations.length === 0 ? (
          <EmptyState
            title={filter === "needs-reply" ? "No conversations need a reply" : "No conversations"}
            description={
              filter === "needs-reply"
                ? "New conversations that need attention will appear here."
                : "Non-archived conversations will appear here."
            }
          />
        ) : (
          <TableShell className="rounded-none border-x-0 border-b-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Latest message</TableHead>
                  <TableHead>Attention</TableHead>
                  <TableHead>Resolution</TableHead>
                  <TableHead>Unread</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead className="text-right">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conversations.map((conversation) => {
                  const identity = getSingle(conversation.identity);
                  const assigned = getSingle(conversation.assigned);
                  const latestMessage = latestMessageByConversation.get(conversation.id);

                  return (
                    <TableRow key={conversation.id}>
                      <TableCell className="font-medium">
                        <Link href={`/operator/inbox/${conversation.id}`} className="hover:underline">
                          {getIdentityLabel(identity)}
                        </Link>
                        <div className="mt-1">
                          <Badge>{formatStatusLabel(identity?.channel)}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-sm">
                        <Link
                          href={`/operator/inbox/${conversation.id}`}
                          className="block truncate text-foreground hover:underline"
                        >
                          {getMessagePreview(latestMessage)}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getAttentionVariant(conversation.attention_state)}>
                          {formatStatusLabel(conversation.attention_state)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getResolutionVariant(identity?.resolution_status)}>
                          {formatStatusLabel(identity?.resolution_status)}
                        </Badge>
                      </TableCell>
                      <TableCell>{conversation.unread_count}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {assigned?.full_name || assigned?.email || "Unassigned"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatDateTime(latestMessage?.occurred_at || conversation.last_message_at)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableShell>
        )}
      </SectionCard>
    </div>
  );
}

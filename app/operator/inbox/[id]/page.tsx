import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { ConversationActions } from "@/components/inbox/ConversationActions";
import { AssignmentControl } from "@/components/inbox/AssignmentControl";
import { IdentityPanel } from "@/components/inbox/IdentityPanel";
import { ReplyComposer } from "@/components/inbox/ReplyComposer";
import { requireRole } from "@/lib/auth/require-role";
import type {
  MessageDirection,
  MessageType,
  MessagingChannel,
} from "@/lib/messaging/types";
import { createClient } from "@/lib/supabase/server";
import { formatStatusLabel } from "@/lib/ui/status";
import { getReplyWindowState } from "@/lib/operator/workflows";

type RelatedRow<T> = T | T[] | null;

type IdentityRow = {
  id: string;
  channel: MessagingChannel;
  display_name: string | null;
  phone_e164: string | null;
  external_id: string;
  resolution_status: "unresolved" | "resolved" | "needs_review";
  lead: RelatedRow<{
    id: string;
    full_name: string | null;
    phone: string | null;
    email: string | null;
  }>;
  client: RelatedRow<{
    id: string;
    full_name: string | null;
    company_name: string | null;
    contact_person: string | null;
    phone: string | null;
    email: string | null;
  }>;
};

type AssignedUserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type AssignmentCandidateRow = AssignedUserRow & {
  role: "admin" | "office";
};

type ConversationRow = {
  id: string;
  status: "open" | "resolved" | "archived";
  attention_state: "needs_reply" | "waiting_customer" | "none";
  unread_count: number;
  last_inbound_at: string | null;
  identity: RelatedRow<IdentityRow>;
  assigned: RelatedRow<AssignedUserRow>;
};

type MessageRow = {
  id: string;
  channel: MessagingChannel;
  direction: MessageDirection;
  message_type: MessageType;
  text_content: string | null;
  occurred_at: string | null;
  source_webhook_event_id: string | null;
};

type ConversationPageProps = {
  params: Promise<{ id: string }>;
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

function formatDateTime(value: string | null) {
  if (!value) return "Unknown time";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getMessageContent(message: MessageRow) {
  if (message.text_content) return message.text_content;
  if (message.message_type === "unknown") return "Message";
  return formatStatusLabel(message.message_type);
}

export default async function ConversationPage({ params }: ConversationPageProps) {
  await requireRole(["admin", "office"]);
  const { id } = await params;
  const supabase = await createClient();

  const { data: conversationData, error: conversationError } = await supabase
    .from("conversations")
    .select(
      `
      id,
      status,
      attention_state,
      unread_count,
      last_inbound_at,
      identity:contact_channel_identities!conversations_contact_identity_id_fkey(
        id,
        channel,
        display_name,
        phone_e164,
        external_id,
        resolution_status,
        lead:leads!contact_channel_identities_lead_id_fkey(id, full_name, phone, email),
        client:clients!contact_channel_identities_client_id_fkey(
          id,
          full_name,
          company_name,
          contact_person,
          phone,
          email
        )
      ),
      assigned:app_users!conversations_assigned_user_id_fkey(id, full_name, email)
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (conversationError || !conversationData) {
    notFound();
  }

  const conversation = conversationData as ConversationRow;
  const identity = getSingle(conversation.identity);
  const assigned = getSingle(conversation.assigned);
  const lead = getSingle(identity?.lead || null);
  const client = getSingle(identity?.client || null);
  const [
    { data: messagesData, error: messagesError },
    { data: candidatesData, error: candidatesError },
  ] = await Promise.all([
    supabase
      .from("conversation_messages")
      .select("id,channel,direction,message_type,text_content,occurred_at,source_webhook_event_id")
      .eq("conversation_id", id)
      .order("occurred_at", { ascending: true, nullsFirst: false }),
    supabase
      .from("app_users")
      .select("id,full_name,email,role")
      .eq("is_active", true)
      .in("role", ["admin", "office"])
      .order("full_name", { ascending: true }),
  ]);

  if (messagesError) {
    throw new Error(`Unable to load conversation messages: ${messagesError.message}`);
  }

  if (candidatesError) {
    throw new Error(`Unable to load assignment candidates: ${candidatesError.message}`);
  }

  const messages = (messagesData || []) as MessageRow[];
  const candidateRows = (candidatesData || []) as AssignmentCandidateRow[];
  const { data: agentPrincipalsData, error: agentPrincipalsError } =
    candidateRows.length > 0
      ? await supabase
          .from("agent_principals")
          .select("id")
          .in("id", candidateRows.map((candidate) => candidate.id))
      : { data: [], error: null };

  if (agentPrincipalsError) {
    throw new Error(
      `Unable to validate assignment candidates: ${agentPrincipalsError.message}`
    );
  }

  const agentPrincipalIds = new Set(
    (agentPrincipalsData || []).map((principal) => principal.id)
  );
  const candidates = candidateRows.filter(
    (candidate) => !agentPrincipalIds.has(candidate.id)
  );
  const replyWindow = getReplyWindowState(conversation.last_inbound_at);

  return (
    <div className="space-y-6">
      <PageHeader
        title={getIdentityLabel(identity)}
        description="Read-only normalized message history."
        actions={
          <Button asChild variant="outline">
            <Link href="/operator/inbox">Back to Inbox</Link>
          </Button>
        }
      />

      <SectionCard title="Conversation context">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Attention</dt>
            <dd className="mt-1"><Badge>{formatStatusLabel(conversation.attention_state)}</Badge></dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Unread</dt>
            <dd className="mt-1 text-sm font-medium">{conversation.unread_count}</dd>
          </div>
        </dl>
      </SectionCard>

      {identity ? (
        <IdentityPanel
          conversationId={conversation.id}
          identityId={identity.id}
          channel={identity.channel}
          resolutionStatus={identity.resolution_status}
          lead={
            lead
              ? {
                  id: lead.id,
                  displayName: lead.full_name || "Unnamed lead",
                  phone: lead.phone,
                  email: lead.email,
                }
              : null
          }
          client={
            client
              ? {
                  id: client.id,
                  displayName:
                    client.full_name ||
                    client.company_name ||
                    client.contact_person ||
                    "Unnamed client",
                  phone: client.phone,
                  email: client.email,
                }
              : null
          }
        />
      ) : null}

      <AssignmentControl
        conversationId={conversation.id}
        status={conversation.status}
        assigned={assigned}
        candidates={candidates}
      />

      <ConversationActions
        conversationId={conversation.id}
        status={conversation.status}
        attentionState={conversation.attention_state}
        unreadCount={conversation.unread_count}
      />

      {conversation.status !== "archived" ? (
        <ReplyComposer conversationId={conversation.id} replyWindow={replyWindow} />
      ) : null}

      <SectionCard title="Messages" description="Oldest to newest">
        {messages.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            No normalized messages are available for this conversation.
          </p>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <article
                key={message.id}
                className={`max-w-2xl rounded-xl border p-4 ${
                  message.direction === "outbound" ? "ml-auto bg-muted/40" : "mr-auto bg-card"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={message.direction === "inbound" ? "info" : "neutral"}>
                    {message.direction}
                  </Badge>
                  {message.direction === "outbound" && message.source_webhook_event_id === null ? (
                    <Badge variant="success">Provider accepted · recorded</Badge>
                  ) : null}
                  <Badge>{formatStatusLabel(message.message_type)}</Badge>
                  {message.channel !== identity?.channel ? (
                    <Badge>{formatStatusLabel(message.channel)}</Badge>
                  ) : null}
                </div>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm text-foreground">
                  {getMessageContent(message)}
                </p>
                <time className="mt-3 block text-xs text-muted-foreground" dateTime={message.occurred_at || undefined}>
                  {formatDateTime(message.occurred_at)}
                </time>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
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
import {
  buildInboxHref,
  formatConversationAge,
  getAgeCutoff,
  INBOX_PAGE_SIZE,
  parseInboxFilters,
  type InboxFilters,
} from "@/lib/operator/workflows";

type RelatedRow<T> = T | T[] | null;

type IdentityRow = {
  channel: MessagingChannel;
  display_name: string | null;
  phone_e164: string | null;
  external_id: string;
  resolution_status: "unresolved" | "resolved" | "needs_review";
};

type AssignedUserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role?: "admin" | "office";
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
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSingle<T>(value: RelatedRow<T>) {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

function getIdentityLabel(identity: IdentityRow | null) {
  return identity?.display_name || identity?.phone_e164 || identity?.external_id || "Unknown contact";
}

function getMessagePreview(message: MessageRow | undefined) {
  if (!message) return "No normalized preview";
  if (message.message_type === "text" && message.text_content) return message.text_content;
  return formatStatusLabel(message.message_type === "unknown" ? "message" : message.message_type);
}

function formatDateTime(value: string | null) {
  if (!value) return "Unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function getAttentionVariant(value: ConversationRow["attention_state"]) {
  if (value === "needs_reply") return "warning" as const;
  if (value === "waiting_customer") return "info" as const;
  return "neutral" as const;
}

function getResolutionVariant(value: IdentityRow["resolution_status"] | undefined) {
  if (value === "resolved") return "success" as const;
  if (value === "needs_review") return "warning" as const;
  return "neutral" as const;
}

function ActiveTab({
  label,
  value,
  filters,
}: {
  label: string;
  value: InboxFilters["filter"];
  filters: InboxFilters;
}) {
  const active = filters.filter === value;
  return (
    <Button asChild size="sm" variant={active ? "default" : "outline"}>
      <Link href={buildInboxHref(filters, { filter: value, page: 1 })} aria-current={active ? "page" : undefined}>{label}</Link>
    </Button>
  );
}

export default async function InboxPage({ searchParams }: InboxPageProps) {
  const current = await requireRole(["admin", "office"]);
  const supabase = await createClient();
  const filters = parseInboxFilters((await searchParams) || {});
  const nowMs = new Date().getTime();
  const from = (filters.page - 1) * INBOX_PAGE_SIZE;
  const to = from + INBOX_PAGE_SIZE - 1;

  let conversationsQuery = supabase
    .from("conversations")
    .select(
      `
      id,
      attention_state,
      unread_count,
      last_message_at,
      identity:contact_channel_identities!conversations_contact_identity_id_fkey!inner(
        channel,
        display_name,
        phone_e164,
        external_id,
        resolution_status
      ),
      assigned:app_users!conversations_assigned_user_id_fkey(id, full_name, email)
    `,
      { count: "exact" }
    )
    .neq("status", "archived");

  if (filters.filter === "needs-reply") conversationsQuery = conversationsQuery.eq("attention_state", "needs_reply");
  if (filters.filter === "waiting-customer") conversationsQuery = conversationsQuery.eq("attention_state", "waiting_customer");
  if (filters.filter === "identity-review") conversationsQuery = conversationsQuery.eq("identity.resolution_status", "needs_review");
  if (filters.unread === "unread") conversationsQuery = conversationsQuery.gt("unread_count", 0);
  if (filters.channel !== "all") conversationsQuery = conversationsQuery.eq("identity.channel", filters.channel);
  if (filters.assigned === "me") conversationsQuery = conversationsQuery.eq("assigned_user_id", current.authUser.id);
  else if (filters.assigned === "unassigned") conversationsQuery = conversationsQuery.is("assigned_user_id", null);
  else if (filters.assigned !== "all") conversationsQuery = conversationsQuery.eq("assigned_user_id", filters.assigned);

  const cutoff = getAgeCutoff(filters.age, nowMs);
  if (cutoff) conversationsQuery = conversationsQuery.lte("last_message_at", cutoff);

  if (filters.q) {
    const escaped = filters.q.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/[%_]/g, "\\$&");
    conversationsQuery = conversationsQuery.or(
      `display_name.ilike.%${escaped}%,phone_e164.ilike.%${escaped}%,external_id.ilike.%${escaped}%`,
      { referencedTable: "identity" }
    );
  }

  const [{ data: conversationsData, error: conversationsError, count }, candidatesResult] = await Promise.all([
    conversationsQuery
      .order("last_message_at", { ascending: filters.sort === "oldest", nullsFirst: false })
      .range(from, to),
    supabase.from("app_users").select("id,full_name,email,role").eq("is_active", true).in("role", ["admin", "office"]).order("full_name", { ascending: true }),
  ]);

  if (conversationsError) throw new Error(`Unable to load inbox: ${conversationsError.message}`);
  if (candidatesResult.error) throw new Error(`Unable to load inbox assignees: ${candidatesResult.error.message}`);

  const candidateRows = (candidatesResult.data || []) as AssignedUserRow[];
  const agentResult = candidateRows.length
    ? await supabase.from("agent_principals").select("id").in("id", candidateRows.map((candidate) => candidate.id))
    : { data: [], error: null };
  if (agentResult.error) throw new Error(`Unable to validate inbox assignees: ${agentResult.error.message}`);
  const agentIds = new Set((agentResult.data || []).map((agent) => agent.id));
  const candidates = candidateRows.filter((candidate) => !agentIds.has(candidate.id));

  const conversations = (conversationsData || []) as ConversationRow[];
  const conversationIds = conversations.map((conversation) => conversation.id);
  const latestMessageByConversation = new Map<string, MessageRow>();
  if (conversationIds.length > 0) {
    const { data: messagesData, error: messagesError } = await supabase
      .from("conversation_messages")
      .select("conversation_id,message_type,text_content,occurred_at")
      .in("conversation_id", conversationIds)
      .order("occurred_at", { ascending: false, nullsFirst: false });
    if (messagesError) throw new Error(`Unable to load inbox messages: ${messagesError.message}`);
    for (const message of (messagesData || []) as MessageRow[]) {
      if (!latestMessageByConversation.has(message.conversation_id)) latestMessageByConversation.set(message.conversation_id, message);
    }
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / INBOX_PAGE_SIZE));
  const hasExtraFilters = Boolean(filters.q || filters.unread !== "all" || filters.channel !== "all" || filters.assigned !== "all" || filters.age !== "all");

  return (
    <main className="space-y-6">
      <PageHeader
        title="Inbox"
        description="Search, triage, assign, and age inbound WhatsApp, Instagram, and Messenger conversations."
        actions={<Button asChild variant="outline"><Link href="/operator/review">Review queue</Link></Button>}
      />

      <SectionCard title="Conversation workspace" description={`${total} conversations match the current full-queue filters.`}>
        <div className="flex flex-wrap gap-2" aria-label="Inbox attention filters">
          <ActiveTab label="Needs reply" value="needs-reply" filters={filters} />
          <ActiveTab label="Waiting on customer" value="waiting-customer" filters={filters} />
          <ActiveTab label="Identity review" value="identity-review" filters={filters} />
          <ActiveTab label="All" value="all" filters={filters} />
        </div>

        <form className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_repeat(5,minmax(130px,auto))_auto]" role="search">
          <input type="hidden" name="filter" value={filters.filter} />
          <div className="space-y-2 sm:col-span-2 xl:col-span-1">
            <label htmlFor="inbox-q" className="text-sm font-medium">Search contacts</label>
            <Input id="inbox-q" name="q" defaultValue={filters.q} placeholder="Name, phone, or channel ID" maxLength={80} />
          </div>
          <div className="space-y-2"><label htmlFor="inbox-unread" className="text-sm font-medium">Read state</label><select id="inbox-unread" name="unread" defaultValue={filters.unread} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="all">All</option><option value="unread">Unread only</option></select></div>
          <div className="space-y-2"><label htmlFor="inbox-channel" className="text-sm font-medium">Channel</label><select id="inbox-channel" name="channel" defaultValue={filters.channel} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="all">All channels</option><option value="whatsapp">WhatsApp</option><option value="instagram">Instagram</option><option value="messenger">Messenger</option></select></div>
          <div className="space-y-2"><label htmlFor="inbox-assigned" className="text-sm font-medium">Assigned</label><select id="inbox-assigned" name="assigned" defaultValue={filters.assigned} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="all">Anyone</option><option value="me">Assigned to me</option><option value="unassigned">Unassigned</option>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.full_name || candidate.email || "Unnamed operator"}</option>)}</select></div>
          <div className="space-y-2"><label htmlFor="inbox-age" className="text-sm font-medium">Aging</label><select id="inbox-age" name="age" defaultValue={filters.age} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="all">Any age</option><option value="24h">Older than 24h</option><option value="72h">Older than 72h</option></select></div>
          <div className="space-y-2"><label htmlFor="inbox-sort" className="text-sm font-medium">Sort</label><select id="inbox-sort" name="sort" defaultValue={filters.sort} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></div>
          <div className="flex flex-wrap items-end gap-2"><Button type="submit">Apply</Button><Button asChild variant="outline"><Link href={`/operator/inbox?filter=${filters.filter}`}>Clear</Link></Button></div>
        </form>

        <p className="mt-4 text-sm text-muted-foreground" role="status" aria-live="polite">
          Showing {conversations.length} of {total} matching conversations. Page {Math.min(filters.page, totalPages)} of {totalPages}.
        </p>

        {conversations.length === 0 ? (
          <EmptyState
            title={hasExtraFilters || filters.page > totalPages ? "No conversations match these filters" : filters.filter === "needs-reply" ? "No conversations need a reply" : filters.filter === "identity-review" ? "No identities need review" : "No conversations in this queue"}
            description={hasExtraFilters || filters.page > totalPages ? "The inbox is configured, but this search and filter combination has no rows. Clear filters or return to the first page." : "The inbox is configured and currently clear for this state. New normalized conversations will appear here."}
            action={<Button asChild variant="outline"><Link href={`/operator/inbox?filter=${filters.filter}`}>Clear filters</Link></Button>}
          />
        ) : (
          <>
            <div className="mt-4 grid gap-3 md:hidden">
              {conversations.map((conversation) => {
                const identity = getSingle(conversation.identity);
                const assigned = getSingle(conversation.assigned);
                const latestMessage = latestMessageByConversation.get(conversation.id);
                return (
                  <article key={conversation.id} className="rounded-xl border p-4">
                    <div className="flex flex-wrap items-center gap-2"><Badge>{formatStatusLabel(identity?.channel)}</Badge><Badge variant={getAttentionVariant(conversation.attention_state)}>{formatStatusLabel(conversation.attention_state)}</Badge>{conversation.unread_count > 0 ? <Badge variant="info">{conversation.unread_count} unread</Badge> : null}</div>
                    <h2 className="mt-3 font-medium"><Link href={`/operator/inbox/${conversation.id}`} className="hover:underline">{getIdentityLabel(identity)}</Link></h2>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{getMessagePreview(latestMessage)}</p>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs"><div><dt className="text-muted-foreground">Identity</dt><dd><Badge variant={getResolutionVariant(identity?.resolution_status)}>{formatStatusLabel(identity?.resolution_status)}</Badge></dd></div><div><dt className="text-muted-foreground">Assigned</dt><dd className="break-words">{assigned?.full_name || assigned?.email || "Unassigned"}</dd></div><div className="col-span-2"><dt className="text-muted-foreground">Aging</dt><dd>{formatConversationAge(latestMessage?.occurred_at || conversation.last_message_at, nowMs)} · {formatDateTime(latestMessage?.occurred_at || conversation.last_message_at)}</dd></div></dl>
                    <Button asChild size="sm" className="mt-4 w-full"><Link href={`/operator/inbox/${conversation.id}`}>Open conversation</Link></Button>
                  </article>
                );
              })}
            </div>

            <TableShell className="mt-4 hidden rounded-none border-x-0 border-b-0 md:block">
              <Table>
                <TableHeader><TableRow><TableHead>Contact</TableHead><TableHead>Latest message</TableHead><TableHead>Attention</TableHead><TableHead>Identity</TableHead><TableHead>Unread</TableHead><TableHead>Assigned</TableHead><TableHead>Aging</TableHead></TableRow></TableHeader>
                <TableBody>
                  {conversations.map((conversation) => {
                    const identity = getSingle(conversation.identity);
                    const assigned = getSingle(conversation.assigned);
                    const latestMessage = latestMessageByConversation.get(conversation.id);
                    const occurredAt = latestMessage?.occurred_at || conversation.last_message_at;
                    return (
                      <TableRow key={conversation.id}>
                        <TableCell className="font-medium"><Link href={`/operator/inbox/${conversation.id}`} className="hover:underline">{getIdentityLabel(identity)}</Link><div className="mt-1"><Badge>{formatStatusLabel(identity?.channel)}</Badge></div></TableCell>
                        <TableCell className="max-w-xs"><Link href={`/operator/inbox/${conversation.id}`} className="block truncate hover:underline">{getMessagePreview(latestMessage)}</Link></TableCell>
                        <TableCell><Badge variant={getAttentionVariant(conversation.attention_state)}>{formatStatusLabel(conversation.attention_state)}</Badge></TableCell>
                        <TableCell><Badge variant={getResolutionVariant(identity?.resolution_status)}>{formatStatusLabel(identity?.resolution_status)}</Badge></TableCell>
                        <TableCell>{conversation.unread_count}</TableCell>
                        <TableCell className="text-muted-foreground">{assigned?.full_name || assigned?.email || "Unassigned"}</TableCell>
                        <TableCell><div>{formatConversationAge(occurredAt, nowMs)}</div><div className="mt-1 whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(occurredAt)}</div></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableShell>
          </>
        )}

        {totalPages > 1 ? (
          <nav className="mt-4 flex flex-wrap items-center justify-between gap-3" aria-label="Inbox pages">
            {filters.page > 1 ? <Button asChild variant="outline" size="sm"><Link href={buildInboxHref(filters, { page: filters.page - 1 })}>Previous</Link></Button> : <Button variant="outline" size="sm" disabled>Previous</Button>}
            <span className="text-sm text-muted-foreground">Page {Math.min(filters.page, totalPages)} of {totalPages}</span>
            {filters.page < totalPages ? <Button asChild variant="outline" size="sm"><Link href={buildInboxHref(filters, { page: filters.page + 1 })}>Next</Link></Button> : <Button variant="outline" size="sm" disabled>Next</Button>}
          </nav>
        ) : null}
      </SectionCard>
    </main>
  );
}

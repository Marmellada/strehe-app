import type { AppRole } from "@/lib/auth/roles";

export const INBOX_PAGE_SIZE = 25;
export const REPLY_WINDOW_HOURS = 24;

export type OperatorAttentionCounts = {
  inboxNeedsReply: number;
  agentAwaitingReview: number;
  escalatedTasks: number;
  overdueTasks: number;
  identitiesNeedingReview: number;
  offersNeedingAttention: number;
  followUpsDue: number;
};

export function buildOperatorAttentionCounts(input: {
  inboxNeedsReply: number | null;
  agentAwaitingReview: number | null;
  escalatedTasks: number | null;
  overdueTasks: number | null;
  identitiesNeedingReview: number | null;
  offersNeedingAttention: number | null;
  followUpsDue: number | null;
}): OperatorAttentionCounts {
  return {
    inboxNeedsReply: input.inboxNeedsReply ?? 0,
    agentAwaitingReview: input.agentAwaitingReview ?? 0,
    escalatedTasks: input.escalatedTasks ?? 0,
    overdueTasks: input.overdueTasks ?? 0,
    identitiesNeedingReview: input.identitiesNeedingReview ?? 0,
    offersNeedingAttention: input.offersNeedingAttention ?? 0,
    followUpsDue: input.followUpsDue ?? 0,
  };
}

export type InboxFilters = {
  filter: "needs-reply" | "waiting-customer" | "identity-review" | "all";
  unread: "all" | "unread";
  channel: "all" | "whatsapp" | "instagram" | "messenger";
  assigned: string;
  age: "all" | "24h" | "72h";
  sort: "newest" | "oldest";
  q: string;
  page: number;
};

type RawInboxFilters = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function oneOf<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  fallback: T
) {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function canViewOperatorWorkflows(role: AppRole) {
  return role === "admin" || role === "office";
}

export function canResolveOperatorReviews(role: AppRole) {
  return role === "admin";
}

export function getRoleReturnDestination(role: AppRole) {
  if (role === "field" || role === "contractor") {
    return { href: "/tasks?assigned=me", label: "Go to my tasks" };
  }

  return { href: "/dashboard", label: "Go to dashboard" };
}

export function getRoleAccessMessage(role: AppRole) {
  switch (role) {
    case "admin":
      return "Your admin account can use operator workspaces. Return to the dashboard and choose an available workspace.";
    case "office":
      return "Your office account can monitor operator workspaces, but admin-only resolution controls remain unavailable.";
    case "field":
      return "Field accounts can use assigned tasks and key-custody workspaces. Inbox and review queues are limited to office operators.";
    case "contractor":
      return "Contractor accounts can use assigned tasks. Inbox, review queues, and business administration are not available.";
    case "household":
      return "This business operator area is not configured for household accounts. No household self-service workspace is enabled in this release.";
  }
}

export function getDashboardSectionOrder(role: AppRole) {
  if (canViewOperatorWorkflows(role)) {
    return ["exceptions", "daily-work", "overview"] as const;
  }

  if (role === "household") return ["not-configured"] as const;
  return ["my-exceptions", "my-work"] as const;
}

export function parseInboxFilters(raw: RawInboxFilters = {}): InboxFilters {
  const pageValue = Number(first(raw.page) || "1");
  const assignedValue = (first(raw.assigned) || "all").trim();

  return {
    filter: oneOf(
      first(raw.filter),
      ["needs-reply", "waiting-customer", "identity-review", "all"] as const,
      "needs-reply"
    ),
    unread: oneOf(first(raw.unread), ["all", "unread"] as const, "all"),
    channel: oneOf(
      first(raw.channel),
      ["all", "whatsapp", "instagram", "messenger"] as const,
      "all"
    ),
    assigned:
      assignedValue === "all" ||
      assignedValue === "me" ||
      assignedValue === "unassigned" ||
      /^[0-9a-f-]{36}$/i.test(assignedValue)
        ? assignedValue
        : "all",
    age: oneOf(first(raw.age), ["all", "24h", "72h"] as const, "all"),
    sort: oneOf(first(raw.sort), ["newest", "oldest"] as const, "newest"),
    q: (first(raw.q) || "").trim().slice(0, 80),
    page: Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1,
  };
}

export function buildInboxHref(
  filters: InboxFilters,
  overrides: Partial<InboxFilters> = {}
) {
  const next = { ...filters, ...overrides };
  const search = new URLSearchParams();

  search.set("filter", next.filter);
  if (next.unread !== "all") search.set("unread", next.unread);
  if (next.channel !== "all") search.set("channel", next.channel);
  if (next.assigned !== "all") search.set("assigned", next.assigned);
  if (next.age !== "all") search.set("age", next.age);
  if (next.sort !== "newest") search.set("sort", next.sort);
  if (next.q) search.set("q", next.q);
  if (next.page > 1) search.set("page", String(next.page));

  return `/operator/inbox?${search.toString()}`;
}

export function getAgeCutoff(age: InboxFilters["age"], nowMs = Date.now()) {
  if (age === "all") return null;
  const hours = age === "72h" ? 72 : 24;
  return new Date(nowMs - hours * 60 * 60 * 1000).toISOString();
}

export function formatConversationAge(
  value: string | null | undefined,
  nowMs = Date.now()
) {
  if (!value) return "Age unknown";
  const occurredMs = Date.parse(value);
  if (!Number.isFinite(occurredMs)) return "Age unknown";
  const hours = Math.max(0, Math.floor((nowMs - occurredMs) / 3_600_000));
  if (hours < 1) return "Less than 1h old";
  if (hours < 24) return `${hours}h old`;
  const days = Math.floor(hours / 24);
  return `${days}d old`;
}

export function getReplyWindowState(
  lastInboundAt: string | null | undefined,
  nowMs = Date.now()
) {
  if (!lastInboundAt) {
    return {
      isOpen: false,
      closesAt: null,
      reason: "No inbound message is available to establish the 24-hour reply window.",
    };
  }

  const inboundMs = Date.parse(lastInboundAt);
  if (!Number.isFinite(inboundMs)) {
    return {
      isOpen: false,
      closesAt: null,
      reason: "The latest inbound message time is invalid, so sending is disabled.",
    };
  }

  const closesAtMs = inboundMs + REPLY_WINDOW_HOURS * 60 * 60 * 1000;
  const isOpen = closesAtMs > nowMs;
  return {
    isOpen,
    closesAt: new Date(closesAtMs).toISOString(),
    reason: isOpen
      ? "A plain-text reply can be sent inside the current 24-hour messaging window."
      : "The 24-hour messaging window has closed. This inbox does not send templates or bypass channel policy.",
  };
}

export function getEngineeringJobHref(jobId: string) {
  return `/operator/agents/jobs/${jobId}`;
}

export function formatReviewProvenance(input: {
  decision: string | null;
  reviewedAt: string | null;
  reviewerName: string | null;
  reviewerEmail: string | null;
}) {
  if (!input.decision || !input.reviewedAt) return "Awaiting a recorded decision";
  const reviewer = input.reviewerName || input.reviewerEmail || "Unknown reviewer";
  return `${reviewer} ${input.decision} this job at ${input.reviewedAt}`;
}

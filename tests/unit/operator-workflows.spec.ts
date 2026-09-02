import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { APP_ROLES, isAppRole } from "@/lib/auth/roles";
import {
  buildInboxHref,
  buildOperatorAttentionCounts,
  canResolveOperatorReviews,
  canViewOperatorWorkflows,
  formatConversationAge,
  formatReviewProvenance,
  getDashboardSectionOrder,
  getEngineeringJobHref,
  getReplyWindowState,
  getRoleReturnDestination,
  parseInboxFilters,
} from "@/lib/operator/workflows";
import {
  parseEngineeringReviewJob,
  parseEngineeringReviewQueue,
} from "@/lib/agents/review-queue";

test("operator workflow visibility is admin/office-only and resolution stays admin-only", () => {
  expect(APP_ROLES).toEqual(["admin", "office", "field", "contractor", "household"]);
  expect(isAppRole("household")).toBe(true);
  for (const role of APP_ROLES) {
    expect(canViewOperatorWorkflows(role)).toBe(role === "admin" || role === "office");
    expect(canResolveOperatorReviews(role)).toBe(role === "admin");
  }
});

test("permission-denied return destinations adapt to field, contractor, and household roles", () => {
  expect(getRoleReturnDestination("field")).toEqual({ href: "/tasks?assigned=me", label: "Go to my tasks" });
  expect(getRoleReturnDestination("contractor")).toEqual({ href: "/tasks?assigned=me", label: "Go to my tasks" });
  expect(getRoleReturnDestination("household")).toEqual({ href: "/dashboard", label: "Go to dashboard" });
});

test("dashboard section ordering puts operator exceptions first and adapts non-operator roles", () => {
  expect(getDashboardSectionOrder("admin")).toEqual(["exceptions", "daily-work", "overview"]);
  expect(getDashboardSectionOrder("office")).toEqual(["exceptions", "daily-work", "overview"]);
  expect(getDashboardSectionOrder("field")).toEqual(["my-exceptions", "my-work"]);
  expect(getDashboardSectionOrder("contractor")).toEqual(["my-exceptions", "my-work"]);
  expect(getDashboardSectionOrder("household")).toEqual(["not-configured"]);
});

test("attention categories preserve independent exact counts and never use preview length", () => {
  expect(buildOperatorAttentionCounts({
    inboxNeedsReply: 31,
    agentAwaitingReview: 7,
    escalatedTasks: 5,
    overdueTasks: 13,
    identitiesNeedingReview: 3,
    offersNeedingAttention: 11,
    followUpsDue: 17,
  })).toEqual({
    inboxNeedsReply: 31,
    agentAwaitingReview: 7,
    escalatedTasks: 5,
    overdueTasks: 13,
    identitiesNeedingReview: 3,
    offersNeedingAttention: 11,
    followUpsDue: 17,
  });
});

test("inbox filters normalize invalid input and preserve selectable filters in links", () => {
  const filters = parseInboxFilters({
    filter: "identity-review",
    unread: "unread",
    channel: "instagram",
    assigned: "me",
    age: "72h",
    sort: "oldest",
    q: "  Ada  ",
    page: "3",
  });
  expect(filters).toEqual({
    filter: "identity-review",
    unread: "unread",
    channel: "instagram",
    assigned: "me",
    age: "72h",
    sort: "oldest",
    q: "Ada",
    page: 3,
  });
  expect(buildInboxHref(filters, { page: 1 })).toContain("filter=identity-review");
  expect(buildInboxHref(filters, { page: 1 })).toContain("channel=instagram");
  expect(parseInboxFilters({ filter: "bad", page: "-9", assigned: "bad" })).toMatchObject({ filter: "needs-reply", page: 1, assigned: "all" });
});

test("aging labels and the 24-hour outbound window have deterministic boundaries", () => {
  const now = Date.parse("2026-09-02T12:00:00Z");
  expect(formatConversationAge("2026-09-02T10:30:00Z", now)).toBe("1h old");
  expect(formatConversationAge("2026-08-31T11:00:00Z", now)).toBe("2d old");
  expect(getReplyWindowState("2026-09-01T12:00:01Z", now).isOpen).toBe(true);
  expect(getReplyWindowState("2026-09-01T12:00:00Z", now).isOpen).toBe(false);
  expect(getReplyWindowState(null, now).isOpen).toBe(false);
});

test("review queue keeps its exact pending count separate from its bounded preview", () => {
  const queue = parseEngineeringReviewQueue({
    configured: true,
    pending_count: 9,
    jobs: [{ id: "11111111-1111-4111-8111-111111111111", status: "awaiting_review" }],
    recent_decisions: [],
  });
  expect(queue.configured).toBe(true);
  expect(queue.pending_count).toBe(9);
  expect(queue.jobs).toHaveLength(1);
  expect(getEngineeringJobHref(queue.jobs[0].id)).toBe("/operator/agents/jobs/11111111-1111-4111-8111-111111111111");
});

test("job detail parsing and provenance surface who decided what and when", () => {
  const detail = parseEngineeringReviewJob({
    id: "22222222-2222-4222-8222-222222222222",
    status: "completed",
    review_decision: "approved",
    reviewed_at: "2026-09-02T10:15:00Z",
    reviewer_name: "Admin Operator",
    findings: [{ summary: "Verified" }],
  });
  expect(detail?.findings).toHaveLength(1);
  expect(formatReviewProvenance({
    decision: detail?.review_decision || null,
    reviewedAt: detail?.reviewed_at || null,
    reviewerName: detail?.reviewer_name || null,
    reviewerEmail: detail?.reviewer_email || null,
  })).toBe("Admin Operator approved this job at 2026-09-02T10:15:00Z");
});

test("touched surfaces include mobile variants, keyboard focus, and screen-reader announcements", async () => {
  const [inbox, dashboard, review, shell, loading, migration, actions] = await Promise.all([
    readFile("app/operator/inbox/page.tsx", "utf8"),
    readFile("app/dashboard/page.tsx", "utf8"),
    readFile("app/operator/review/page.tsx", "utf8"),
    readFile("components/layout/AppShell.tsx", "utf8"),
    readFile("components/ui/RouteLoading.tsx", "utf8"),
    readFile("supabase/migrations/20260902190000_operator_workflow_read_models.sql", "utf8"),
    readFile("app/operator/agents/actions.ts", "utf8"),
  ]);
  expect(inbox).toContain("md:hidden");
  expect(inbox).toContain("hidden rounded-none border-x-0 border-b-0 md:block");
  expect(inbox).toContain('aria-label="Inbox pages"');
  expect(dashboard).toContain("sm:grid-cols-2 xl:grid-cols-4");
  expect(review).toContain("focus-visible:ring-2");
  expect(shell).toContain('aria-live="polite"');
  expect(loading).toContain('aria-busy="true"');
  expect(migration).toContain("role in ('admin', 'office')");
  expect(migration).toContain("required_capability = 'engineering.local'");
  expect(actions).toContain('await requireRole(["admin"])');
});

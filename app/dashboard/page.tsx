import Link from "next/link";
import {
  Button,
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from "@/components/ui";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { createPerfTimer } from "@/lib/perf";
import { loadOperatorAttention } from "@/lib/operator/attention-data";
import {
  getDashboardSectionOrder,
  getEngineeringJobHref,
} from "@/lib/operator/workflows";

type TaskRow = {
  id: string;
  title: string | null;
  status: string | null;
  due_date: string | null;
  property_code_snapshot: string | null;
};

type InboxRow = {
  id: string;
  last_message_at: string | null;
  unread_count: number;
  identity:
    | { display_name: string | null; phone_e164: string | null; external_id: string }
    | Array<{ display_name: string | null; phone_e164: string | null; external_id: string }>
    | null;
};

type OfferRow = {
  id: string;
  offer_number: string;
  status: string;
  follow_up_date: string | null;
  valid_until: string | null;
  lead:
    | { id: string; full_name: string | null }
    | Array<{ id: string; full_name: string | null }>
    | null;
};

function getSingle<T>(value: T | T[] | null) {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function DecisionCard({
  title,
  count,
  description,
  href,
  tone = "default",
}: {
  title: string;
  count: number;
  description: string;
  href: string;
  tone?: "default" | "warning";
}) {
  return (
    <Link
      href={href}
      className={`rounded-xl border p-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        tone === "warning"
          ? "border-amber-300/60 bg-amber-50/5 hover:border-amber-300"
          : "bg-card hover:border-muted-foreground/40 hover:bg-muted/30"
      }`}
      aria-label={`${title}: ${count}. ${description}`}
    >
      <div className="text-2xl font-semibold" aria-hidden="true">{count}</div>
      <h3 className="mt-2 font-medium">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}

function WorkRow({
  title,
  meta,
  href,
  status,
}: {
  title: string;
  meta: string;
  href: string;
  status?: string | null;
}) {
  return (
    <div className="flex flex-col gap-3 border-t py-3 first:border-t-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="break-words font-medium">{title}</div>
        <div className="mt-1 text-sm text-muted-foreground">{meta}</div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {status ? <StatusBadge status={status} /> : null}
        <Button asChild size="sm" variant="ghost"><Link href={href}>Open</Link></Button>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const perf = createPerfTimer("page.dashboard");
  const { authUser, appUser } = await requireRole([
    "admin",
    "office",
    "field",
    "contractor",
    "household",
  ]);
  perf.mark("requireRole");
  const sectionOrder = getDashboardSectionOrder(appUser.role);

  if (appUser.role === "household") {
    perf.finish({ role: appUser.role, state: sectionOrder[0] });
    return (
      <main className="space-y-6">
        <PageHeader
          title="Dashboard"
          description="This account is active, but no household self-service workspace is configured in this release."
        />
        <EmptyState
          title="Household workspace not configured"
          description="Your account does not have access to the business operator dashboard, inbox, agent reviews, or staff tasks. Contact STREHË if you expected a different account role."
          action={<Button asChild variant="outline"><Link href="/auth/logout">Switch account</Link></Button>}
        />
      </main>
    );
  }

  const supabase = await createClient();
  perf.mark("createClient");
  const todayIso = new Date().toISOString().slice(0, 10);
  const isOperator = appUser.role === "admin" || appUser.role === "office";

  if (!isOperator) {
    const [openResult, escalatedResult, overdueResult, tasksResult] = await Promise.all([
      supabase.from("tasks").select("id", { count: "exact", head: true }).eq("assigned_user_id", authUser.id).in("status", ["open", "in_progress", "escalated", "blocked"]),
      supabase.from("tasks").select("id", { count: "exact", head: true }).eq("assigned_user_id", authUser.id).in("status", ["escalated", "blocked"]),
      supabase.from("tasks").select("id", { count: "exact", head: true }).eq("assigned_user_id", authUser.id).lt("due_date", todayIso).in("status", ["open", "in_progress", "escalated", "blocked"]),
      supabase.from("tasks").select("id,title,status,due_date,property_code_snapshot").eq("assigned_user_id", authUser.id).in("status", ["open", "in_progress", "escalated", "blocked"]).order("due_date", { ascending: true, nullsFirst: false }).limit(10),
    ]);
    const failed = [openResult.error, escalatedResult.error, overdueResult.error, tasksResult.error].find(Boolean);
    if (failed) throw new Error(`Unable to load assigned work dashboard: ${failed.message}`);
    const tasks = (tasksResult.data || []) as TaskRow[];
    perf.finish({ role: appUser.role, state: sectionOrder.join(","), tasks: tasks.length });

    return (
      <main className="space-y-6">
        <PageHeader
          title="My daily work"
          description="Your exceptions and assigned work only. Office inbox and review queues are not available to this role."
          actions={<Button asChild><Link href="/tasks?assigned=me">Open my tasks</Link></Button>}
        />
        <section aria-labelledby="my-exceptions-heading" className="space-y-3">
          <h2 id="my-exceptions-heading" className="text-lg font-semibold">My exceptions</h2>
          <div className="grid gap-3 sm:grid-cols-3" role="status" aria-live="polite">
            <DecisionCard title="Open work" count={openResult.count ?? 0} description="All active tasks assigned to you." href="/tasks?assigned=me" />
            <DecisionCard title="Escalated" count={escalatedResult.count ?? 0} description="Assigned work that is blocked or escalated." href="/tasks?assigned=me&status=escalated" tone="warning" />
            <DecisionCard title="Overdue" count={overdueResult.count ?? 0} description="Assigned open work past its due date." href="/tasks?assigned=me&due=overdue" tone="warning" />
          </div>
        </section>
        <SectionCard title="My work queue" description="Due work first; completed history stays on the Tasks page.">
          {tasks.length === 0 ? (
            <EmptyState title="No assigned work" description="Your task workspace is configured, but there are no open tasks assigned to you." />
          ) : tasks.map((task) => (
            <WorkRow key={task.id} title={task.title || "Untitled task"} meta={`${task.property_code_snapshot || "No property"} · due ${formatDate(task.due_date)}`} href={`/tasks/${task.id}`} status={task.status} />
          ))}
        </SectionCard>
      </main>
    );
  }

  const [
    attention,
    urgentTasksResult,
    inboxPreviewResult,
    offersPreviewResult,
    openTasksResult,
    activeContractsResult,
    issuedInvoicesResult,
  ] = await Promise.all([
    loadOperatorAttention(supabase, todayIso, 5, 0),
    supabase.from("tasks").select("id,title,status,due_date,property_code_snapshot").in("status", ["open", "in_progress", "escalated", "blocked"]).or(`status.in.(escalated,blocked),due_date.lt.${todayIso}`).order("due_date", { ascending: true, nullsFirst: false }).limit(6),
    supabase.from("conversations").select(`id,last_message_at,unread_count,identity:contact_channel_identities!conversations_contact_identity_id_fkey(display_name,phone_e164,external_id)`).eq("attention_state", "needs_reply").neq("status", "archived").order("last_message_at", { ascending: true, nullsFirst: false }).limit(6),
    supabase.from("lead_offers").select(`id,offer_number,status,follow_up_date,valid_until,lead:leads!lead_offers_lead_id_fkey(id,full_name)`).in("status", ["draft", "sent"]).or(`status.eq.draft,follow_up_date.lte.${todayIso},valid_until.lt.${todayIso}`).order("follow_up_date", { ascending: true, nullsFirst: false }).limit(6),
    supabase.from("tasks").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress", "escalated", "blocked"]),
    supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("status", "issued"),
  ]);

  const failed = [urgentTasksResult.error, inboxPreviewResult.error, offersPreviewResult.error, openTasksResult.error, activeContractsResult.error, issuedInvoicesResult.error].find(Boolean);
  if (failed) throw new Error(`Unable to load operator dashboard: ${failed.message}`);

  const { counts, reviewQueue } = attention;
  const urgentTasks = (urgentTasksResult.data || []) as TaskRow[];
  const inboxPreview = (inboxPreviewResult.data || []) as InboxRow[];
  const offersPreview = (offersPreviewResult.data || []) as OfferRow[];
  perf.finish({ role: appUser.role, state: sectionOrder.join(","), urgentTasks: urgentTasks.length, reviews: reviewQueue.jobs.length });

  return (
    <main className="space-y-6">
      <PageHeader
        title="Daily operations"
        description={appUser.role === "admin" ? "Decisions and exceptions first. Use detail pages for bounded resolution controls." : "Decisions and exceptions first. Engineering decisions remain read-only for office operators."}
        actions={
          <>
            <Button asChild><Link href="/operator/review">Open review queue</Link></Button>
            <Button asChild variant="outline"><Link href="/tasks">Open tasks</Link></Button>
          </>
        }
      />

      <section aria-labelledby="exceptions-heading" className="space-y-3">
        <div>
          <h2 id="exceptions-heading" className="text-lg font-semibold">Needs a decision or follow-up</h2>
          <p className="text-sm text-muted-foreground">Exact full-queue counts; the work previews below are intentionally bounded.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" role="status" aria-live="polite">
          <DecisionCard title="Inbox needs reply" count={counts.inboxNeedsReply} description="Customers waiting on STREHË." href="/operator/inbox?filter=needs-reply" tone="warning" />
          <DecisionCard title="Agent reviews" count={counts.agentAwaitingReview} description="Engineering results awaiting human review." href="/operator/review#engineering-reviews" tone="warning" />
          <DecisionCard title="Escalated tasks" count={counts.escalatedTasks} description="Blocked or escalated work." href="/tasks?status=escalated" tone="warning" />
          <DecisionCard title="Overdue tasks" count={counts.overdueTasks} description="Open work past its due date." href="/tasks?due=overdue" tone="warning" />
          <DecisionCard title="Identity review" count={counts.identitiesNeedingReview} description="Ambiguous messaging identities." href="/operator/inbox?filter=identity-review" />
          <DecisionCard title="Offers" count={counts.offersNeedingAttention} description="Draft or due sent offers." href="/leads/follow-ups" />
          <DecisionCard title="Lead follow-ups" count={counts.followUpsDue} description="Open leads due for contact." href="/leads/follow-ups" />
        </div>
      </section>

      <section aria-labelledby="daily-work-heading" className="space-y-3">
        <h2 id="daily-work-heading" className="text-lg font-semibold">Today’s workspaces</h2>
        <div className="grid gap-4 xl:grid-cols-2">
          <SectionCard title="Engineering review queue" description={appUser.role === "admin" ? "Inspect and resolve from the job detail." : "Inspect job detail; resolution is admin-only."} action={<Button asChild size="sm" variant="ghost"><Link href="/operator/review">View queue</Link></Button>}>
            {!reviewQueue.configured ? (
              <EmptyState title="Review queue not configured" description="The Engineering Agent principal is not active on this environment." className="min-h-[220px]" />
            ) : reviewQueue.jobs.length === 0 ? (
              <EmptyState title="No Engineering reviews waiting" description="The configured queue is currently clear." className="min-h-[220px]" />
            ) : reviewQueue.jobs.map((job) => (
              <WorkRow key={job.id} title={job.summary || job.job_type} meta={`${job.session_id || job.id.slice(0, 8)} · ${job.finding_count} findings`} href={getEngineeringJobHref(job.id)} status={job.status} />
            ))}
          </SectionCard>

          <SectionCard title="Urgent task work" description="Escalated, blocked, or overdue tasks; due work first." action={<Button asChild size="sm" variant="ghost"><Link href="/tasks">View tasks</Link></Button>}>
            {urgentTasks.length === 0 ? (
              <EmptyState title="No task exceptions" description="The task workspace is configured and has no escalated, blocked, or overdue work." className="min-h-[220px]" />
            ) : urgentTasks.map((task) => (
              <WorkRow key={task.id} title={task.title || "Untitled task"} meta={`${task.property_code_snapshot || "No property"} · due ${formatDate(task.due_date)}`} href={`/tasks/${task.id}`} status={task.status} />
            ))}
          </SectionCard>

          <SectionCard title="Inbox attention" description="Oldest customer waits first." action={<Button asChild size="sm" variant="ghost"><Link href="/operator/inbox?filter=needs-reply">Open inbox</Link></Button>}>
            {inboxPreview.length === 0 ? (
              <EmptyState title="No conversations need a reply" description="The inbox is configured and no open conversation currently needs a response." className="min-h-[220px]" />
            ) : inboxPreview.map((conversation) => {
              const identity = getSingle(conversation.identity);
              return <WorkRow key={conversation.id} title={identity?.display_name || identity?.phone_e164 || identity?.external_id || "Unknown contact"} meta={`${conversation.unread_count} unread · last message ${formatDate(conversation.last_message_at)}`} href={`/operator/inbox/${conversation.id}`} status="needs_reply" />;
            })}
          </SectionCard>

          <SectionCard title="Offers and commercial follow-up" description="Draft offers and sent offers whose follow-up or validity needs attention." action={<Button asChild size="sm" variant="ghost"><Link href="/leads/follow-ups">Open follow-ups</Link></Button>}>
            {offersPreview.length === 0 ? (
              <EmptyState title="No offers need attention" description="The offer workflow is configured and has no draft or due sent offers." className="min-h-[220px]" />
            ) : offersPreview.map((offer) => {
              const lead = getSingle(offer.lead);
              return <WorkRow key={offer.id} title={`${offer.offer_number} · ${lead?.full_name || "Unnamed lead"}`} meta={`Follow-up ${formatDate(offer.follow_up_date)} · valid until ${formatDate(offer.valid_until)}`} href={lead ? `/leads/${lead.id}` : "/leads/follow-ups"} status={offer.status} />;
            })}
          </SectionCard>
        </div>
      </section>

      <details className="rounded-xl border bg-card p-4">
        <summary className="cursor-pointer font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Operational overview</summary>
        <p className="mt-2 text-sm text-muted-foreground">Secondary context kept behind the daily decision surface.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <StatCard title="Open tasks" value={openTasksResult.count ?? 0} />
          <StatCard title="Active contracts" value={activeContractsResult.count ?? 0} />
          <StatCard title="Issued invoices" value={issuedInvoicesResult.count ?? 0} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="ghost"><Link href="/properties">Properties</Link></Button>
          <Button asChild variant="ghost"><Link href="/billing">Billing</Link></Button>
          <Button asChild variant="ghost"><Link href="/expenses">Expenses</Link></Button>
          <Button asChild variant="ghost"><Link href="/finance">Finance</Link></Button>
        </div>
      </details>
    </main>
  );
}

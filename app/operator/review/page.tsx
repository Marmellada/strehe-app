import Link from "next/link";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  EmptyState,
  PageHeader,
  SectionCard,
  StatusBadge,
} from "@/components/ui";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { loadOperatorAttention } from "@/lib/operator/attention-data";
import {
  canResolveOperatorReviews,
  formatReviewProvenance,
  getEngineeringJobHref,
} from "@/lib/operator/workflows";

const REVIEW_PAGE_SIZE = 20;

type ReviewPageProps = {
  searchParams?: Promise<{ page?: string | string[] }>;
};

function formatDateTime(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function AttentionLink({
  title,
  count,
  description,
  href,
}: {
  title: string;
  count: number;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border bg-card p-4 transition hover:border-muted-foreground/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`${title}: ${count}. ${description}`}
    >
      <div className="text-2xl font-semibold" aria-hidden="true">{count}</div>
      <div className="mt-2 font-medium">{title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}

export default async function ReviewPage({ searchParams }: ReviewPageProps) {
  const current = await requireRole(["admin", "office"]);
  const rawPage = (await searchParams)?.page;
  const pageValue = Number(Array.isArray(rawPage) ? rawPage[0] : rawPage || "1");
  const currentPage = Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const offset = (currentPage - 1) * REVIEW_PAGE_SIZE;
  const supabase = await createClient();
  const todayIso = new Date().toISOString().slice(0, 10);
  const { counts, reviewQueue } = await loadOperatorAttention(
    supabase,
    todayIso,
    REVIEW_PAGE_SIZE,
    offset
  );
  const canResolve = canResolveOperatorReviews(current.appUser.role);
  const totalPages = Math.max(1, Math.ceil(reviewQueue.pending_count / REVIEW_PAGE_SIZE));

  return (
    <main className="space-y-6">
      <PageHeader
        title="Review queue"
        description={
          canResolve
            ? "Human decisions across messaging, daily work, commercial follow-up, and Engineering results."
            : "Read-only monitoring of decisions that need an admin or office follow-up."
        }
        actions={
          <Button asChild variant="outline">
            <Link href="/operator/agents">Agent controls</Link>
          </Button>
        }
      />

      {!canResolve ? (
        <Alert variant="info">
          <AlertTitle>Office monitoring view</AlertTitle>
          <AlertDescription>
            You can inspect every queue item and its recorded provenance. Only an admin can approve or reject an Engineering result.
          </AlertDescription>
        </Alert>
      ) : null}

      <section aria-labelledby="attention-heading" className="space-y-3">
        <div>
          <h2 id="attention-heading" className="text-lg font-semibold">Needs human attention</h2>
          <p className="text-sm text-muted-foreground">
            Exact counts from each full queue; preview limits do not affect these totals.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" role="status" aria-live="polite">
          <AttentionLink title="Inbox needs reply" count={counts.inboxNeedsReply} description="Open customer conversations waiting on STREHË." href="/operator/inbox?filter=needs-reply" />
          <AttentionLink title="Agent reviews" count={counts.agentAwaitingReview} description="Completed Engineering work awaiting a recorded decision." href="/operator/review#engineering-reviews" />
          <AttentionLink title="Escalated tasks" count={counts.escalatedTasks} description="Blocked or escalated operational work." href="/tasks?status=escalated" />
          <AttentionLink title="Overdue tasks" count={counts.overdueTasks} description="Open work past its due date." href="/tasks?due=overdue" />
          <AttentionLink title="Identity review" count={counts.identitiesNeedingReview} description="Messaging identities with ambiguous CRM matches." href="/operator/inbox?filter=identity-review" />
          <AttentionLink title="Offers" count={counts.offersNeedingAttention} description="Draft offers or sent offers with a due follow-up or elapsed validity." href="/leads/follow-ups" />
          <AttentionLink title="Lead follow-ups" count={counts.followUpsDue} description="Open leads whose next follow-up is due." href="/leads/follow-ups" />
        </div>
      </section>

      <SectionCard
        title="Engineering reviews"
        description="Open a job to inspect its bounded result, evidence, and decision history."
        action={<Badge variant="warning">{reviewQueue.pending_count} awaiting review</Badge>}
      >
        <div id="engineering-reviews" className="scroll-mt-24">
          {!reviewQueue.configured ? (
            <EmptyState
              title="Engineering review queue not configured"
              description="The Engineering Agent principal is not active on this environment. No dormant-agent UI is inferred."
            />
          ) : reviewQueue.jobs.length === 0 ? (
            <EmptyState
              title="No Engineering jobs await review"
              description="The queue is configured and currently clear. Completed review-gated jobs will appear here."
            />
          ) : (
            <div className="grid gap-3">
              {reviewQueue.jobs.map((job) => (
                <article key={job.id} className="rounded-xl border p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={job.status} />
                        <Badge>{job.target_module || "Repository"}</Badge>
                        <span className="font-mono text-xs text-muted-foreground">{job.id.slice(0, 8)}</span>
                      </div>
                      <h3 className="mt-3 font-medium">{job.summary || job.job_type}</h3>
                      <p className="mt-1 break-words text-sm text-muted-foreground">
                        {job.session_id || "No session identifier"} · {job.finding_count} findings · created {formatDateTime(job.created_at)}
                      </p>
                    </div>
                    <Button asChild className="w-full sm:w-auto">
                      <Link href={getEngineeringJobHref(job.id)}>Review job</Link>
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {reviewQueue.configured && totalPages > 1 ? (
            <nav className="mt-4 flex flex-wrap items-center justify-between gap-3" aria-label="Engineering review queue pages">
              {currentPage > 1 ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/operator/review?page=${currentPage - 1}#engineering-reviews`}>Previous</Link>
                </Button>
              ) : <Button variant="outline" size="sm" disabled>Previous</Button>}
              <span className="text-sm text-muted-foreground">Page {Math.min(currentPage, totalPages)} of {totalPages}</span>
              {currentPage < totalPages ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/operator/review?page=${currentPage + 1}#engineering-reviews`}>Next</Link>
                </Button>
              ) : <Button variant="outline" size="sm" disabled>Next</Button>}
            </nav>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        title="Recent Engineering decisions"
        description="Who approved or rejected what, and when."
      >
        {reviewQueue.recent_decisions.length === 0 ? (
          <EmptyState
            title="No decision provenance yet"
            description="The queue is configured, but no reviewed Engineering job has recorded a decision."
            className="min-h-[220px]"
          />
        ) : (
          <div className="grid gap-3">
            {reviewQueue.recent_decisions.map((job) => (
              <Link
                key={job.id}
                href={getEngineeringJobHref(job.id)}
                className="rounded-xl border p-4 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={job.review_decision || job.status} />
                  <span className="font-medium">{job.summary || job.job_type}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {formatReviewProvenance({
                    decision: job.review_decision,
                    reviewedAt: formatDateTime(job.reviewed_at),
                    reviewerName: job.reviewer_name,
                    reviewerEmail: job.reviewer_email,
                  })}
                </p>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>
    </main>
  );
}

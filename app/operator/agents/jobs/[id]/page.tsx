import Link from "next/link";
import { notFound } from "next/navigation";
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
import { ReviewDecisionForm } from "./ReviewDecisionForm";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { parseEngineeringReviewJob } from "@/lib/agents/review-queue";
import {
  canResolveOperatorReviews,
  formatReviewProvenance,
} from "@/lib/operator/workflows";

type JobPageProps = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function formatDateTime(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function displayFindingValue(value: unknown) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return JSON.stringify(value);
}

export default async function EngineeringJobPage({ params }: JobPageProps) {
  const current = await requireRole(["admin", "office"]);
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_engineering_review_job", {
    p_job_id: id,
  });
  if (error) throw new Error(`Unable to load Engineering job: ${error.message}`);
  const job = parseEngineeringReviewJob(data);
  if (!job) notFound();

  const canResolve = canResolveOperatorReviews(current.appUser.role);
  const isAwaitingReview = job.status === "awaiting_review";
  const targetCommit = job.target_commit || job.commit_sha;

  return (
    <main className="space-y-6">
      <PageHeader
        title="Engineering job review"
        description={`${job.job_type} · ${job.id}`}
        actions={
          <>
            <Button asChild variant="outline"><Link href="/operator/review">Back to review queue</Link></Button>
            <Button asChild variant="ghost"><Link href="/operator/agents">Agent workspace</Link></Button>
          </>
        }
      />

      <Alert variant="info">
        <AlertTitle>Human authority remains in control</AlertTitle>
        <AlertDescription>
          Local-only read, analysis, test, and recommendation. Remediation and production changes always require human approval. Approving this result closes this review job only.
        </AlertDescription>
      </Alert>

      <SectionCard
        title="Decision state"
        description="Review status and immutable provenance from the agent job record."
        action={<StatusBadge status={job.review_decision || job.status} />}
      >
        <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Status</dt><dd className="mt-1"><StatusBadge status={job.status} /></dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Decision</dt><dd className="mt-1 text-sm font-medium">{job.review_decision || "Awaiting decision"}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Reviewer</dt><dd className="mt-1 break-words text-sm">{job.reviewer_name || job.reviewer_email || "Not recorded"}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Reviewed at</dt><dd className="mt-1 text-sm">{formatDateTime(job.reviewed_at)}</dd></div>
        </dl>
        <p className="mt-4 rounded-lg bg-muted/40 p-3 text-sm" role="status" aria-live="polite">
          {formatReviewProvenance({
            decision: job.review_decision,
            reviewedAt: job.reviewed_at ? formatDateTime(job.reviewed_at) : null,
            reviewerName: job.reviewer_name,
            reviewerEmail: job.reviewer_email,
          })}
        </p>
        {job.review_notes ? (
          <div className="mt-4"><div className="text-xs uppercase tracking-wide text-muted-foreground">Decision notes</div><p className="mt-1 whitespace-pre-wrap text-sm">{job.review_notes}</p></div>
        ) : null}
      </SectionCard>

      <SectionCard title="Bounded job context" description="Redacted fields needed to verify the review target.">
        <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div><dt className="text-xs text-muted-foreground">Session</dt><dd className="mt-1 break-all font-mono text-xs">{job.session_id || "Not provided"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Target module</dt><dd className="mt-1 text-sm">{job.target_module || "Repository"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Trigger</dt><dd className="mt-1 text-sm">{job.trigger || "Not provided"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Base commit</dt><dd className="mt-1 break-all font-mono text-xs">{job.base_commit || "Not provided"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Target commit</dt><dd className="mt-1 break-all font-mono text-xs">{targetCommit || "Not provided"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Attempts</dt><dd className="mt-1 text-sm">{job.attempt_count} of {job.max_attempts}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Created</dt><dd className="mt-1 text-sm">{formatDateTime(job.created_at)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Updated</dt><dd className="mt-1 text-sm">{formatDateTime(job.updated_at)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Completed processing</dt><dd className="mt-1 text-sm">{formatDateTime(job.processed_at || job.completed_at)}</dd></div>
        </dl>
        {job.error_status ? <p className="mt-4"><Badge variant="danger">{job.error_status}</Badge></p> : null}
      </SectionCard>

      <SectionCard title="Result and findings" description="Evidence supplied for the human decision.">
        {job.summary ? <p className="mb-4 whitespace-pre-wrap text-sm">{job.summary}</p> : null}
        {job.findings.length === 0 ? (
          <EmptyState
            title="No findings recorded for this job"
            description="The job detail is available, but its result contains no finding entries. This is distinct from an unconfigured queue."
            className="min-h-[220px]"
          />
        ) : (
          <div className="grid gap-3">
            {job.findings.map((finding, index) => {
              const evidence = Array.isArray(finding.evidence) ? finding.evidence : [];
              return (
                <article key={String(finding.id || index)} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {finding.severity ? <StatusBadge status={String(finding.severity)} /> : null}
                    {finding.module ? <Badge>{String(finding.module)}</Badge> : null}
                  </div>
                  <h3 className="mt-3 font-medium">{displayFindingValue(finding.summary) || `Finding ${index + 1}`}</h3>
                  {evidence.length > 0 ? (
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {evidence.map((item, evidenceIndex) => <li key={evidenceIndex} className="break-words">{displayFindingValue(item)}</li>)}
                    </ul>
                  ) : null}
                  {finding.recommendation ? <p className="mt-3 text-sm"><span className="font-medium">Recommendation:</span> {displayFindingValue(finding.recommendation)}</p> : null}
                </article>
              );
            })}
          </div>
        )}
      </SectionCard>

      {isAwaitingReview ? (
        <SectionCard
          title={canResolve ? "Record decision" : "Decision required"}
          description={canResolve ? "One recorded admin decision closes this review job." : "Office operators can inspect this job but cannot decide on behalf of an admin."}
        >
          {canResolve ? (
            <ReviewDecisionForm jobId={job.id} />
          ) : (
            <Alert variant="warning"><AlertTitle>Admin decision required</AlertTitle><AlertDescription>No resolution control is available for the office role.</AlertDescription></Alert>
          )}
        </SectionCard>
      ) : null}
    </main>
  );
}

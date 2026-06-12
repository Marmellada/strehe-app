import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  FormField,
  Input,
  PageHeader,
  StatusBadge,
} from "@/components/ui";
import { requireHouseholdAccess } from "@/lib/auth/require-household-access";

const FINANCE_REPORT_CAPABILITY = "finance.report.generate";

type FinanceJob = {
  id: string;
  household_space_id: string;
  status: string;
  payload: unknown;
  result: unknown;
  review_decision: string | null;
  review_notes: string | null;
  created_at: string;
  completed_at: string | null;
  expires_at: string;
};

type ReportResult = {
  month: string;
  currency: string;
  summary: {
    income_cents: number;
    spending_cents: number;
    net_cash_flow_cents: number;
    movement_count: number;
    unmatched_outflow_count: number;
    unmatched_outflow_cents: number;
    unmatched_receipt_count: number;
    unmatched_receipt_cents: number;
  };
  category_breakdown: Array<{
    category: string;
    amount_cents: number;
  }>;
  narrative: string;
};

function defaultMonth() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    timeZone: "Europe/Warsaw",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}

function jobMonth(payload: unknown) {
  if (!payload || typeof payload !== "object") return "Unknown month";
  const month = (payload as { month?: unknown }).month;
  return typeof month === "string" ? month : "Unknown month";
}

function parseReportResult(result: unknown): ReportResult | null {
  if (!result || typeof result !== "object") return null;
  const candidate = result as Partial<ReportResult>;
  if (
    typeof candidate.month !== "string" ||
    typeof candidate.currency !== "string" ||
    !candidate.summary ||
    typeof candidate.summary.income_cents !== "number" ||
    typeof candidate.summary.spending_cents !== "number" ||
    typeof candidate.summary.net_cash_flow_cents !== "number"
  ) {
    return null;
  }

  return {
    month: candidate.month,
    currency: candidate.currency,
    summary: {
      income_cents: candidate.summary.income_cents,
      spending_cents: candidate.summary.spending_cents,
      net_cash_flow_cents: candidate.summary.net_cash_flow_cents,
      movement_count: candidate.summary.movement_count ?? 0,
      unmatched_outflow_count:
        candidate.summary.unmatched_outflow_count ?? 0,
      unmatched_outflow_cents:
        candidate.summary.unmatched_outflow_cents ?? 0,
      unmatched_receipt_count:
        candidate.summary.unmatched_receipt_count ?? 0,
      unmatched_receipt_cents:
        candidate.summary.unmatched_receipt_cents ?? 0,
    },
    category_breakdown: Array.isArray(candidate.category_breakdown)
      ? candidate.category_breakdown
      : [],
    narrative:
      typeof candidate.narrative === "string" ? candidate.narrative : "",
  };
}

function formatMoney(cents: number, currency = "EUR") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function requestMonthlyReport(formData: FormData) {
  "use server";

  const { authUser, supabase, spaces } = await requireHouseholdAccess();
  const householdSpaceId = String(
    formData.get("household_space_id") || ""
  ).trim();
  const month = String(formData.get("month") || "").trim();

  if (!spaces.some((space) => space.id === householdSpaceId)) {
    throw new Error("Household space was not found.");
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error("Report month must use YYYY-MM format.");
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const { data, error } = await supabase
    .from("agent_jobs")
    .insert({
      job_type: FINANCE_REPORT_CAPABILITY,
      required_capability: FINANCE_REPORT_CAPABILITY,
      workspace_type: "household",
      household_space_id: householdSpaceId,
      requested_by_user_id: authUser.id,
      status: "queued",
      payload: { month },
      requires_review: true,
      expires_at: expiresAt.toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to request the local report: ${error?.message || "Unknown error."}`
    );
  }

  revalidatePath("/household");
  revalidatePath("/household/finance");
  redirect(`/household/finance?requested=${data.id}`);
}

async function reviewMonthlyReport(formData: FormData) {
  "use server";

  const { supabase, spaces } = await requireHouseholdAccess();
  const jobId = String(formData.get("job_id") || "").trim();
  const decision = String(formData.get("decision") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  if (!jobId || !["approved", "rejected"].includes(decision)) {
    throw new Error("A valid review decision is required.");
  }

  const { data: job, error: jobError } = await supabase
    .from("agent_jobs")
    .select("id, household_space_id, status")
    .eq("id", jobId)
    .maybeSingle();

  if (
    jobError ||
    !job ||
    !spaces.some((space) => space.id === job.household_space_id) ||
    job.status !== "awaiting_review"
  ) {
    throw new Error("This report is not available for review.");
  }

  const { error } = await supabase.rpc("review_agent_job", {
    target_job_id: jobId,
    decision,
    notes: notes || null,
  });

  if (error) {
    throw new Error(`Failed to review the report: ${error.message}`);
  }

  revalidatePath("/household");
  revalidatePath("/household/finance");
  redirect(`/household/finance?reviewed=${jobId}`);
}

export default async function HouseholdFinancePage() {
  const { supabase, spaces } = await requireHouseholdAccess();
  const spaceIds = spaces.map((space) => space.id);
  const jobsResult =
    spaceIds.length > 0
      ? await supabase
          .from("agent_jobs")
          .select(
            "id, household_space_id, status, payload, result, review_decision, review_notes, created_at, completed_at, expires_at"
          )
          .in("household_space_id", spaceIds)
          .eq("job_type", FINANCE_REPORT_CAPABILITY)
          .order("created_at", { ascending: false })
          .limit(12)
      : { data: [], error: null };

  if (jobsResult.error) {
    throw new Error(`Finance requests failed: ${jobsResult.error.message}`);
  }

  const jobs = (jobsResult.data ?? []) as FinanceJob[];

  return (
    <main className="space-y-6">
      <PageHeader
        title="Household Finance Reports"
        description="Request a monthly summary from the finance system running privately on your PC."
        actions={
          <Button asChild variant="ghost">
            <Link href="/household">Back to Household</Link>
          </Button>
        }
      />

      <Alert variant="info">
        <AlertTitle>Your financial ledger stays local</AlertTitle>
        <AlertDescription>
          The web app sends only the requested month. Your PC returns monthly
          totals and category summaries for review, never statements,
          transactions, account details, receipts, or OCR data.
        </AlertDescription>
      </Alert>

      {spaces.length === 0 ? (
        <EmptyState
          title="Household setup is pending"
          description="Create the Household space before requesting a local report."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Request Monthly Report</CardTitle>
            <CardDescription>
              The request waits safely until the local finance connector is
              running on your PC.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              action={requestMonthlyReport}
              className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end"
            >
              <FormField id="household_space_id" label="Household space" required>
                <select
                  id="household_space_id"
                  name="household_space_id"
                  defaultValue={spaces[0]?.id}
                  required
                  className="flex h-10 w-full rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--input-ring-color)] focus-visible:ring-offset-2"
                >
                  {spaces.map((space) => (
                    <option key={space.id} value={space.id}>
                      {space.name}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField id="month" label="Report month" required>
                <Input
                  id="month"
                  name="month"
                  type="month"
                  defaultValue={defaultMonth()}
                  required
                />
              </FormField>

              <Button type="submit">Request Report</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="font-heading text-xl font-semibold">Recent Reports</h2>
          <p className="text-sm text-muted-foreground">
            Every result remains a proposal until a household member approves
            it.
          </p>
        </div>

        {jobs.length === 0 ? (
          <EmptyState
            title="No finance reports requested"
            description="Choose a month above to send the first job to your local PC."
          />
        ) : (
          <div className="grid gap-4">
            {jobs.map((job) => {
              const report = parseReportResult(job.result);
              return (
                <Card key={job.id}>
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle>{jobMonth(job.payload)} monthly summary</CardTitle>
                        <CardDescription>
                          Requested {formatTimestamp(job.created_at)}
                        </CardDescription>
                      </div>
                      <StatusBadge status={job.status} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {report ? (
                      <>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-xl border border-border p-4">
                            <p className="text-sm text-muted-foreground">Income</p>
                            <p className="mt-1 text-lg font-semibold">
                              {formatMoney(
                                report.summary.income_cents,
                                report.currency
                              )}
                            </p>
                          </div>
                          <div className="rounded-xl border border-border p-4">
                            <p className="text-sm text-muted-foreground">Spending</p>
                            <p className="mt-1 text-lg font-semibold">
                              {formatMoney(
                                report.summary.spending_cents,
                                report.currency
                              )}
                            </p>
                          </div>
                          <div className="rounded-xl border border-border p-4">
                            <p className="text-sm text-muted-foreground">Net cash flow</p>
                            <p className="mt-1 text-lg font-semibold">
                              {formatMoney(
                                report.summary.net_cash_flow_cents,
                                report.currency
                              )}
                            </p>
                          </div>
                          <div className="rounded-xl border border-border p-4">
                            <p className="text-sm text-muted-foreground">Movements</p>
                            <p className="mt-1 text-lg font-semibold">
                              {report.summary.movement_count}
                            </p>
                          </div>
                        </div>

                        {report.category_breakdown.length > 0 ? (
                          <div>
                            <h3 className="font-medium">Category breakdown</h3>
                            <div className="mt-2 divide-y divide-border rounded-xl border border-border px-4">
                              {report.category_breakdown.map((item) => (
                                <div
                                  key={item.category}
                                  className="flex items-center justify-between gap-4 py-3"
                                >
                                  <span>{item.category}</span>
                                  <span className="font-medium">
                                    {formatMoney(
                                      item.amount_cents,
                                      report.currency
                                    )}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        <div className="rounded-xl bg-muted/50 p-4">
                          <h3 className="font-medium">Local analysis</h3>
                          <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                            {report.narrative || "No findings were generated."}
                          </p>
                        </div>

                        <p className="text-sm text-muted-foreground">
                          Unmatched statement outflows:{" "}
                          {report.summary.unmatched_outflow_count} (
                          {formatMoney(
                            report.summary.unmatched_outflow_cents,
                            report.currency
                          )}
                          ). Unmatched confirmed receipts:{" "}
                          {report.summary.unmatched_receipt_count} (
                          {formatMoney(
                            report.summary.unmatched_receipt_cents,
                            report.currency
                          )}
                          ).
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {job.status === "queued"
                          ? "Waiting for the local finance connector."
                          : job.status === "running"
                            ? "The report is being calculated on your PC."
                            : job.status === "failed"
                              ? "The local job failed or the report was rejected."
                              : "No aggregate result is available."}
                      </p>
                    )}

                    {job.status === "awaiting_review" && report ? (
                      <form
                        action={reviewMonthlyReport}
                        className="space-y-3 rounded-xl border border-border p-4"
                      >
                        <input type="hidden" name="job_id" value={job.id} />
                        <FormField
                          id={`notes-${job.id}`}
                          label="Review notes"
                          hint="Optional. Notes remain with this temporary job."
                        >
                          <Input
                            id={`notes-${job.id}`}
                            name="notes"
                            maxLength={4000}
                            placeholder="Checked against the local report."
                          />
                        </FormField>
                        <div className="flex flex-wrap gap-3">
                          <Button
                            type="submit"
                            name="decision"
                            value="approved"
                          >
                            Approve Report
                          </Button>
                          <Button
                            type="submit"
                            name="decision"
                            value="rejected"
                            variant="destructive"
                          >
                            Reject Report
                          </Button>
                        </div>
                      </form>
                    ) : null}

                    {job.review_decision ? (
                      <p className="text-sm text-muted-foreground">
                        Review: {job.review_decision}
                        {job.review_notes ? ` - ${job.review_notes}` : ""}
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

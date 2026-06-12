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
  Textarea,
} from "@/components/ui";
import { requireHouseholdAccess } from "@/lib/auth/require-household-access";

const FINANCE_REPORT_CAPABILITY = "finance.report.generate";
const FINANCE_PLAN_CAPABILITY = "finance.plan.propose";
const FINANCE_CAPABILITIES = [
  FINANCE_REPORT_CAPABILITY,
  FINANCE_PLAN_CAPABILITY,
] as const;

type FinanceJob = {
  id: string;
  job_type: string;
  household_space_id: string;
  status: string;
  payload: unknown;
  result: unknown;
  review_decision: string | null;
  review_notes: string | null;
  created_at: string;
};

type QualityResult = {
  status: string;
  attempts: number;
  checks: string[];
  corrections: string[];
  human_review_required: boolean;
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
  quality: QualityResult | null;
};

type PlanResult = {
  local_plan_id: string;
  month: string;
  name: string;
  currency: string;
  summary: {
    opening_balance_cents: number;
    expected_income_cents: number;
    essential_budget_cents: number;
    flexible_budget_cents: number;
    savings_target_cents: number;
    planned_closing_balance_cents: number;
  };
  rationale: string;
  guidance: string[];
  quality: QualityResult | null;
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

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function parseQuality(value: unknown): QualityResult | null {
  const candidate = objectValue(value);
  if (
    !candidate ||
    typeof candidate.status !== "string" ||
    typeof candidate.attempts !== "number"
  ) {
    return null;
  }

  return {
    status: candidate.status,
    attempts: candidate.attempts,
    checks: Array.isArray(candidate.checks)
      ? candidate.checks.filter(
          (item): item is string => typeof item === "string"
        )
      : [],
    corrections: Array.isArray(candidate.corrections)
      ? candidate.corrections.filter(
          (item): item is string => typeof item === "string"
        )
      : [],
    human_review_required: candidate.human_review_required === true,
  };
}

function parseReportResult(value: unknown): ReportResult | null {
  const candidate = objectValue(value);
  const summary = objectValue(candidate?.summary);
  if (
    !candidate ||
    !summary ||
    typeof candidate.month !== "string" ||
    typeof candidate.currency !== "string" ||
    typeof summary.income_cents !== "number" ||
    typeof summary.spending_cents !== "number" ||
    typeof summary.net_cash_flow_cents !== "number"
  ) {
    return null;
  }

  return {
    month: candidate.month,
    currency: candidate.currency,
    summary: {
      income_cents: summary.income_cents,
      spending_cents: summary.spending_cents,
      net_cash_flow_cents: summary.net_cash_flow_cents,
      movement_count:
        typeof summary.movement_count === "number"
          ? summary.movement_count
          : 0,
      unmatched_outflow_count:
        typeof summary.unmatched_outflow_count === "number"
          ? summary.unmatched_outflow_count
          : 0,
      unmatched_outflow_cents:
        typeof summary.unmatched_outflow_cents === "number"
          ? summary.unmatched_outflow_cents
          : 0,
      unmatched_receipt_count:
        typeof summary.unmatched_receipt_count === "number"
          ? summary.unmatched_receipt_count
          : 0,
      unmatched_receipt_cents:
        typeof summary.unmatched_receipt_cents === "number"
          ? summary.unmatched_receipt_cents
          : 0,
    },
    category_breakdown: Array.isArray(candidate.category_breakdown)
      ? (candidate.category_breakdown as ReportResult["category_breakdown"])
      : [],
    narrative:
      typeof candidate.narrative === "string" ? candidate.narrative : "",
    quality: parseQuality(candidate.quality),
  };
}

function parsePlanResult(value: unknown): PlanResult | null {
  const candidate = objectValue(value);
  const summary = objectValue(candidate?.summary);
  if (
    !candidate ||
    !summary ||
    typeof candidate.local_plan_id !== "string" ||
    typeof candidate.month !== "string" ||
    typeof candidate.name !== "string" ||
    typeof candidate.currency !== "string" ||
    typeof summary.opening_balance_cents !== "number" ||
    typeof summary.expected_income_cents !== "number" ||
    typeof summary.essential_budget_cents !== "number" ||
    typeof summary.flexible_budget_cents !== "number" ||
    typeof summary.savings_target_cents !== "number" ||
    typeof summary.planned_closing_balance_cents !== "number"
  ) {
    return null;
  }

  return {
    local_plan_id: candidate.local_plan_id,
    month: candidate.month,
    name: candidate.name,
    currency: candidate.currency,
    summary: {
      opening_balance_cents: summary.opening_balance_cents,
      expected_income_cents: summary.expected_income_cents,
      essential_budget_cents: summary.essential_budget_cents,
      flexible_budget_cents: summary.flexible_budget_cents,
      savings_target_cents: summary.savings_target_cents,
      planned_closing_balance_cents: summary.planned_closing_balance_cents,
    },
    rationale:
      typeof candidate.rationale === "string" ? candidate.rationale : "",
    guidance: Array.isArray(candidate.guidance)
      ? candidate.guidance.filter(
          (item): item is string => typeof item === "string"
        )
      : [],
    quality: parseQuality(candidate.quality),
  };
}

function jobMonth(payload: unknown) {
  const candidate = objectValue(payload);
  return typeof candidate?.month === "string"
    ? candidate.month
    : "Unknown month";
}

function formMoneyToCents(formData: FormData, key: string) {
  const raw = String(formData.get(key) || "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    throw new Error(`${key} must be a non-negative amount.`);
  }
  const cents = Math.round(Number(raw) * 100);
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new Error(`${key} is outside the supported range.`);
  }
  return cents;
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

async function createFinanceJob(
  formData: FormData,
  capability: (typeof FINANCE_CAPABILITIES)[number],
  payload: Record<string, unknown>
) {
  const { authUser, supabase, spaces } = await requireHouseholdAccess();
  const householdSpaceId = String(
    formData.get("household_space_id") || ""
  ).trim();

  if (!spaces.some((space) => space.id === householdSpaceId)) {
    throw new Error("Household space was not found.");
  }

  const { data, error } = await supabase
    .from("agent_jobs")
    .insert({
      job_type: capability,
      required_capability: capability,
      workspace_type: "household",
      household_space_id: householdSpaceId,
      requested_by_user_id: authUser.id,
      status: "queued",
      payload,
      requires_review: true,
      expires_at: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000
      ).toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to request local finance work: ${
        error?.message || "Unknown error."
      }`
    );
  }

  revalidatePath("/household");
  revalidatePath("/household/finance");
  redirect(`/household/finance?requested=${data.id}`);
}

async function requestMonthlyReport(formData: FormData) {
  "use server";

  const month = String(formData.get("month") || "").trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error("Report month must use YYYY-MM format.");
  }

  await createFinanceJob(formData, FINANCE_REPORT_CAPABILITY, { month });
}

async function requestMonthlyPlan(formData: FormData) {
  "use server";

  const month = String(formData.get("month") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const rationale = String(formData.get("rationale") || "").trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error("Plan month must use YYYY-MM format.");
  }
  if (!name || name.length > 120) {
    throw new Error("Plan name must contain 1 to 120 characters.");
  }
  if (rationale.length > 500) {
    throw new Error("Plan assumptions must not exceed 500 characters.");
  }

  await createFinanceJob(formData, FINANCE_PLAN_CAPABILITY, {
    month,
    name,
    expected_income_cents: formMoneyToCents(formData, "expected_income"),
    essential_budget_cents: formMoneyToCents(formData, "essential_budget"),
    flexible_budget_cents: formMoneyToCents(formData, "flexible_budget"),
    savings_target_cents: formMoneyToCents(formData, "savings_target"),
    rationale,
  });
}

async function reviewFinanceJob(formData: FormData) {
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
    throw new Error("This result is not available for review.");
  }

  const { error } = await supabase.rpc("review_agent_job", {
    target_job_id: jobId,
    decision,
    notes: notes || null,
  });
  if (error) {
    throw new Error(`Failed to review the result: ${error.message}`);
  }

  revalidatePath("/household");
  revalidatePath("/household/finance");
  redirect(`/household/finance?reviewed=${jobId}`);
}

function HouseholdSpaceSelect({
  spaces,
  id,
}: {
  spaces: Array<{ id: string; name: string }>;
  id: string;
}) {
  return (
    <FormField id={id} label="Household space" required>
      <select
        id={id}
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
  );
}

function QualitySummary({ quality }: { quality: QualityResult | null }) {
  if (!quality) return null;

  return (
    <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-medium">Bounded quality check passed</p>
        <StatusBadge status={quality.status} />
      </div>
      <p className="mt-2 text-muted-foreground">
        {quality.checks.join(", ")} checked in {quality.attempts} attempt
        {quality.attempts === 1 ? "" : "s"}.
        {quality.corrections.length > 0
          ? ` ${quality.corrections.length} issue set was corrected locally.`
          : " No correction was needed."}
      </p>
    </div>
  );
}

function ReviewForm({
  job,
  noun,
}: {
  job: FinanceJob;
  noun: "Report" | "Plan";
}) {
  if (job.status !== "awaiting_review") return null;

  return (
    <form
      action={reviewFinanceJob}
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
          placeholder={`What did you verify before reviewing this ${noun.toLowerCase()}?`}
        />
      </FormField>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" name="decision" value="approved">
          Approve {noun}
        </Button>
        <Button
          type="submit"
          name="decision"
          value="rejected"
          variant="destructive"
        >
          Reject {noun}
        </Button>
      </div>
    </form>
  );
}

function ReportJobCard({ job }: { job: FinanceJob }) {
  const report = parseReportResult(job.result);

  return (
    <Card>
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
              {[
                ["Income", report.summary.income_cents],
                ["Spending", report.summary.spending_cents],
                ["Net cash flow", report.summary.net_cash_flow_cents],
              ].map(([label, amount]) => (
                <div
                  key={String(label)}
                  className="rounded-xl border border-border p-4"
                >
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="mt-1 text-lg font-semibold">
                    {formatMoney(Number(amount), report.currency)}
                  </p>
                </div>
              ))}
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
                        {formatMoney(item.amount_cents, report.currency)}
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
            <QualitySummary quality={report.quality} />
            <ReviewForm job={job} noun="Report" />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {job.status === "queued"
              ? "Waiting for the local finance connector."
              : job.status === "running"
                ? "The report is being calculated and checked on your PC."
                : job.status === "failed"
                  ? "The local job failed or the report was rejected."
                  : "No aggregate result is available."}
          </p>
        )}
        {job.review_decision ? (
          <p className="text-sm text-muted-foreground">
            Review: {job.review_decision}
            {job.review_notes ? ` - ${job.review_notes}` : ""}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PlanJobCard({ job }: { job: FinanceJob }) {
  const plan = parsePlanResult(job.result);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>
              {plan?.name || `${jobMonth(job.payload)} plan proposal`}
            </CardTitle>
            <CardDescription>
              Requested {formatTimestamp(job.created_at)}
            </CardDescription>
          </div>
          <StatusBadge status={job.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {plan ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[
                ["Opening balance", plan.summary.opening_balance_cents],
                ["Expected income", plan.summary.expected_income_cents],
                [
                  "Planned spending",
                  plan.summary.essential_budget_cents +
                    plan.summary.flexible_budget_cents,
                ],
                ["Savings target", plan.summary.savings_target_cents],
                [
                  "Planned closing buffer",
                  plan.summary.planned_closing_balance_cents,
                ],
              ].map(([label, amount]) => (
                <div
                  key={String(label)}
                  className="rounded-xl border border-border p-4"
                >
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="mt-1 text-lg font-semibold">
                    {formatMoney(Number(amount), plan.currency)}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-xl bg-muted/50 p-4">
              <h3 className="font-medium">Practical checks</h3>
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                {plan.guidance.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
              {plan.rationale ? (
                <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
                  Assumptions: {plan.rationale}
                </p>
              ) : null}
            </div>

            <QualitySummary quality={plan.quality} />
            <ReviewForm job={job} noun="Plan" />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {job.status === "queued"
              ? "Waiting for the local planning agent."
              : job.status === "running"
                ? "The proposal is being calculated and checked on your PC."
                : job.status === "failed"
                  ? "The local job failed or the proposal was rejected."
                  : "No aggregate proposal is available."}
          </p>
        )}
        {job.review_decision ? (
          <p className="text-sm text-muted-foreground">
            Review: {job.review_decision}
            {job.review_notes ? ` - ${job.review_notes}` : ""}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default async function HouseholdFinancePage() {
  const { supabase, spaces } = await requireHouseholdAccess();
  const spaceIds = spaces.map((space) => space.id);
  const jobsResult =
    spaceIds.length > 0
      ? await supabase
          .from("agent_jobs")
          .select(
            "id, job_type, household_space_id, status, payload, result, review_decision, review_notes, created_at"
          )
          .in("household_space_id", spaceIds)
          .in("job_type", [...FINANCE_CAPABILITIES])
          .order("created_at", { ascending: false })
          .limit(20)
      : { data: [], error: null };

  if (jobsResult.error) {
    throw new Error(`Finance requests failed: ${jobsResult.error.message}`);
  }

  const jobs = (jobsResult.data ?? []) as FinanceJob[];

  return (
    <main className="space-y-6">
      <PageHeader
        title="Household Finance & Planner"
        description="Ask the private finance workforce on your PC for an aggregate report or a checked monthly plan."
        actions={
          <Button asChild variant="ghost">
            <Link href="/household">Back to Household</Link>
          </Button>
        }
      />

      <Alert variant="info">
        <AlertTitle>Your financial ledger stays local</AlertTitle>
        <AlertDescription>
          The web app stores only temporary requests, aggregate results, and
          your review. Statements, transactions, account details, receipts,
          OCR data, and local agent reasoning remain on your PC.
        </AlertDescription>
      </Alert>

      {spaces.length === 0 ? (
        <EmptyState
          title="Household setup is pending"
          description="Create the Household space before requesting local finance work."
        />
      ) : (
        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Analysis</CardTitle>
              <CardDescription>
                Income, spending, cash flow, categories, and unmatched records.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={requestMonthlyReport} className="grid gap-5">
                <HouseholdSpaceSelect
                  spaces={spaces}
                  id="report-household-space"
                />
                <FormField id="report-month" label="Report month" required>
                  <Input
                    id="report-month"
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

          <Card>
            <CardHeader>
              <CardTitle>Monthly Plan Proposal</CardTitle>
              <CardDescription>
                Your PC combines these assumptions with the local opening
                balance, checks the arithmetic, and returns guidance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={requestMonthlyPlan} className="grid gap-5">
                <HouseholdSpaceSelect
                  spaces={spaces}
                  id="plan-household-space"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField id="plan-month" label="Plan month" required>
                    <Input
                      id="plan-month"
                      name="month"
                      type="month"
                      defaultValue={defaultMonth()}
                      required
                    />
                  </FormField>
                  <FormField id="plan-name" label="Plan name" required>
                    <Input
                      id="plan-name"
                      name="name"
                      placeholder="Normal household month"
                      maxLength={120}
                      required
                    />
                  </FormField>
                  <FormField
                    id="expected-income"
                    label="Expected income (EUR)"
                    required
                  >
                    <Input
                      id="expected-income"
                      name="expected_income"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue="0.00"
                      required
                    />
                  </FormField>
                  <FormField
                    id="essential-budget"
                    label="Essential limit (EUR)"
                    required
                  >
                    <Input
                      id="essential-budget"
                      name="essential_budget"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue="0.00"
                      required
                    />
                  </FormField>
                  <FormField
                    id="flexible-budget"
                    label="Flexible limit (EUR)"
                    required
                  >
                    <Input
                      id="flexible-budget"
                      name="flexible_budget"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue="0.00"
                      required
                    />
                  </FormField>
                  <FormField
                    id="savings-target"
                    label="Savings target (EUR)"
                    required
                  >
                    <Input
                      id="savings-target"
                      name="savings_target"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue="0.00"
                      required
                    />
                  </FormField>
                </div>
                <FormField
                  id="plan-rationale"
                  label="Assumptions"
                  hint="Avoid account numbers or transaction details. Maximum 500 characters."
                >
                  <Textarea
                    id="plan-rationale"
                    name="rationale"
                    rows={3}
                    maxLength={500}
                    placeholder="What should this proposal protect or prepare for?"
                  />
                </FormField>
                <Button type="submit">Request Plan</Button>
              </form>
            </CardContent>
          </Card>
        </section>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="font-heading text-xl font-semibold">
            Recent Finance Work
          </h2>
          <p className="text-sm text-muted-foreground">
            Agents can validate and retry their output, but only a household
            member can approve it.
          </p>
        </div>

        {jobs.length === 0 ? (
          <EmptyState
            title="No finance work requested"
            description="Request a report or plan above to send the first job to your local PC."
          />
        ) : (
          <div className="grid gap-4">
            {jobs.map((job) =>
              job.job_type === FINANCE_PLAN_CAPABILITY ? (
                <PlanJobCard key={job.id} job={job} />
              ) : (
                <ReportJobCard key={job.id} job={job} />
              )
            )}
          </div>
        )}
      </section>
    </main>
  );
}

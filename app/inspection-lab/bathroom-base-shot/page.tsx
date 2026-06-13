import Link from "next/link";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  StatCard,
  StatusBadge,
  Textarea,
} from "@/components/ui";
import { requireRole } from "@/lib/auth/require-role";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  INSPECTION_STORAGE_BUCKET,
  listInspectionCases,
  type InspectionLabCasePhotoRow,
  type InspectionLabTrackedObjectRow,
} from "@/lib/inspection-lab/bathroom-base-shot";
import {
  reviewInspectionJobAction,
  runInspectionCaseAction,
} from "@/app/inspection-lab/bathroom-base-shot/actions";
import { RoomStateUploadForm } from "@/components/inspection-lab/RoomStateUploadForm";

type InspectionJob = {
  id: string;
  subject_id: string | null;
  status: string;
  result: unknown;
  review_decision: string | null;
  review_notes: string | null;
  created_at: string;
};

type InspectionResult = {
  summary: {
    pair_count: number;
    same_room_verdict: string;
    change_severity: string;
    finding_count: number;
  };
  report_markdown: string;
  runtime: {
    local_model: string | null;
    local_model_used: boolean;
  };
  quality: {
    status: string;
    attempts: number;
    corrections: string[];
  };
};

function parseInspectionResult(value: unknown): InspectionResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = value as Record<string, unknown>;
  const summary =
    result.summary &&
    typeof result.summary === "object" &&
    !Array.isArray(result.summary)
      ? (result.summary as Record<string, unknown>)
      : null;
  const runtime =
    result.runtime &&
    typeof result.runtime === "object" &&
    !Array.isArray(result.runtime)
      ? (result.runtime as Record<string, unknown>)
      : {};
  const quality =
    result.quality &&
    typeof result.quality === "object" &&
    !Array.isArray(result.quality)
      ? (result.quality as Record<string, unknown>)
      : {};

  if (
    !summary ||
    typeof summary.pair_count !== "number" ||
    typeof summary.same_room_verdict !== "string" ||
    typeof summary.change_severity !== "string"
  ) {
    return null;
  }

  return {
    summary: {
      pair_count: summary.pair_count,
      same_room_verdict: summary.same_room_verdict,
      change_severity: summary.change_severity,
      finding_count:
        typeof summary.finding_count === "number" ? summary.finding_count : 0,
    },
    report_markdown:
      typeof result.report_markdown === "string" ? result.report_markdown : "",
    runtime: {
      local_model:
        typeof runtime.local_model === "string" ? runtime.local_model : null,
      local_model_used: runtime.local_model_used === true,
    },
    quality: {
      status: typeof quality.status === "string" ? quality.status : "unknown",
      attempts:
        typeof quality.attempts === "number" ? quality.attempts : 0,
      corrections: Array.isArray(quality.corrections)
        ? quality.corrections.filter(
            (item): item is string => typeof item === "string"
          )
        : [],
    },
  };
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function queueInspectionCase(formData: FormData) {
  "use server";
  const result = await runInspectionCaseAction(formData);
  if (!result.ok) throw new Error(result.error);
}

async function reviewInspectionJob(formData: FormData) {
  "use server";
  const result = await reviewInspectionJobAction(formData);
  if (!result.ok) throw new Error(result.error);
}

export default async function RoomStateInspectionLabPage() {
  const { appUser } = await requireRole([
    "admin",
    "office",
    "field",
    "contractor",
  ]);
  const canReview = ["admin", "office"].includes(appUser.role);
  const supabase = getAdminClient();

  const [
    { data: caseRows, error: casesError },
    { data: photoRows, error: photosError },
    { data: trackedObjectRows, error: trackedObjectsError },
    { data: jobRows, error: jobsError },
  ] = await Promise.all([
    supabase.from("inspection_lab_cases").select("*").order("case_key"),
    supabase.from("inspection_lab_case_photos").select("*"),
    supabase.from("inspection_lab_tracked_objects").select("*"),
    supabase
      .from("agent_jobs")
      .select(
        "id, subject_id, status, result, review_decision, review_notes, created_at"
      )
      .eq("job_type", "inspection.photo.compare")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const loadError =
    casesError || photosError || trackedObjectsError || jobsError;
  if (loadError) {
    throw new Error(`Inspection workspace failed: ${loadError.message}`);
  }

  const cases = await listInspectionCases(
    caseRows ?? [],
    (photoRows ?? []) as InspectionLabCasePhotoRow[],
    (trackedObjectRows ?? []) as InspectionLabTrackedObjectRow[],
    supabase.storage.from(INSPECTION_STORAGE_BUCKET)
  );
  const jobs = (jobRows ?? []) as InspectionJob[];
  const latestJobByCase = new Map<string, InspectionJob>();
  for (const job of jobs) {
    if (job.subject_id && !latestJobByCase.has(job.subject_id)) {
      latestJobByCase.set(job.subject_id, job);
    }
  }

  const readyPairs = cases.filter(
    (item) => item.baselineExists && item.currentExists
  ).length;
  const awaitingReview = jobs.filter(
    (job) => job.status === "awaiting_review"
  ).length;

  return (
    <main className="space-y-6">
      <PageHeader
        title="Inspection Comparison"
        description="Capture a baseline and current room state, then send expiring copies to the local comparison agent."
        actions={
          <Button asChild variant="outline">
            <Link href="/agents">Agent Workspace</Link>
          </Button>
        }
      />

      <Alert variant="info">
        <AlertTitle>Local vision with human approval</AlertTitle>
        <AlertDescription>
          The agent runs on this PC with deterministic image checks and a local
          Ollama vision model. Supabase holds only private, expiring working
          copies. No public AI API is used, and every result waits for a person
          to approve or reject it.
        </AlertDescription>
      </Alert>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Inspection Cases" value={cases.length} />
        <StatCard title="Ready To Compare" value={readyPairs} />
        <StatCard title="Awaiting Review" value={awaitingReview} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Add Room Photo</CardTitle>
            <CardDescription>
              Use the same case ID and order number for matching baseline and
              current photos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RoomStateUploadForm />
          </CardContent>
        </Card>

        <div className="space-y-4">
          {cases.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <EmptyState
                  title="No inspection cases yet"
                  description="Upload a baseline room photo to create the first case."
                />
              </CardContent>
            </Card>
          ) : (
            cases.map((inspectionCase) => {
              const job = latestJobByCase.get(inspectionCase.id);
              const result = parseInspectionResult(job?.result);
              const canQueue =
                inspectionCase.baselineExists &&
                inspectionCase.currentExists &&
                !["queued", "running", "awaiting_review"].includes(
                  job?.status || ""
                );

              return (
                <Card key={inspectionCase.id}>
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle>{inspectionCase.caseId}</CardTitle>
                        <CardDescription>
                          {inspectionCase.roomType.replaceAll("_", " ")} ·{" "}
                          {inspectionCase.baselinePhotos.length} baseline ·{" "}
                          {inspectionCase.currentPhotos.length} current
                        </CardDescription>
                      </div>
                      <StatusBadge
                        status={job?.status || inspectionCase.reportStatus}
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant={
                          inspectionCase.baselineExists ? "success" : "warning"
                        }
                      >
                        Baseline{" "}
                        {inspectionCase.baselineExists ? "ready" : "missing"}
                      </Badge>
                      <Badge
                        variant={
                          inspectionCase.currentExists ? "success" : "warning"
                        }
                      >
                        Current{" "}
                        {inspectionCase.currentExists ? "ready" : "missing"}
                      </Badge>
                      {result ? (
                        <Badge variant="info">
                          {result.summary.pair_count} compared pair
                          {result.summary.pair_count === 1 ? "" : "s"}
                        </Badge>
                      ) : null}
                    </div>

                    {result ? (
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl border border-border p-3">
                          <p className="text-xs text-muted-foreground">
                            Same room
                          </p>
                          <p className="mt-1 font-medium capitalize">
                            {result.summary.same_room_verdict}
                          </p>
                        </div>
                        <div className="rounded-xl border border-border p-3">
                          <p className="text-xs text-muted-foreground">
                            Visible change
                          </p>
                          <p className="mt-1 font-medium capitalize">
                            {result.summary.change_severity}
                          </p>
                        </div>
                        <div className="rounded-xl border border-border p-3">
                          <p className="text-xs text-muted-foreground">
                            Quality
                          </p>
                          <p className="mt-1 font-medium capitalize">
                            {result.quality.status}
                          </p>
                        </div>
                      </div>
                    ) : null}

                    {job ? (
                      <p className="text-sm text-muted-foreground">
                        Requested {formatTimestamp(job.created_at)}
                        {result
                          ? ` · ${
                              result.runtime.local_model_used
                                ? result.runtime.local_model
                                : "deterministic fallback"
                            } · ${result.summary.finding_count} findings`
                          : ""}
                      </p>
                    ) : null}

                    {canQueue ? (
                      <form action={queueInspectionCase}>
                        <input
                          type="hidden"
                          name="case_id"
                          value={inspectionCase.caseId}
                        />
                        <Button type="submit">
                          Send To Local Comparison Agent
                        </Button>
                      </form>
                    ) : !inspectionCase.baselineExists ||
                      !inspectionCase.currentExists ? (
                      <p className="text-sm text-muted-foreground">
                        Add matching baseline and current photos before
                        requesting a comparison.
                      </p>
                    ) : null}

                    {job?.status === "awaiting_review" && result ? (
                      <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-4">
                        <div>
                          <p className="font-medium">
                            Local result is ready for review
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            The agent checked schema, paired inputs, privacy,
                            and usefulness in {result.quality.attempts} bounded
                            attempt
                            {result.quality.attempts === 1 ? "" : "s"}.
                          </p>
                        </div>
                        {canReview ? (
                          <form action={reviewInspectionJob} className="space-y-3">
                            <input
                              type="hidden"
                              name="job_id"
                              value={job.id}
                            />
                            <Textarea
                              name="notes"
                              aria-label="Inspection review notes"
                              placeholder="Optional review note"
                              maxLength={4000}
                            />
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="submit"
                                name="decision"
                                value="approved"
                              >
                                Approve Comparison
                              </Button>
                              <Button
                                type="submit"
                                name="decision"
                                value="rejected"
                                variant="outline"
                              >
                                Reject Comparison
                              </Button>
                            </div>
                          </form>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            An admin or office user must review this result.
                          </p>
                        )}
                      </div>
                    ) : null}

                    {job?.review_decision ? (
                      <p className="text-sm text-muted-foreground">
                        Review: {job.review_decision}
                        {job.review_notes ? ` · ${job.review_notes}` : ""}
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}

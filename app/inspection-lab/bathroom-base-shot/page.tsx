import { revalidatePath } from "next/cache";
import {
  analyzeBathroomBaseShot,
  analyzeBathroomObjectsWithAi,
  buildBathroomMarkdownReport,
  buildBathroomNarrative,
  compareBathroomBaseShots,
  mergeBathroomAiFindings,
} from "@/lib/inspection-lab/bathroom-base-shot-engine.mjs";
import { getAdminClient } from "@/lib/supabase/admin";
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
  FormField,
  Input,
  PageHeader,
  StatCard,
} from "@/components/ui";
import { requireRole } from "@/lib/auth/require-role";
import {
  type BathroomCaptureSlot,
  getStoragePath,
  INSPECTION_STORAGE_BUCKET,
  listBathroomCases,
  normalizeCaseId,
} from "@/lib/inspection-lab/bathroom-base-shot";

function isAllowedImageType(mimeType: string) {
  return ["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(
    mimeType
  );
}

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case "ready":
      return "success" as const;
    case "review_required":
      return "warning" as const;
    case "completed":
      return "info" as const;
    default:
      return "neutral" as const;
  }
}

function formatStatusLabel(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

async function uploadBathroomBaseShot(formData: FormData) {
  "use server";

  let caseId = "unknown";
  let slot: BathroomCaptureSlot | "unknown" = "unknown";
  let fileName = "unknown";
  let fileType = "unknown";
  let fileSize = 0;

  try {
    const { appUser } = await requireRole(["admin", "office", "field", "contractor"]);
    const supabase = getAdminClient();

    const rawCaseId = String(formData.get("case_id") || "").trim();
    slot = String(formData.get("slot") || "").trim() as BathroomCaptureSlot;
    const file = formData.get("photo");

    if (!rawCaseId) {
      throw new Error("Case ID is required.");
    }

    if (slot !== "baseline" && slot !== "current") {
      throw new Error("Capture slot must be baseline or current.");
    }

    if (!(file instanceof File) || file.size === 0) {
      throw new Error("Please choose a photo to upload.");
    }

    fileName = file.name || "unknown";
    fileType = file.type || "unknown";
    fileSize = file.size || 0;

    if (!isAllowedImageType(file.type)) {
      throw new Error("Only JPG, PNG, and WEBP images are allowed.");
    }

    if (file.size > 12 * 1024 * 1024) {
      throw new Error("Photo exceeds the 12 MB limit.");
    }

    caseId = normalizeCaseId(rawCaseId);
    const storagePath = getStoragePath(caseId, slot);
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(INSPECTION_STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: file.type || "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload photo: ${uploadError.message}`);
    }

    const now = new Date().toISOString();
    const payload =
      slot === "baseline"
        ? {
            case_key: caseId,
            room_type: "bathroom",
            capture_type: "base_shot",
            baseline_storage_path: storagePath,
            baseline_uploaded_at: now,
            last_uploaded_by_user_id: appUser.id,
            created_by_user_id: appUser.id,
            updated_at: now,
          }
        : {
            case_key: caseId,
            room_type: "bathroom",
            capture_type: "base_shot",
            current_storage_path: storagePath,
            current_uploaded_at: now,
            last_uploaded_by_user_id: appUser.id,
            created_by_user_id: appUser.id,
            updated_at: now,
          };

    const { error: upsertError } = await supabase
      .from("inspection_lab_cases")
      .upsert(payload, { onConflict: "case_key" });

    if (upsertError) {
      throw new Error(`Failed to save case metadata: ${upsertError.message}`);
    }

    revalidatePath("/inspection-lab/bathroom-base-shot");
  } catch (error) {
    console.error("[INSPECTION_LAB_UPLOAD_ERROR]", {
      caseId,
      slot,
      fileName,
      fileType,
      fileSize,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

async function runBathroomCase(formData: FormData) {
  "use server";

  let caseId = "unknown";

  try {
    await requireRole(["admin", "office", "field", "contractor"]);
    const supabase = getAdminClient();
    const rawCaseId = String(formData.get("case_id") || "").trim();

    if (!rawCaseId) {
      throw new Error("Case ID is required.");
    }

    caseId = normalizeCaseId(rawCaseId);

    const { data: row, error } = await supabase
      .from("inspection_lab_cases")
      .select(
        "id, case_key, baseline_storage_path, current_storage_path, room_type, capture_type"
      )
      .eq("case_key", caseId)
      .single();

    if (error || !row) {
      throw new Error("Inspection case not found.");
    }

    if (!row.baseline_storage_path || !row.current_storage_path) {
      throw new Error("Both baseline and current photos are required.");
    }

    const [
      { data: baselineBlob, error: baselineError },
      { data: currentBlob, error: currentError },
    ] = await Promise.all([
      supabase.storage
        .from(INSPECTION_STORAGE_BUCKET)
        .download(row.baseline_storage_path),
      supabase.storage
        .from(INSPECTION_STORAGE_BUCKET)
        .download(row.current_storage_path),
    ]);

    if (baselineError || !baselineBlob) {
      throw new Error(`Failed to download baseline photo: ${baselineError?.message}`);
    }

    if (currentError || !currentBlob) {
      throw new Error(`Failed to download current photo: ${currentError?.message}`);
    }

    const baselineBuffer = Buffer.from(await baselineBlob.arrayBuffer());
    const currentBuffer = Buffer.from(await currentBlob.arrayBuffer());

    const baseline = await analyzeBathroomBaseShot(baselineBuffer, "baseline");
    const current = await analyzeBathroomBaseShot(currentBuffer, "current");
    const baseComparison = compareBathroomBaseShots(baseline, current);
    let comparison = baseComparison;

    try {
      const aiAnalysis = await analyzeBathroomObjectsWithAi(
        baselineBuffer,
        currentBuffer,
        baseComparison
      );

      if (aiAnalysis) {
        comparison = mergeBathroomAiFindings(baseComparison, aiAnalysis);
      }
    } catch (aiError) {
      console.error("[INSPECTION_LAB_AI_WARNING]", {
        caseId,
        message: aiError instanceof Error ? aiError.message : String(aiError),
      });
    }

    const narrative = buildBathroomNarrative(caseId, comparison);
    const reportMarkdown = buildBathroomMarkdownReport(
      caseId,
      baseline,
      current,
      comparison
    );

    const { error: updateError } = await supabase
      .from("inspection_lab_cases")
      .update({
        report_status: comparison.reviewRequired ? "review_required" : "ready",
        comparison_summary: comparison,
        report_markdown: reportMarkdown,
        report_generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (updateError) {
      throw new Error(`Failed to save analysis result: ${updateError.message}`);
    }

    console.log("[INSPECTION_LAB]", {
      caseId,
      narrative,
      comparison,
    });

    revalidatePath("/inspection-lab/bathroom-base-shot");
  } catch (error) {
    console.error("[INSPECTION_LAB_RUN_ERROR]", {
      caseId,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export default async function BathroomBaseShotLabPage() {
  await requireRole(["admin", "office", "field", "contractor"]);
  const supabase = getAdminClient();
  const { data: caseRows, error } = await supabase
    .from("inspection_lab_cases")
    .select("*")
    .order("case_key");

  if (error) {
    throw new Error(`Failed to load inspection lab cases: ${error.message}`);
  }

  const cases = await listBathroomCases(
    caseRows || [],
    supabase.storage.from(INSPECTION_STORAGE_BUCKET)
  );
  const readyCases = cases.filter((item) => item.baselineExists && item.currentExists);
  const reviewCases = cases.filter((item) => item.findings?.reviewRequired).length;

  return (
    <main className="space-y-6">
      <PageHeader
        title="Bathroom Base-Shot Lab"
        description="Phone-friendly bathroom capture page backed by Supabase storage. Upload one baseline shot and one current shot, then run the comparison engine."
      />

      <Alert variant="info">
        <AlertTitle>Experimental but deployed-friendly</AlertTitle>
        <AlertDescription>
          This prototype stores photos and results in Supabase so the flow can be used from the
          real app, even while the inspection model stays intentionally narrow.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Cases" value={cases.length} />
        <StatCard title="Ready To Compare" value={readyCases.length} />
        <StatCard title="Review Flags" value={reviewCases} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px),1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Capture Upload</CardTitle>
            <CardDescription>
              Create or reuse a case ID, choose whether this is the baseline or current photo, then
              upload directly from your phone camera or gallery.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={uploadBathroomBaseShot} className="space-y-4">
              <FormField
                id="case_id"
                label="Case ID"
                required
                hint="Use a stable name like apartment-12-bathroom or bathroom-test-001."
              >
                <Input
                  id="case_id"
                  name="case_id"
                  placeholder="e.g., apartment-12-bathroom"
                  required
                />
              </FormField>

              <FormField
                id="slot"
                label="Photo Type"
                required
                hint="Baseline is your reference photo. Current is the newer comparison photo."
              >
                <select
                  id="slot"
                  name="slot"
                  className="input w-full"
                  defaultValue="baseline"
                  required
                >
                  <option value="baseline">Baseline</option>
                  <option value="current">Current</option>
                </select>
              </FormField>

              <FormField
                id="photo"
                label="Bathroom Base Shot"
                required
                hint="Use one portrait photo from the main bathroom direction."
              >
                <Input
                  id="photo"
                  name="photo"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  required
                />
              </FormField>

              <Button type="submit" className="w-full">
                Upload Photo
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Case Results</CardTitle>
            <CardDescription>
              Uploads are done. This section is where each bathroom case becomes readable and usable.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {cases.length === 0 ? (
              <EmptyState
                title="No bathroom cases yet"
                description="Upload a baseline or current photo from your phone to create the first case."
              />
            ) : (
              <div className="space-y-4">
                {cases.map((item) => (
                  <Card key={item.id} size="sm" className="border border-border/70">
                    <CardHeader className="gap-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <CardTitle>{item.caseId}</CardTitle>
                          <CardDescription>Bathroom base-shot comparison case</CardDescription>
                        </div>
                        <Badge variant={getStatusBadgeVariant(item.reportStatus)}>
                          {formatStatusLabel(item.reportStatus)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border border-border/70 p-3">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <div className="font-medium">Baseline</div>
                            <Badge variant={item.baselineExists ? "success" : "neutral"}>
                              {item.baselineExists ? "Uploaded" : "Missing"}
                            </Badge>
                          </div>
                          {item.baselineSignedUrl ? (
                            <Button asChild variant="outline" size="sm" className="w-full">
                              <a href={item.baselineSignedUrl} target="_blank" rel="noreferrer">
                                View Baseline Photo
                              </a>
                            </Button>
                          ) : null}
                        </div>

                        <div className="rounded-lg border border-border/70 p-3">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <div className="font-medium">Current</div>
                            <Badge variant={item.currentExists ? "success" : "neutral"}>
                              {item.currentExists ? "Uploaded" : "Missing"}
                            </Badge>
                          </div>
                          {item.currentSignedUrl ? (
                            <Button asChild variant="outline" size="sm" className="w-full">
                              <a href={item.currentSignedUrl} target="_blank" rel="noreferrer">
                                View Current Photo
                              </a>
                            </Button>
                          ) : null}
                        </div>
                      </div>

                      {item.findings ? (
                        <div className="grid gap-3 rounded-lg border border-border/70 p-3 sm:grid-cols-3">
                          <div>
                            <div className="text-xs uppercase text-muted-foreground">Same Room</div>
                            <div className="font-medium">{formatStatusLabel(item.findings.sameRoomVerdict)}</div>
                          </div>
                          <div>
                            <div className="text-xs uppercase text-muted-foreground">Change</div>
                            <div className="font-medium">{formatStatusLabel(item.findings.changeSeverity)}</div>
                          </div>
                          <div>
                            <div className="text-xs uppercase text-muted-foreground">Flags</div>
                            <div className="font-medium">{item.findings.findingCount}</div>
                          </div>
                        </div>
                      ) : null}

                      {item.findings?.highlights?.length ? (
                        <div className="space-y-2">
                          <div className="text-sm font-medium">Top findings</div>
                          <ul className="space-y-2 text-sm text-muted-foreground">
                            {item.findings.highlights.map((highlight, index) => (
                              <li key={`${item.id}-highlight-${index}`} className="rounded-lg border border-border/60 px-3 py-2">
                                {highlight}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {item.reportMarkdown ? (
                        <div className="space-y-2 rounded-lg border border-border/70 p-3">
                          <div className="text-sm font-medium">Narrative report</div>
                          <pre className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
                            {item.reportMarkdown}
                          </pre>
                        </div>
                      ) : (
                        <Alert variant="info">
                          <AlertTitle>Engine not run yet</AlertTitle>
                          <AlertDescription>
                            Upload both photos, then run the engine to generate findings and a report.
                          </AlertDescription>
                        </Alert>
                      )}

                      <form action={runBathroomCase}>
                        <input type="hidden" name="case_id" value={item.caseId} />
                        <Button
                          type="submit"
                          className="w-full sm:w-auto"
                          disabled={!item.baselineExists || !item.currentExists}
                        >
                          Run Engine
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

import { revalidatePath } from "next/cache";
import {
  analyzeBathroomBaseShot,
  buildBathroomMarkdownReport,
  buildBathroomNarrative,
  compareBathroomBaseShots,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
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

    const baseline = await analyzeBathroomBaseShot(
      Buffer.from(await baselineBlob.arrayBuffer()),
      "baseline"
    );
    const current = await analyzeBathroomBaseShot(
      Buffer.from(await currentBlob.arrayBuffer()),
      "current"
    );
    const comparison = compareBathroomBaseShots(baseline, current);
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
            <CardTitle>Case Runner</CardTitle>
            <CardDescription>
              Once both photos exist, run the comparison engine and save the result in the app.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {cases.length === 0 ? (
              <EmptyState
                title="No bathroom cases yet"
                description="Upload a baseline or current photo from your phone to create the first case."
              />
            ) : (
              <TableShell>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Case</TableHead>
                      <TableHead>Baseline</TableHead>
                      <TableHead>Current</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cases.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.caseId}</TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            <Badge variant={item.baselineExists ? "success" : "neutral"}>
                              {item.baselineExists ? "Uploaded" : "Missing"}
                            </Badge>
                            {item.baselineSignedUrl ? (
                              <a
                                href={item.baselineSignedUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="block text-xs underline"
                              >
                                View
                              </a>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            <Badge variant={item.currentExists ? "success" : "neutral"}>
                              {item.currentExists ? "Uploaded" : "Missing"}
                            </Badge>
                            {item.currentSignedUrl ? (
                              <a
                                href={item.currentSignedUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="block text-xs underline"
                              >
                                View
                              </a>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.findings ? (
                            <div className="space-y-1 text-sm">
                              <div>
                                <strong>Room:</strong> {item.findings.sameRoomVerdict}
                              </div>
                              <div>
                                <strong>Change:</strong> {item.findings.changeSeverity}
                              </div>
                              <div>
                                <strong>Flags:</strong> {item.findings.findingCount}
                              </div>
                            </div>
                          ) : item.reportExists ? (
                            <Badge variant="info">Report saved</Badge>
                          ) : (
                            <Badge variant="neutral">Not run yet</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <form action={runBathroomCase}>
                            <input type="hidden" name="case_id" value={item.caseId} />
                            <Button
                              type="submit"
                              size="sm"
                              disabled={!item.baselineExists || !item.currentExists}
                            >
                              Run Engine
                            </Button>
                          </form>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableShell>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

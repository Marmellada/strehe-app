import { revalidatePath } from "next/cache";
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
  getCasePhotoStoragePath,
  INSPECTION_STORAGE_BUCKET,
  listBathroomCases,
  normalizeCaseId,
  sortInspectionLabPhotoRows,
  type InspectionLabCasePhotoRow,
  type InspectionRoomType,
} from "@/lib/inspection-lab/bathroom-base-shot";
import { runBathroomBaseShotCase } from "@/lib/inspection-lab/bathroom-base-shot-runner";

const PHOTO_TYPE_OPTIONS: Record<InspectionRoomType, readonly string[]> = {
  bathroom: [
    "wide",
    "entrance",
    "sink",
    "toilet",
    "mirror",
    "shower",
    "bathtub",
    "cabinet",
    "shelf",
    "trash_bin",
    "soap_dispenser",
    "decor",
    "plant",
    "other",
  ],
  living_room: [
    "wide",
    "entrance",
    "sofa",
    "coffee_table",
    "tv",
    "tv_stand",
    "armchair",
    "side_table",
    "lamp",
    "rug",
    "shelf",
    "cabinet",
    "wall_art",
    "mirror",
    "plant",
    "decor",
    "other",
  ],
};

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
    case "draft":
      return "neutral" as const;
    default:
      return "neutral" as const;
  }
}

function formatStatusLabel(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatRoomTypeLabel(roomType: InspectionRoomType) {
  return roomType.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeRoomType(value: string): InspectionRoomType {
  return value === "living_room" ? "living_room" : "bathroom";
}

async function ensureInspectionCase(
  caseId: string,
  roomType: InspectionRoomType,
  userId: string
) {
  const supabase = getAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("inspection_lab_cases")
    .upsert(
      {
        case_key: caseId,
        room_type: roomType,
        capture_type: "base_shot",
        created_by_user_id: userId,
        last_uploaded_by_user_id: userId,
        updated_at: now,
      },
      { onConflict: "case_key" }
    )
    .select("id, case_key, room_type")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create or load inspection case: ${error?.message || "unknown error"}`);
  }

  return data;
}

async function resetCaseReport(caseRowId: string, userId: string) {
  const supabase = getAdminClient();
  const { error } = await supabase
    .from("inspection_lab_cases")
    .update({
      report_status: "draft",
      comparison_summary: null,
      report_markdown: null,
      report_generated_at: null,
      last_uploaded_by_user_id: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", caseRowId);

  if (error) {
    throw new Error(`Failed to reset case report: ${error.message}`);
  }
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
    const roomType = normalizeRoomType(String(formData.get("room_type") || "").trim());
    slot = String(formData.get("slot") || "").trim() as BathroomCaptureSlot;
    const orderIndexValue = String(formData.get("order_index") || "").trim();
    const photoTypeValue = String(formData.get("photo_type") || "").trim();
    const file = formData.get("photo");

    if (!rawCaseId) {
      throw new Error("Case ID is required.");
    }

    if (slot !== "baseline" && slot !== "current") {
      throw new Error("Capture slot must be baseline or current.");
    }

    const parsedOrderIndex = Number(orderIndexValue);
    if (!Number.isInteger(parsedOrderIndex) || parsedOrderIndex < 1) {
      throw new Error("Order must be a whole number starting from 1.");
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
    const caseRow = await ensureInspectionCase(caseId, roomType, appUser.id);

    const { data: existingPhoto } = await supabase
      .from("inspection_lab_case_photos")
      .select("id, storage_path")
      .eq("case_id", caseRow.id)
      .eq("capture_slot", slot)
      .eq("order_index", parsedOrderIndex)
      .maybeSingle();

    const storagePath = getCasePhotoStoragePath(
      caseId,
      slot,
      parsedOrderIndex,
      file.name || "capture.jpg"
    );

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(INSPECTION_STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload photo: ${uploadError.message}`);
    }

    if (existingPhoto?.storage_path) {
      await supabase.storage
        .from(INSPECTION_STORAGE_BUCKET)
        .remove([existingPhoto.storage_path]);
    }

    const { error: photoUpsertError } = await supabase
      .from("inspection_lab_case_photos")
      .upsert(
        {
          case_id: caseRow.id,
          capture_slot: slot,
          storage_path: storagePath,
          photo_type: photoTypeValue || null,
          order_index: parsedOrderIndex,
        },
        { onConflict: "case_id,capture_slot,order_index" }
      );

    if (photoUpsertError) {
      throw new Error(`Failed to save photo metadata: ${photoUpsertError.message}`);
    }

    await resetCaseReport(caseRow.id, appUser.id);
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

async function updateBathroomPhotoMetadata(formData: FormData) {
  "use server";

  try {
    const { appUser } = await requireRole(["admin", "office", "field", "contractor"]);
    const supabase = getAdminClient();

    const photoId = String(formData.get("photo_id") || "").trim();
    const caseRowId = String(formData.get("case_row_id") || "").trim();
    const photoTypeValue = String(formData.get("photo_type") || "").trim();
    const orderIndexValue = String(formData.get("order_index") || "").trim();

    if (!photoId || !caseRowId) {
      throw new Error("Photo ID and case ID are required.");
    }

    const parsedOrderIndex = Number(orderIndexValue);
    if (!Number.isInteger(parsedOrderIndex) || parsedOrderIndex < 1) {
      throw new Error("Order must be a whole number starting from 1.");
    }

    const { error } = await supabase
      .from("inspection_lab_case_photos")
      .update({
        photo_type: photoTypeValue || null,
        order_index: parsedOrderIndex,
      })
      .eq("id", photoId);

    if (error) {
      throw new Error(`Failed to update photo metadata: ${error.message}`);
    }

    await resetCaseReport(caseRowId, appUser.id);
    revalidatePath("/inspection-lab/bathroom-base-shot");
  } catch (error) {
    console.error("[INSPECTION_LAB_METADATA_ERROR]", {
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
      .select("id, case_key, room_type")
      .eq("case_key", caseId)
      .single();

    if (error || !row) {
      throw new Error("Inspection case not found.");
    }

    const { data: photoRows, error: photosError } = await supabase
      .from("inspection_lab_case_photos")
      .select("*")
      .eq("case_id", row.id);

    if (photosError) {
      throw new Error(`Failed to load capture set: ${photosError.message}`);
    }

    const orderedPhotos = sortInspectionLabPhotoRows(
      (photoRows || []) as InspectionLabCasePhotoRow[]
    );

    const baselinePhotoRows = orderedPhotos.filter(
      (photo) => photo.capture_slot === "baseline"
    );
    const currentPhotoRows = orderedPhotos.filter(
      (photo) => photo.capture_slot === "current"
    );

    if (baselinePhotoRows.length === 0 || currentPhotoRows.length === 0) {
      throw new Error("Both baseline and current capture sets are required.");
    }

    const downloadAll = async (rowsToDownload: InspectionLabCasePhotoRow[]) => {
      return Promise.all(
        rowsToDownload.map(async (photo) => {
          const { data: photoBlob, error: photoError } = await supabase.storage
            .from(INSPECTION_STORAGE_BUCKET)
            .download(photo.storage_path);

          if (photoError || !photoBlob) {
            throw new Error(`Failed to download photo: ${photoError?.message || photo.storage_path}`);
          }

          return {
            id: photo.id,
            captureSlot: photo.capture_slot,
            orderIndex: photo.order_index,
            photoType: photo.photo_type,
            storagePath: photo.storage_path,
            buffer: Buffer.from(await photoBlob.arrayBuffer()),
          };
        })
      );
    };

    const [baselinePhotos, currentPhotos] = await Promise.all([
      downloadAll(baselinePhotoRows),
      downloadAll(currentPhotoRows),
    ]);

    const roomType = normalizeRoomType(String(row.room_type || "bathroom"));

    const result = await runBathroomBaseShotCase(
      caseId,
      roomType,
      baselinePhotos,
      currentPhotos
    );

    const comparisonRecord = result.comparison as Record<string, unknown>;
    const reviewRequired = Boolean(comparisonRecord.reviewRequired);

    const { error: updateError } = await supabase
      .from("inspection_lab_cases")
      .update({
        report_status: reviewRequired ? "review_required" : "ready",
        comparison_summary: result.comparison,
        report_markdown: result.reportMarkdown,
        report_generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (updateError) {
      throw new Error(`Failed to save analysis result: ${updateError.message}`);
    }

    console.log("[INSPECTION_LAB]", {
      caseId,
      roomType,
      narrative: result.narrative,
      comparison: result.comparison,
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

function renderPhotoTypeOptions(roomType: InspectionRoomType, selected?: string | null) {
  return PHOTO_TYPE_OPTIONS[roomType].map((value) => (
    <option key={value} value={value} selected={selected ? selected === value : undefined}>
      {value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())}
    </option>
  ));
}

export default async function BathroomBaseShotLabPage() {
  await requireRole(["admin", "office", "field", "contractor"]);
  const supabase = getAdminClient();

  const [{ data: caseRows, error: casesError }, { data: photoRows, error: photosError }] =
    await Promise.all([
      supabase.from("inspection_lab_cases").select("*").order("case_key"),
      supabase.from("inspection_lab_case_photos").select("*"),
    ]);

  if (casesError) {
    throw new Error(`Failed to load inspection lab cases: ${casesError.message}`);
  }

  if (photosError) {
    throw new Error(`Failed to load inspection lab photos: ${photosError.message}`);
  }

  const cases = await listBathroomCases(
    caseRows || [],
    (photoRows || []) as InspectionLabCasePhotoRow[],
    supabase.storage.from(INSPECTION_STORAGE_BUCKET)
  );

  const readyCases = cases.filter((item) => item.baselineExists && item.currentExists);
  const reviewCases = cases.filter((item) => item.findings?.reviewRequired).length;
  const trackedTargetsCount = cases.reduce(
    (total, item) => total + item.trackedTargets.length,
    0
  );

  return (
    <main className="space-y-6">
      <PageHeader
        title="Room State Lab"
        description="Use the main inspection lab to refine ordered baseline and current capture sets for bathroom or living room cases."
      />

      <Alert variant="info">
        <AlertTitle>Main lab, now for bathroom and living room</AlertTitle>
        <AlertDescription>
          This page stays on the same route, but now supports room-specific testing. Upload ordered
          baseline and current sets, then run the engine and inspect what it decided to track.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Cases" value={cases.length} />
        <StatCard title="Ready To Compare" value={readyCases.length} />
        <StatCard title="Review Flags" value={reviewCases} />
        <StatCard title="Tracked Targets" value={trackedTargetsCount} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px),1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Upload Ordered Capture</CardTitle>
            <CardDescription>
              Use one upload per order position. For living room, a good starting set is: 1 wide,
              2 sofa, 3 coffee_table, 4 tv, 5 shelf or decor.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={uploadBathroomBaseShot} className="space-y-4">
              <FormField
                id="case_id"
                label="Case ID"
                required
                hint="Use a stable case name like apartment-12-living-room-main."
              >
                <Input
                  id="case_id"
                  name="case_id"
                  placeholder="e.g., apartment-12-living-room-main"
                  required
                />
              </FormField>

              <FormField
                id="room_type"
                label="Room Type"
                required
                hint="Living room is better for daily movement and replacement tests."
              >
                <select
                  id="room_type"
                  name="room_type"
                  className="input w-full"
                  defaultValue="living_room"
                  required
                >
                  <option value="living_room">Living Room</option>
                  <option value="bathroom">Bathroom</option>
                </select>
              </FormField>

              <FormField
                id="slot"
                label="Capture Set"
                required
                hint="Baseline defines the room contract. Current is the new observation set."
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
                id="order_index"
                label="Order"
                required
                hint="Keep the same order logic between baseline and current."
              >
                <Input
                  id="order_index"
                  name="order_index"
                  type="number"
                  min={1}
                  step={1}
                  placeholder="e.g., 1"
                  required
                />
              </FormField>

              <FormField
                id="photo_type"
                label="Photo Type"
                hint="Pick a room-specific angle or object label. For living room, start with wide, sofa, coffee_table, tv."
              >
                <select
                  id="photo_type"
                  name="photo_type"
                  className="input w-full"
                  defaultValue="wide"
                >
                  {PHOTO_TYPE_OPTIONS.living_room.map((value) => (
                    <option key={value} value={value}>
                      {value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField
                id="photo"
                label="Room Photo"
                required
                hint="Use one clear photo per order slot. Re-upload the same capture set and order to replace it."
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
              This is your daily testing surface: capture coverage, tracked targets, findings, and
              report text.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {cases.length === 0 ? (
              <EmptyState
                title="No room cases yet"
                description="Upload a baseline photo set to create the first inspection lab case."
              />
            ) : (
              <div className="space-y-4">
                {cases.map((item) => (
                  <Card key={item.id} size="sm" className="border border-border/70">
                    <CardHeader className="gap-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <CardTitle>{item.caseId}</CardTitle>
                          <CardDescription>{formatRoomTypeLabel(item.roomType)} ordered capture case</CardDescription>
                        </div>
                        <Badge variant={getStatusBadgeVariant(item.reportStatus)}>
                          {formatStatusLabel(item.reportStatus)}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-lg border border-border/70 p-3">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <div className="font-medium">Baseline Set</div>
                            <Badge variant={item.baselineExists ? "success" : "neutral"}>
                              {item.baselinePhotos.length} photo{item.baselinePhotos.length === 1 ? "" : "s"}
                            </Badge>
                          </div>

                          {item.baselinePhotos.length ? (
                            <div className="space-y-3">
                              {item.baselinePhotos.map((photo) => (
                                <div key={photo.id} className="rounded-lg border border-border/60 p-3">
                                  <div className="mb-2 flex items-center justify-between gap-2">
                                    <div className="text-sm font-medium">
                                      #{photo.orderIndex ?? "?"} {photo.photoType || "unspecified"}
                                    </div>
                                    {photo.signedUrl ? (
                                      <Button asChild variant="outline" size="sm">
                                        <a href={photo.signedUrl} target="_blank" rel="noreferrer">
                                          View
                                        </a>
                                      </Button>
                                    ) : null}
                                  </div>

                                  <form action={updateBathroomPhotoMetadata} className="space-y-3">
                                    <input type="hidden" name="photo_id" value={photo.id} />
                                    <input type="hidden" name="case_row_id" value={item.id} />

                                    <div className="grid gap-3 sm:grid-cols-2">
                                      <div>
                                        <label
                                          htmlFor={`photo_type_${photo.id}`}
                                          className="mb-1 block text-sm font-medium"
                                        >
                                          Photo Type
                                        </label>
                                        <select
                                          id={`photo_type_${photo.id}`}
                                          name="photo_type"
                                          className="input w-full"
                                          defaultValue={photo.photoType || "wide"}
                                        >
                                          {PHOTO_TYPE_OPTIONS[item.roomType].map((value) => (
                                            <option key={value} value={value}>
                                              {value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())}
                                            </option>
                                          ))}
                                        </select>
                                      </div>

                                      <div>
                                        <label
                                          htmlFor={`order_index_${photo.id}`}
                                          className="mb-1 block text-sm font-medium"
                                        >
                                          Order
                                        </label>
                                        <Input
                                          id={`order_index_${photo.id}`}
                                          name="order_index"
                                          type="number"
                                          min={1}
                                          step={1}
                                          defaultValue={photo.orderIndex ?? 1}
                                          required
                                        />
                                      </div>
                                    </div>

                                    <Button type="submit" variant="outline" size="sm">
                                      Save Metadata
                                    </Button>
                                  </form>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground">No baseline photos yet.</div>
                          )}
                        </div>

                        <div className="rounded-lg border border-border/70 p-3">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <div className="font-medium">Current Set</div>
                            <Badge variant={item.currentExists ? "success" : "neutral"}>
                              {item.currentPhotos.length} photo{item.currentPhotos.length === 1 ? "" : "s"}
                            </Badge>
                          </div>

                          {item.currentPhotos.length ? (
                            <div className="space-y-3">
                              {item.currentPhotos.map((photo) => (
                                <div key={photo.id} className="rounded-lg border border-border/60 p-3">
                                  <div className="mb-2 flex items-center justify-between gap-2">
                                    <div className="text-sm font-medium">
                                      #{photo.orderIndex ?? "?"} {photo.photoType || "unspecified"}
                                    </div>
                                    {photo.signedUrl ? (
                                      <Button asChild variant="outline" size="sm">
                                        <a href={photo.signedUrl} target="_blank" rel="noreferrer">
                                          View
                                        </a>
                                      </Button>
                                    ) : null}
                                  </div>

                                  <form action={updateBathroomPhotoMetadata} className="space-y-3">
                                    <input type="hidden" name="photo_id" value={photo.id} />
                                    <input type="hidden" name="case_row_id" value={item.id} />

                                    <div className="grid gap-3 sm:grid-cols-2">
                                      <div>
                                        <label
                                          htmlFor={`photo_type_${photo.id}`}
                                          className="mb-1 block text-sm font-medium"
                                        >
                                          Photo Type
                                        </label>
                                        <select
                                          id={`photo_type_${photo.id}`}
                                          name="photo_type"
                                          className="input w-full"
                                          defaultValue={photo.photoType || "wide"}
                                        >
                                          {PHOTO_TYPE_OPTIONS[item.roomType].map((value) => (
                                            <option key={value} value={value}>
                                              {value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())}
                                            </option>
                                          ))}
                                        </select>
                                      </div>

                                      <div>
                                        <label
                                          htmlFor={`order_index_${photo.id}`}
                                          className="mb-1 block text-sm font-medium"
                                        >
                                          Order
                                        </label>
                                        <Input
                                          id={`order_index_${photo.id}`}
                                          name="order_index"
                                          type="number"
                                          min={1}
                                          step={1}
                                          defaultValue={photo.orderIndex ?? 1}
                                          required
                                        />
                                      </div>
                                    </div>

                                    <Button type="submit" variant="outline" size="sm">
                                      Save Metadata
                                    </Button>
                                  </form>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground">No current photos yet.</div>
                          )}
                        </div>
                      </div>

                      {item.findings ? (
                        <div className="grid gap-3 rounded-lg border border-border/70 p-3 sm:grid-cols-3">
                          <div>
                            <div className="text-xs uppercase text-muted-foreground">Same Room</div>
                            <div className="font-medium">
                              {formatStatusLabel(item.findings.sameRoomVerdict)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs uppercase text-muted-foreground">Change</div>
                            <div className="font-medium">
                              {formatStatusLabel(item.findings.changeSeverity)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs uppercase text-muted-foreground">Flags</div>
                            <div className="font-medium">{item.findings.findingCount}</div>
                          </div>
                        </div>
                      ) : null}

                      <div className="rounded-lg border border-border/70 p-3">
                        <div className="mb-2 text-sm font-medium">Tracked From Baseline</div>

                        {item.trackedTargets.length ? (
                          <ul className="space-y-2 text-sm">
                            {item.trackedTargets.map((target) => (
                              <li
                                key={`${item.id}-${target.key}`}
                                className="rounded-lg border border-border/60 px-3 py-2"
                              >
                                <div className="font-medium">
                                  {target.label.replace(/_/g, " ")}
                                </div>
                                <div className="text-muted-foreground">
                                  {target.status} · {target.importance} · {target.reason}
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            Nothing explicit has been extracted yet. Run the engine after baseline
                            and current sets are complete.
                          </div>
                        )}
                      </div>

                      {item.findings?.highlights?.length ? (
                        <div className="space-y-2">
                          <div className="text-sm font-medium">Top findings</div>
                          <ul className="space-y-2 text-sm text-muted-foreground">
                            {item.findings.highlights.map((highlight, index) => (
                              <li
                                key={`${item.id}-highlight-${index}`}
                                className="rounded-lg border border-border/60 px-3 py-2"
                              >
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
                            Upload at least one ordered baseline photo and one ordered current photo,
                            then run the engine.
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
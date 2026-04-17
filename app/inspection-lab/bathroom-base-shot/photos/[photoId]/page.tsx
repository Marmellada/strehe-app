import { notFound } from "next/navigation";
import { Button, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth/require-role";
import { getAdminClient } from "@/lib/supabase/admin";
import { PhotoObjectReview } from "@/components/inspection-lab/PhotoObjectReview";
import {
  type InspectionLabCasePhotoRow,
  type InspectionLabTrackedObjectRow,
  type InspectionTrackedObject,
  INSPECTION_STORAGE_BUCKET,
} from "@/lib/inspection-lab/bathroom-base-shot";
import {
  saveInspectionTrackedObjectAction,
  saveInspectionTrackedObjectMarkerAction,
} from "@/app/inspection-lab/bathroom-base-shot/actions";

async function saveTrackedObjectFormAction(formData: FormData): Promise<void> {
  "use server";

  const result = await saveInspectionTrackedObjectAction(formData);

  if (!result.ok) {
    throw new Error(result.error);
  }
}

async function saveTrackedObjectMarkerFormAction(formData: FormData): Promise<void> {
  "use server";

  const result = await saveInspectionTrackedObjectMarkerAction(formData);

  if (!result.ok) {
    throw new Error(result.error);
  }
}

function mapTrackedObjects(rows: InspectionLabTrackedObjectRow[]): InspectionTrackedObject[] {
  return rows.map((row) => ({
    id: row.id,
    key: row.object_key,
    label: row.label,
    category: row.category,
    source:
      row.source === "baseline_capture" ||
      row.source === "auto_detected" ||
      row.source === "manual_added" ||
      row.source === "manual_corrected"
        ? row.source
        : "engine",
    status: "tracked",
    activityStatus: row.is_active ? "active" : "inactive",
    importance: row.importance === "medium" ? "medium" : "high",
    reason: row.review_note || "Linked to this baseline photo.",
    baselinePhotoId: row.baseline_photo_id,
    baselineOrderIndex: row.baseline_order_index,
    baselinePhotoType: row.baseline_photo_type,
    baselineStoragePath: row.baseline_storage_path,
    markerX: row.marker_x,
    markerY: row.marker_y,
  }));
}

export default async function InspectionPhotoReviewPage({
  params,
}: {
  params: Promise<{ photoId: string }>;
}) {
  await requireRole(["admin", "office", "field", "contractor"]);
  const { photoId } = await params;
  const supabase = getAdminClient();

  const { data: photoRow, error: photoError } = await supabase
    .from("inspection_lab_case_photos")
    .select("*")
    .eq("id", photoId)
    .single();

  if (photoError || !photoRow) {
    notFound();
  }

  const typedPhotoRow = photoRow as InspectionLabCasePhotoRow;

  const { data: caseRow, error: caseError } = await supabase
    .from("inspection_lab_cases")
    .select("id, case_key, room_type")
    .eq("id", typedPhotoRow.case_id)
    .single();

  if (caseError || !caseRow) {
    notFound();
  }

  const { data: trackedObjectRows, error: trackedObjectsError } = await supabase
    .from("inspection_lab_tracked_objects")
    .select("*")
    .eq("case_id", typedPhotoRow.case_id)
    .eq("baseline_photo_id", typedPhotoRow.id)
    .order("label");

  if (trackedObjectsError) {
    throw new Error(
      `Failed to load tracked objects for photo review: ${trackedObjectsError.message}`
    );
  }

  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from(INSPECTION_STORAGE_BUCKET)
    .createSignedUrl(typedPhotoRow.storage_path, 60 * 60);

  if (signedUrlError || !signedUrlData?.signedUrl) {
    throw new Error(
      `Failed to create signed URL for review photo: ${signedUrlError?.message || "unknown error"}`
    );
  }

  const trackedObjects = mapTrackedObjects(
    (trackedObjectRows || []) as InspectionLabTrackedObjectRow[]
  );
  const processingStatus = typedPhotoRow.processing_status || "ready";

  return (
    <main className="space-y-6">
      <PageHeader
        title="Photo Review"
        description={`Case ${caseRow.case_key} · ${caseRow.room_type.replaceAll("_", " ")} · baseline photo #${typedPhotoRow.order_index ?? "?"}`}
        actions={
          <Button asChild variant="outline">
            <a href="/inspection-lab/bathroom-base-shot">Back To Lab</a>
          </Button>
        }
      />

      {processingStatus !== "ready" ? (
        <div className="rounded-lg border border-border/70 p-4 text-sm text-muted-foreground">
          {processingStatus === "processing"
            ? "This baseline photo is still processing. Review will unlock automatically when it is ready."
            : processingStatus === "failed"
              ? `This baseline photo is not ready for review because processing failed${typedPhotoRow.processing_error ? `: ${typedPhotoRow.processing_error}` : "."}`
              : "This baseline photo is not ready for review yet."}
        </div>
      ) : (
        <PhotoObjectReview
          caseRowId={typedPhotoRow.case_id}
          photoId={typedPhotoRow.id}
          photoLabel={`#${typedPhotoRow.order_index ?? "?"} ${typedPhotoRow.photo_type || "unspecified"}`}
          signedUrl={signedUrlData.signedUrl}
          trackedObjects={trackedObjects}
          seedModel={typedPhotoRow.seed_model || null}
          seedDebugResult={typedPhotoRow.seed_debug_result ?? null}
          saveTrackedObjectAction={saveTrackedObjectFormAction}
          saveMarkerAction={saveTrackedObjectMarkerFormAction}
        />
      )}
    </main>
  );
}

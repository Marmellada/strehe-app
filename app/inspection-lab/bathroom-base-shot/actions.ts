"use server";

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/require-role";
import {
  INSPECTION_STORAGE_BUCKET,
  normalizeCaseId,
  sortInspectionLabPhotoRows,
  type InspectionLabCasePhotoRow,
  type InspectionRoomType,
  type BathroomCaptureSlot,
} from "@/lib/inspection-lab/bathroom-base-shot";
import { runBathroomBaseShotCase } from "@/lib/inspection-lab/bathroom-base-shot-runner";

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
    throw new Error(
      `Failed to create or load inspection case: ${error?.message || "unknown error"}`
    );
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

export async function saveInspectionLabPhotoMetadataAction(input: {
  caseId: string;
  roomType: InspectionRoomType;
  slot: BathroomCaptureSlot;
  orderIndex: number;
  photoType: string | null;
  storagePath: string;
}) {
  const { appUser } = await requireRole(["admin", "office", "field", "contractor"]);
  const supabase = getAdminClient();

  const caseId = normalizeCaseId(String(input.caseId || "").trim());
  const roomType = normalizeRoomType(String(input.roomType || "").trim());
  const slot = String(input.slot || "").trim() as BathroomCaptureSlot;
  const orderIndex = Number(input.orderIndex);
  const photoType = input.photoType ? String(input.photoType).trim() : null;
  const storagePath = String(input.storagePath || "").trim();

  if (!caseId) {
    throw new Error("Case ID is required.");
  }

  if (slot !== "baseline" && slot !== "current") {
    throw new Error("Capture slot must be baseline or current.");
  }

  if (!Number.isInteger(orderIndex) || orderIndex < 1) {
    throw new Error("Order must be a whole number starting from 1.");
  }

  if (!storagePath) {
    throw new Error("Storage path is required.");
  }

  const caseRow = await ensureInspectionCase(caseId, roomType, appUser.id);

  const { data: existingPhoto, error: existingPhotoError } = await supabase
    .from("inspection_lab_case_photos")
    .select("id, storage_path")
    .eq("case_id", caseRow.id)
    .eq("capture_slot", slot)
    .eq("order_index", orderIndex)
    .maybeSingle();

  if (existingPhotoError) {
    throw new Error(`Failed to check existing photo: ${existingPhotoError.message}`);
  }

  const { error: photoUpsertError } = await supabase
    .from("inspection_lab_case_photos")
    .upsert(
      {
        case_id: caseRow.id,
        capture_slot: slot,
        storage_path: storagePath,
        photo_type: photoType || null,
        order_index: orderIndex,
      },
      { onConflict: "case_id,capture_slot,order_index" }
    );

  if (photoUpsertError) {
    throw new Error(`Failed to save photo metadata: ${photoUpsertError.message}`);
  }

  if (existingPhoto?.storage_path && existingPhoto.storage_path !== storagePath) {
    await supabase.storage
      .from(INSPECTION_STORAGE_BUCKET)
      .remove([existingPhoto.storage_path]);
  }

  await resetCaseReport(caseRow.id, appUser.id);
  revalidatePath("/inspection-lab/bathroom-base-shot");

  return {
    ok: true,
    caseRowId: caseRow.id,
  };
}

export async function updateBathroomPhotoMetadataAction(formData: FormData) {
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
}

export async function runBathroomCaseAction(formData: FormData) {
  await requireRole(["admin", "office", "field", "contractor"]);
  const supabase = getAdminClient();

  const rawCaseId = String(formData.get("case_id") || "").trim();

  if (!rawCaseId) {
    throw new Error("Case ID is required.");
  }

  const caseId = normalizeCaseId(rawCaseId);

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
          throw new Error(
            `Failed to download photo: ${photoError?.message || photo.storage_path}`
          );
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

  revalidatePath("/inspection-lab/bathroom-base-shot");
}
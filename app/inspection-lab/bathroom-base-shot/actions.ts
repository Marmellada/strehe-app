"use server";

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/require-role";
import {
  INSPECTION_STORAGE_BUCKET,
  normalizeCaseId,
  normalizeInspectionObjectKey,
  sortInspectionLabPhotoRows,
  type InspectionLabCasePhotoRow,
  type InspectionRoomType,
  type InspectionCaptureSlot,
} from "@/lib/inspection-lab/bathroom-base-shot";
import { runInspectionCase } from "@/lib/inspection-lab/bathroom-base-shot-runner";

function normalizeRoomType(value: string): InspectionRoomType {
  return value === "living_room" ? "living_room" : "bathroom";
}

type ActionResult =
  | { ok: true; caseRowId?: string }
  | { ok: false; error: string };

function normalizeTrackedObjectImportance(value: string) {
  return value === "medium" ? "medium" : "high";
}

function normalizeTrackedObjectSource(value: string) {
  return value === "manual_corrected" ? "manual_corrected" : "manual_added";
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
  slot: InspectionCaptureSlot;
  orderIndex: number;
  photoType: string | null;
  storagePath: string;
}): Promise<ActionResult> {
  try {
    const { appUser } = await requireRole(["admin", "office", "field", "contractor"]);
    const supabase = getAdminClient();

    const caseId = normalizeCaseId(String(input.caseId || "").trim());
    const roomType = normalizeRoomType(String(input.roomType || "").trim());
    const slot = String(input.slot || "").trim() as InspectionCaptureSlot;
    const orderIndex = Number(input.orderIndex);
    const photoType = input.photoType ? String(input.photoType).trim() : null;
    const storagePath = String(input.storagePath || "").trim();

    if (!caseId) {
      return { ok: false, error: "Case ID is required." };
    }

    if (slot !== "baseline" && slot !== "current") {
      return { ok: false, error: "Capture slot must be baseline or current." };
    }

    if (!Number.isInteger(orderIndex) || orderIndex < 1) {
      return { ok: false, error: "Order must be a whole number starting from 1." };
    }

    if (!storagePath) {
      return { ok: false, error: "Storage path is required." };
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
      return {
        ok: false,
        error: `Failed to check existing photo: ${existingPhotoError.message}`,
      };
    }

    if (existingPhoto) {
      const { error: updateError } = await supabase
        .from("inspection_lab_case_photos")
        .update({
          storage_path: storagePath,
          photo_type: photoType || null,
          order_index: orderIndex,
        })
        .eq("id", existingPhoto.id);

      if (updateError) {
        return {
          ok: false,
          error: `Failed to update photo metadata: ${updateError.message}`,
        };
      }
    } else {
      const { error: insertError } = await supabase
        .from("inspection_lab_case_photos")
        .insert({
          case_id: caseRow.id,
          capture_slot: slot,
          storage_path: storagePath,
          photo_type: photoType || null,
          order_index: orderIndex,
        });

      if (insertError) {
        return {
          ok: false,
          error: `Failed to insert photo metadata: ${insertError.message}`,
        };
      }
    }

    if (existingPhoto?.storage_path && existingPhoto.storage_path !== storagePath) {
      const { error: removeError } = await supabase.storage
        .from(INSPECTION_STORAGE_BUCKET)
        .remove([existingPhoto.storage_path]);

      if (removeError) {
        console.error("[INSPECTION_LAB_REMOVE_OLD_PHOTO_WARNING]", {
          oldPath: existingPhoto.storage_path,
          message: removeError.message,
        });
      }
    }

    await resetCaseReport(caseRow.id, appUser.id);
    revalidatePath("/inspection-lab/bathroom-base-shot");

    return {
      ok: true,
      caseRowId: caseRow.id,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected metadata save failure.";

    console.error("[INSPECTION_LAB_METADATA_SAVE_ERROR]", {
      input,
      message,
    });

    return {
      ok: false,
      error: message,
    };
  }
}

export async function updateInspectionPhotoMetadataAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    const { appUser } = await requireRole(["admin", "office", "field", "contractor"]);
    const supabase = getAdminClient();

    const photoId = String(formData.get("photo_id") || "").trim();
    const caseRowId = String(formData.get("case_row_id") || "").trim();
    const photoTypeValue = String(formData.get("photo_type") || "").trim();
    const orderIndexValue = String(formData.get("order_index") || "").trim();

    if (!photoId || !caseRowId) {
      return { ok: false, error: "Photo ID and case ID are required." };
    }

    const parsedOrderIndex = Number(orderIndexValue);
    if (!Number.isInteger(parsedOrderIndex) || parsedOrderIndex < 1) {
      return { ok: false, error: "Order must be a whole number starting from 1." };
    }

    const { error } = await supabase
      .from("inspection_lab_case_photos")
      .update({
        photo_type: photoTypeValue || null,
        order_index: parsedOrderIndex,
      })
      .eq("id", photoId);

    if (error) {
      return { ok: false, error: `Failed to update photo metadata: ${error.message}` };
    }

    await resetCaseReport(caseRowId, appUser.id);
    revalidatePath("/inspection-lab/bathroom-base-shot");

    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected metadata update failure.";

    console.error("[INSPECTION_LAB_METADATA_UPDATE_ERROR]", {
      message,
    });

    return {
      ok: false,
      error: message,
    };
  }
}

export async function runInspectionCaseAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireRole(["admin", "office", "field", "contractor"]);
    const supabase = getAdminClient();

    const rawCaseId = String(formData.get("case_id") || "").trim();

    if (!rawCaseId) {
      return { ok: false, error: "Case ID is required." };
    }

    const caseId = normalizeCaseId(rawCaseId);

    const { data: row, error } = await supabase
      .from("inspection_lab_cases")
      .select("id, case_key, room_type")
      .eq("case_key", caseId)
      .single();

    if (error || !row) {
      return { ok: false, error: "Inspection case not found." };
    }

    const { data: photoRows, error: photosError } = await supabase
      .from("inspection_lab_case_photos")
      .select("*")
      .eq("case_id", row.id);

    if (photosError) {
      return { ok: false, error: `Failed to load capture set: ${photosError.message}` };
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
      return { ok: false, error: "Both baseline and current capture sets are required." };
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

    const result = await runInspectionCase(
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
      return {
        ok: false,
        error: `Failed to save analysis result: ${updateError.message}`,
      };
    }

    revalidatePath("/inspection-lab/bathroom-base-shot");
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected engine run failure.";

    console.error("[INSPECTION_LAB_RUN_ERROR]", {
      message,
    });

    return {
      ok: false,
      error: message,
    };
  }
}

export async function saveInspectionTrackedObjectAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    const { appUser } = await requireRole(["admin", "office", "field", "contractor"]);
    const supabase = getAdminClient();

    const caseRowId = String(formData.get("case_row_id") || "").trim();
    const label = String(formData.get("label") || "").trim();
    const categoryValue = String(formData.get("category") || "").trim();
    const importanceValue = String(formData.get("importance") || "").trim();
    const sourceValue = String(formData.get("source") || "").trim();
    const reviewNoteValue = String(formData.get("review_note") || "").trim();
    const baselinePhotoIdValue = String(formData.get("baseline_photo_id") || "").trim();

    if (!caseRowId || !label) {
      return { ok: false, error: "Case and object label are required." };
    }

    const objectKey = normalizeInspectionObjectKey(label);
    let baselineOrderIndex: number | null = null;
    let baselinePhotoType: string | null = null;
    let baselineStoragePath: string | null = null;

    if (baselinePhotoIdValue) {
      const { data: baselinePhotoRow, error: baselinePhotoError } = await supabase
        .from("inspection_lab_case_photos")
        .select("id, order_index, photo_type, storage_path")
        .eq("id", baselinePhotoIdValue)
        .eq("case_id", caseRowId)
        .maybeSingle();

      if (baselinePhotoError) {
        return {
          ok: false,
          error: `Failed to load selected baseline photo: ${baselinePhotoError.message}`,
        };
      }

      if (baselinePhotoRow) {
        baselineOrderIndex = baselinePhotoRow.order_index;
        baselinePhotoType = baselinePhotoRow.photo_type;
        baselineStoragePath = baselinePhotoRow.storage_path;
      }
    }

    const { error } = await supabase.from("inspection_lab_tracked_objects").upsert(
      {
        case_id: caseRowId,
        object_key: objectKey,
        label,
        category: categoryValue || null,
        source: normalizeTrackedObjectSource(sourceValue),
        importance: normalizeTrackedObjectImportance(importanceValue),
        is_active: true,
        baseline_photo_id: baselinePhotoIdValue || null,
        baseline_order_index: baselineOrderIndex,
        baseline_photo_type: baselinePhotoType,
        baseline_storage_path: baselineStoragePath,
        review_note: reviewNoteValue || null,
        created_by_user_id: appUser.id,
        updated_by_user_id: appUser.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "case_id,object_key" }
    );

    if (error) {
      return { ok: false, error: `Failed to save tracked object: ${error.message}` };
    }

    revalidatePath("/inspection-lab/bathroom-base-shot");
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected tracked object save failure.";

    console.error("[INSPECTION_LAB_TRACKED_OBJECT_SAVE_ERROR]", {
      message,
    });

    return {
      ok: false,
      error: message,
    };
  }
}

export async function toggleInspectionTrackedObjectAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    const { appUser } = await requireRole(["admin", "office", "field", "contractor"]);
    const supabase = getAdminClient();

    const caseRowId = String(formData.get("case_row_id") || "").trim();
    const objectKey = String(formData.get("object_key") || "").trim();
    const nextStatus = String(formData.get("next_status") || "").trim();

    if (!caseRowId || !objectKey) {
      return { ok: false, error: "Case and object key are required." };
    }

    const isActive = nextStatus !== "inactive";

    const { error } = await supabase
      .from("inspection_lab_tracked_objects")
      .update({
        is_active: isActive,
        updated_by_user_id: appUser.id,
        updated_at: new Date().toISOString(),
      })
      .eq("case_id", caseRowId)
      .eq("object_key", objectKey);

    if (error) {
      return { ok: false, error: `Failed to update tracked object: ${error.message}` };
    }

    revalidatePath("/inspection-lab/bathroom-base-shot");
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected tracked object toggle failure.";

    console.error("[INSPECTION_LAB_TRACKED_OBJECT_TOGGLE_ERROR]", {
      message,
    });

    return {
      ok: false,
      error: message,
    };
  }
}

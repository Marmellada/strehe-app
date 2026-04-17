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
import engine from "@/lib/inspection-lab/bathroom-base-shot-engine-wrapper";

const { detectRoomObjectsInPhotoWithAi } = engine;

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

function getDefaultTrackedObjectSeeds(
  roomType: InspectionRoomType,
  photoType: string | null
) {
  if (!photoType) {
    return {
      direct: [] as string[],
      wideFallback: [] as string[],
    };
  }

  const directSeedsByRoom: Record<InspectionRoomType, string[]> = {
    bathroom: ["sink", "mirror", "toilet", "bathtub", "shower", "cabinet"],
    living_room: ["sofa", "coffee_table", "tv", "tv_stand", "armchair"],
  };

  if (directSeedsByRoom[roomType].includes(photoType)) {
    return {
      direct: [photoType],
      wideFallback: [] as string[],
    };
  }

  const wideShotSeeds: Record<InspectionRoomType, string[]> = {
    bathroom: ["sink", "mirror", "toilet", "cabinet"],
    living_room: ["tv", "tv_stand", "sofa", "coffee_table", "armchair"],
  };

  if (["wide", "entrance"].includes(photoType)) {
    return {
      direct: [] as string[],
      wideFallback: wideShotSeeds[roomType],
    };
  }

  return {
    direct: [] as string[],
    wideFallback: [] as string[],
  };
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

async function updateInspectionPhotoProcessingStatus(options: {
  photoId: string;
  status: "pending" | "processing" | "ready" | "failed";
  processingError?: string | null;
  seededCandidateCount?: number;
  seedModel?: string | null;
  seedDebugResult?: unknown;
}) {
  const supabase = getAdminClient();

  const payload: {
    processing_status: "pending" | "processing" | "ready" | "failed";
    processing_error: string | null;
    processed_at: string | null;
    seeded_candidate_count?: number;
    seed_model?: string | null;
    seed_debug_result?: unknown;
  } = {
    processing_status: options.status,
    processing_error: options.processingError || null,
    processed_at:
      options.status === "ready" || options.status === "failed"
        ? new Date().toISOString()
        : null,
  };

  if (typeof options.seededCandidateCount === "number") {
    payload.seeded_candidate_count = options.seededCandidateCount;
  }

  if ("seedModel" in options) {
    payload.seed_model = options.seedModel || null;
  }

  if ("seedDebugResult" in options) {
    payload.seed_debug_result = options.seedDebugResult ?? null;
  }

  const { error } = await supabase
    .from("inspection_lab_case_photos")
    .update(payload)
    .eq("id", options.photoId);

  if (error) {
    throw new Error(`Failed to update photo processing status: ${error.message}`);
  }
}

async function seedBaselineTrackedObjects(options: {
  caseRowId: string;
  roomType: InspectionRoomType;
  photoId: string;
  photoType: string | null;
  orderIndex: number;
  storagePath: string;
  userId: string;
}) {
  const supabase = getAdminClient();
  const aiEnabled = Boolean(process.env.OPENAI_API_KEY);
  const { direct, wideFallback } = getDefaultTrackedObjectSeeds(
    options.roomType,
    options.photoType
  );
  const directSeedLabels = new Set<string>(direct);
  const wideFallbackLabels = new Set<string>(wideFallback);
  const aiSeededObjects = new Map<
    string,
    {
      visibility: string;
      confidence: number;
      reason: string;
      centerX: number | null;
      centerY: number | null;
    }
  >();
  let rawAiSeedResult: {
    attempted: boolean;
    model: string | null;
    summary: string;
    objectChecks: unknown[];
    trackedObjects: unknown[];
    error?: string | null;
    savedCandidates?: unknown[];
  } = {
    attempted: aiEnabled,
    model: aiEnabled
      ? process.env.OPENAI_INSPECTION_BASELINE_MODEL ||
        process.env.OPENAI_INSPECTION_MODEL ||
        "gpt-4.1"
      : null,
    summary: aiEnabled
      ? "AI baseline detection did not return any saved candidates."
      : "AI baseline detection is disabled.",
    objectChecks: [],
    trackedObjects: [],
    error: null,
  };
  let aiSeedFailed = false;

  const seededNotes = new Map<string, string>();

  for (const label of directSeedLabels) {
    seededNotes.set(label, "Seeded directly from the baseline photo type.");
  }

  try {
    const { data: imageBlob, error: imageError } = await supabase.storage
      .from(INSPECTION_STORAGE_BUCKET)
      .download(options.storagePath);

    if (!imageError && imageBlob) {
      const aiResult = await detectRoomObjectsInPhotoWithAi(
        options.roomType,
        Buffer.from(await imageBlob.arrayBuffer())
      );
      const typedAiResult = aiResult as
        | {
            model?: string;
            summary?: string;
            objectChecks?: unknown[];
            trackedObjects?: unknown[];
          }
        | null;

      const aiTrackedObjects = Array.isArray(
        typedAiResult?.trackedObjects
      )
        ? ((typedAiResult as {
            trackedObjects?: Array<{
              objectName?: string;
              visibility?: string;
              confidence?: number;
              centerX?: number | null;
              centerY?: number | null;
              reason?: string;
            }>;
          }).trackedObjects || [])
        : [];

      rawAiSeedResult = {
        attempted: true,
        model: typeof typedAiResult?.model === "string" ? typedAiResult.model : null,
        summary:
          typeof typedAiResult?.summary === "string"
            ? typedAiResult.summary
            : aiTrackedObjects.length
              ? "AI baseline detection returned one or more tracked objects."
              : "AI baseline detection returned no tracked objects.",
        objectChecks: Array.isArray(typedAiResult?.objectChecks)
          ? typedAiResult.objectChecks
          : [],
        trackedObjects: aiTrackedObjects,
        error: null,
      };

      console.info("[INSPECTION_LAB_BASELINE_AI_SEED_RESULT]", {
        caseRowId: options.caseRowId,
        roomType: options.roomType,
        storagePath: options.storagePath,
        photoType: options.photoType,
        detected: aiTrackedObjects.map((item) => ({
          objectName: item.objectName,
          visibility: item.visibility,
          confidence: item.confidence,
          centerX: item.centerX,
          centerY: item.centerY,
        })),
      });

      for (const item of aiTrackedObjects) {
        if (
          item?.objectName &&
          ["visible", "uncertain"].includes(item.visibility || "") &&
          (item.confidence ?? 0) >= 0.25
        ) {
          aiSeededObjects.set(item.objectName, {
            visibility: item.visibility || "uncertain",
            confidence: item.confidence ?? 0,
            reason: item.reason || "",
            centerX:
              typeof item.centerX === "number" && item.centerX >= 0 && item.centerX <= 1
                ? item.centerX
                : null,
            centerY:
              typeof item.centerY === "number" && item.centerY >= 0 && item.centerY <= 1
                ? item.centerY
                : null,
          });
          seededNotes.set(
            item.objectName,
            `AI seeded from baseline upload (${item.visibility || "uncertain"}, confidence ${(item.confidence ?? 0).toFixed(2)}).`
          );
        }
      }
    }
  } catch (error) {
    aiSeedFailed = true;
    rawAiSeedResult = {
      ...rawAiSeedResult,
      summary:
        error instanceof Error
          ? error.message
          : "Unknown baseline AI seed failure.",
      error:
        error instanceof Error
          ? error.message
          : "Unknown baseline AI seed failure.",
      objectChecks: [],
      trackedObjects: [],
    };
    console.error("[INSPECTION_LAB_BASELINE_AI_SEED_WARNING]", {
      caseRowId: options.caseRowId,
      storagePath: options.storagePath,
      message: error instanceof Error ? error.message : "Unknown baseline AI seed failure.",
    });
  }

  const fallbackLabelsToUse =
    !aiEnabled && aiSeededObjects.size === 0 ? wideFallbackLabels : new Set<string>();
  for (const label of fallbackLabelsToUse) {
    seededNotes.set(label, "Suggested from a wide baseline shot because AI did not localize a stronger candidate.");
  }

  const finalLabels = new Set<string>([
    ...directSeedLabels,
    ...fallbackLabelsToUse,
    ...aiSeededObjects.keys(),
  ]);

  if (finalLabels.size === 0) {
    return {
      seededCandidateCount: 0,
      seedModel: rawAiSeedResult.model,
      seedDebugResult: rawAiSeedResult,
      seedFailed: aiSeedFailed,
    };
  }

  const rows = [...finalLabels].map((label) => {
    const aiSeed = aiSeededObjects.get(label);
    const isAiSeeded = Boolean(aiSeed);

    return {
      case_id: options.caseRowId,
      object_key: `${normalizeInspectionObjectKey(label)}-${options.photoId}`,
      label,
      category: label,
      source: isAiSeeded ? "engine" : "auto_detected",
      importance: "high",
      is_active: true,
      baseline_photo_id: options.photoId,
      baseline_order_index: options.orderIndex,
      baseline_photo_type: options.photoType,
      baseline_storage_path: options.storagePath,
      marker_x: aiSeed?.centerX ?? null,
      marker_y: aiSeed?.centerY ?? null,
      review_note:
        seededNotes.get(label) || "Seeded from the baseline upload for photo review.",
      created_by_user_id: options.userId,
      updated_by_user_id: options.userId,
      updated_at: new Date().toISOString(),
    };
  });

  const { error } = await supabase
    .from("inspection_lab_tracked_objects")
    .upsert(rows, { onConflict: "case_id,object_key" });

  if (error) {
    console.error("[INSPECTION_LAB_BASELINE_SEED_SAVE_WARNING]", {
      caseRowId: options.caseRowId,
      message: error.message,
    });
  }

  return {
    seededCandidateCount: finalLabels.size,
    seedModel: rawAiSeedResult.model,
    seedDebugResult: {
      ...rawAiSeedResult,
      savedCandidates: rows.map((row) => ({
        objectName: row.label,
        source: row.source,
        centerX: row.marker_x,
        centerY: row.marker_y,
        })),
    },
    seedFailed: aiSeedFailed,
  };
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

    let savedPhotoId = existingPhoto?.id || "";

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

      savedPhotoId = existingPhoto.id;
    } else {
      const { data: insertedPhoto, error: insertError } = await supabase
        .from("inspection_lab_case_photos")
        .insert({
          case_id: caseRow.id,
          capture_slot: slot,
          storage_path: storagePath,
          photo_type: photoType || null,
          order_index: orderIndex,
        })
        .select("id")
        .single();

      if (insertError || !insertedPhoto) {
        return {
          ok: false,
          error: `Failed to insert photo metadata: ${insertError.message}`,
        };
      }

      savedPhotoId = insertedPhoto.id;
    }

    if (savedPhotoId) {
      await updateInspectionPhotoProcessingStatus({
        photoId: savedPhotoId,
        status: slot === "baseline" ? "processing" : "ready",
        processingError: null,
        seededCandidateCount: 0,
        seedModel: null,
        seedDebugResult: null,
      });
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

    if (slot === "baseline" && savedPhotoId) {
      try {
        const seedResult = await seedBaselineTrackedObjects({
          caseRowId: caseRow.id,
          roomType,
          photoId: savedPhotoId,
          photoType,
          orderIndex,
          storagePath,
          userId: appUser.id,
        });

        await updateInspectionPhotoProcessingStatus({
          photoId: savedPhotoId,
          status: seedResult.seedFailed ? "failed" : "ready",
          processingError:
            seedResult.seedFailed
              ? typeof (seedResult.seedDebugResult as { error?: unknown } | null)?.error ===
                "string"
                ? ((seedResult.seedDebugResult as { error?: string }).error ?? null)
                : "Baseline processing did not complete successfully."
              : null,
          seededCandidateCount: seedResult.seededCandidateCount,
          seedModel: seedResult.seedModel,
          seedDebugResult: seedResult.seedDebugResult,
        });
      } catch (seedError) {
        await updateInspectionPhotoProcessingStatus({
          photoId: savedPhotoId,
          status: "failed",
          processingError:
            seedError instanceof Error
              ? seedError.message
              : "Baseline processing failed unexpectedly.",
          seededCandidateCount: 0,
          seedModel: null,
          seedDebugResult: {
            attempted: Boolean(process.env.OPENAI_API_KEY),
            model: null,
            summary:
              seedError instanceof Error
                ? seedError.message
                : "Baseline processing failed unexpectedly.",
            objectChecks: [],
            trackedObjects: [],
          },
        });

        throw seedError;
      }
    } else if (savedPhotoId) {
      await updateInspectionPhotoProcessingStatus({
        photoId: savedPhotoId,
        status: "ready",
        processingError: null,
        seededCandidateCount: 0,
        seedModel: null,
        seedDebugResult: null,
      });
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
    const markerXValue = Number(formData.get("marker_x"));
    const markerYValue = Number(formData.get("marker_y"));

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
        marker_x:
          Number.isFinite(markerXValue) && markerXValue >= 0 && markerXValue <= 1
            ? markerXValue
            : null,
        marker_y:
          Number.isFinite(markerYValue) && markerYValue >= 0 && markerYValue <= 1
            ? markerYValue
            : null,
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
    if (baselinePhotoIdValue) {
      revalidatePath(`/inspection-lab/bathroom-base-shot/photos/${baselinePhotoIdValue}`);
    }
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

export async function saveInspectionTrackedObjectMarkerAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    const { appUser } = await requireRole(["admin", "office", "field", "contractor"]);
    const supabase = getAdminClient();

    const trackedObjectId = String(formData.get("tracked_object_id") || "").trim();
    const baselinePhotoId = String(formData.get("baseline_photo_id") || "").trim();
    const markerX = Number(formData.get("marker_x"));
    const markerY = Number(formData.get("marker_y"));

    if (!trackedObjectId) {
      return { ok: false, error: "Tracked object is required." };
    }

    if (
      !Number.isFinite(markerX) ||
      !Number.isFinite(markerY) ||
      markerX < 0 ||
      markerX > 1 ||
      markerY < 0 ||
      markerY > 1
    ) {
      return { ok: false, error: "Marker coordinates are invalid." };
    }

    const { error } = await supabase
      .from("inspection_lab_tracked_objects")
      .update({
        marker_x: markerX,
        marker_y: markerY,
        updated_by_user_id: appUser.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", trackedObjectId);

    if (error) {
      return { ok: false, error: `Failed to save object marker: ${error.message}` };
    }

    revalidatePath("/inspection-lab/bathroom-base-shot");
    if (baselinePhotoId) {
      revalidatePath(`/inspection-lab/bathroom-base-shot/photos/${baselinePhotoId}`);
    }

    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected object marker save failure.";

    console.error("[INSPECTION_LAB_TRACKED_OBJECT_MARKER_ERROR]", {
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

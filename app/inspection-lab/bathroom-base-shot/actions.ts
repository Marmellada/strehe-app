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

const INSPECTION_AGENT_KEY = "inspection.local";
const INSPECTION_CAPABILITY = "inspection.photo.compare";
const AGENT_ARTIFACT_BUCKET = "agent-artifacts";
const TEMPORARY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

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
  const { direct, wideFallback } = getDefaultTrackedObjectSeeds(
    options.roomType,
    options.photoType
  );
  const directSeedLabels = new Set<string>(direct);
  const wideFallbackLabels = new Set<string>(wideFallback);
  const seededNotes = new Map<string, string>();

  for (const label of directSeedLabels) {
    seededNotes.set(label, "Seeded directly from the baseline photo type.");
  }

  for (const label of wideFallbackLabels) {
    seededNotes.set(
      label,
      "Suggested from the selected wide baseline photo type. Visual analysis runs only on the local inspection agent."
    );
  }

  const finalLabels = new Set<string>([
    ...directSeedLabels,
    ...wideFallbackLabels,
  ]);
  const seedDebugResult = {
    attempted: false,
    model: null,
    summary:
      "No cloud vision processing was used. Baseline labels were derived from the operator-selected photo type.",
    objectChecks: [],
    trackedObjects: [],
  };

  if (finalLabels.size === 0) {
    return {
      seededCandidateCount: 0,
      seedModel: null,
      seedDebugResult,
      seedFailed: false,
    };
  }

  const rows = [...finalLabels].map((label) => {
    return {
      case_id: options.caseRowId,
      object_key: `${normalizeInspectionObjectKey(label)}-${options.photoId}`,
      label,
      category: label,
      source: "auto_detected",
      importance: "high",
      is_active: true,
      baseline_photo_id: options.photoId,
      baseline_order_index: options.orderIndex,
      baseline_photo_type: options.photoType,
      baseline_storage_path: options.storagePath,
      marker_x: null,
      marker_y: null,
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
    seedModel: null,
    seedDebugResult: {
      ...seedDebugResult,
      savedCandidates: rows.map((row) => ({
        objectName: row.label,
        source: row.source,
        centerX: row.marker_x,
        centerY: row.marker_y,
      })),
    },
    seedFailed: false,
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
            attempted: false,
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
  const stagedPaths: string[] = [];
  let jobId = "";

  try {
    const { appUser } = await requireRole([
      "admin",
      "office",
      "field",
      "contractor",
    ]);
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

    const { data: agent, error: agentError } = await supabase
      .from("agent_principals")
      .select("id, is_active")
      .eq("agent_key", INSPECTION_AGENT_KEY)
      .maybeSingle();
    if (agentError || !agent?.is_active) {
      return {
        ok: false,
        error:
          "The local inspection agent is not provisioned or is inactive.",
      };
    }

    const { data: capability, error: capabilityError } = await supabase
      .from("agent_capabilities")
      .select("id")
      .eq("agent_id", agent.id)
      .eq("capability_key", INSPECTION_CAPABILITY)
      .maybeSingle();
    if (capabilityError || !capability) {
      return {
        ok: false,
        error: "The inspection agent does not have photo comparison permission.",
      };
    }

    const expiresAt = new Date(Date.now() + TEMPORARY_RETENTION_MS).toISOString();
    const unavailableUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { data: job, error: jobError } = await supabase
      .from("agent_jobs")
      .insert({
        job_type: INSPECTION_CAPABILITY,
        required_capability: INSPECTION_CAPABILITY,
        workspace_type: "inspection",
        subject_type: "inspection_lab_case",
        subject_id: row.id,
        requested_by_user_id: appUser.id,
        assigned_agent_id: agent.id,
        status: "queued",
        payload: {
          schema_version: 1,
          case_id: caseId,
          room_type: normalizeRoomType(String(row.room_type || "bathroom")),
          baseline_count: baselinePhotoRows.length,
          current_count: currentPhotoRows.length,
          temporary_inputs: true,
        },
        requires_review: true,
        available_at: unavailableUntil,
        expires_at: expiresAt,
        max_attempts: 3,
      })
      .select("id")
      .single();
    if (jobError || !job) {
      throw new Error(
        `Failed to queue the local inspection job: ${
          jobError?.message || "unknown error"
        }`
      );
    }
    jobId = job.id;

    const allPhotos = [...baselinePhotoRows, ...currentPhotoRows];
    for (const photo of allPhotos) {
      const { data: photoBlob, error: photoError } = await supabase.storage
        .from(INSPECTION_STORAGE_BUCKET)
        .download(photo.storage_path);
      if (photoError || !photoBlob) {
        throw new Error(
          `Failed to stage inspection photo: ${
            photoError?.message || photo.storage_path
          }`
        );
      }

      const extensionMatch = photo.storage_path.match(/\.[a-z0-9]+$/i);
      const extension = extensionMatch?.[0]?.toLowerCase() || ".jpg";
      const safeSlot =
        photo.capture_slot === "current" ? "current" : "baseline";
      const orderIndex = photo.order_index ?? 0;
      const storagePath = `${agent.id}/${job.id}/input/${safeSlot}-${String(
        orderIndex
      ).padStart(3, "0")}-${photo.id}${extension}`;
      const photoBuffer = Buffer.from(await photoBlob.arrayBuffer());
      const mimeType = photoBlob.type || "image/jpeg";

      const { error: uploadError } = await supabase.storage
        .from(AGENT_ARTIFACT_BUCKET)
        .upload(storagePath, photoBuffer, {
          contentType: mimeType,
          upsert: false,
        });
      if (uploadError) {
        throw new Error(
          `Failed to create a temporary agent input: ${uploadError.message}`
        );
      }
      stagedPaths.push(storagePath);

      const { error: artifactError } = await supabase
        .from("agent_artifacts")
        .insert({
          job_id: job.id,
          artifact_kind: "input",
          storage_bucket: AGENT_ARTIFACT_BUCKET,
          storage_path: storagePath,
          mime_type: mimeType,
          byte_size: photoBuffer.byteLength,
          metadata: {
            capture_slot: safeSlot,
            order_index: orderIndex,
            photo_type: photo.photo_type,
            source_photo_id: photo.id,
          },
          expires_at: expiresAt,
        });
      if (artifactError) {
        throw new Error(
          `Failed to register a temporary agent input: ${artifactError.message}`
        );
      }
    }

    const { error: releaseError } = await supabase
      .from("agent_jobs")
      .update({ available_at: new Date().toISOString() })
      .eq("id", job.id);
    if (releaseError) {
      throw new Error(`Failed to release the local job: ${releaseError.message}`);
    }

    await supabase
      .from("inspection_lab_cases")
      .update({
        report_status: "draft",
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    revalidatePath("/inspection-lab/bathroom-base-shot");
    return { ok: true, caseRowId: row.id };
  } catch (error) {
    const supabase = getAdminClient();
    if (stagedPaths.length > 0) {
      await supabase.storage
        .from(AGENT_ARTIFACT_BUCKET)
        .remove(stagedPaths);
    }
    if (jobId) {
      await supabase.from("agent_jobs").delete().eq("id", jobId);
    }

    const message =
      error instanceof Error ? error.message : "Unexpected inspection queue failure.";

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

export async function reviewInspectionJobAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    const { appUser } = await requireRole(["admin", "office"]);
    const supabase = getAdminClient();
    const jobId = String(formData.get("job_id") || "").trim();
    const decision = String(formData.get("decision") || "").trim();
    const notes = String(formData.get("notes") || "").trim();

    if (!jobId || !["approved", "rejected"].includes(decision)) {
      return { ok: false, error: "A valid review decision is required." };
    }

    const { data: job, error: jobError } = await supabase
      .from("agent_jobs")
      .select("id, job_type, subject_id, status, result")
      .eq("id", jobId)
      .maybeSingle();
    if (
      jobError ||
      !job ||
      job.job_type !== INSPECTION_CAPABILITY ||
      job.status !== "awaiting_review" ||
      !job.subject_id
    ) {
      return {
        ok: false,
        error: "This inspection result is not available for review.",
      };
    }

    const reviewedAt = new Date().toISOString();
    const { error: reviewError } = await supabase
      .from("agent_jobs")
      .update({
        status: decision === "approved" ? "completed" : "failed",
        review_decision: decision,
        review_notes: notes.slice(0, 4000) || null,
        reviewed_by_user_id: appUser.id,
        reviewed_at: reviewedAt,
        completed_at: reviewedAt,
        updated_at: reviewedAt,
      })
      .eq("id", job.id)
      .eq("status", "awaiting_review");
    if (reviewError) {
      return {
        ok: false,
        error: `Failed to review the inspection result: ${reviewError.message}`,
      };
    }

    if (decision === "approved") {
      const result =
        job.result && typeof job.result === "object" && !Array.isArray(job.result)
          ? (job.result as Record<string, unknown>)
          : {};
      const comparison =
        result.comparison &&
        typeof result.comparison === "object" &&
        !Array.isArray(result.comparison)
          ? result.comparison
          : null;
      const reportMarkdown =
        typeof result.report_markdown === "string"
          ? result.report_markdown
          : null;

      const { error: caseError } = await supabase
        .from("inspection_lab_cases")
        .update({
          report_status: "ready",
          comparison_summary: comparison,
          report_markdown: reportMarkdown,
          report_generated_at: reviewedAt,
          updated_at: reviewedAt,
        })
        .eq("id", job.subject_id);
      if (caseError) {
        return {
          ok: false,
          error: `The review was saved, but the case report update failed: ${caseError.message}`,
        };
      }
    } else {
      await supabase
        .from("inspection_lab_cases")
        .update({
          report_status: "draft",
          updated_at: reviewedAt,
        })
        .eq("id", job.subject_id);
    }

    revalidatePath("/inspection-lab/bathroom-base-shot");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Unexpected inspection review failure.",
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

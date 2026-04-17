import path from "node:path";
import type { Database, Json } from "@/types/supabase";

export const INSPECTION_STORAGE_BUCKET = "task-attachments";
export const INSPECTION_STORAGE_ROOT = "inspection-lab/bathroom-base-shot";

export type InspectionRoomType = "bathroom" | "living_room";
export type InspectionCaptureSlot = "baseline" | "current";
export type InspectionObjectActivityStatus = "active" | "inactive";

export type InspectionCasePhotoSummary = {
  id: string;
  caseId: string;
  captureSlot: InspectionCaptureSlot;
  storagePath: string;
  signedUrl: string | null;
  photoType: string | null;
  orderIndex: number | null;
  createdAt: string;
};

export type InspectionTrackedObject = {
  id?: string;
  key: string;
  label: string;
  category: string | null;
  source:
    | "engine"
    | "baseline_capture"
    | "auto_detected"
    | "manual_added"
    | "manual_corrected";
  status: "tracked" | "candidate";
  activityStatus: InspectionObjectActivityStatus;
  importance: "high" | "medium";
  reason: string;
  baselinePhotoId: string | null;
  baselineOrderIndex: number | null;
  baselinePhotoType: string | null;
  baselineStoragePath: string | null;
  markerX: number | null;
  markerY: number | null;
};

export type InspectionCaseSummary = {
  id: string;
  caseId: string;
  roomType: InspectionRoomType;
  baselineExists: boolean;
  currentExists: boolean;
  reportExists: boolean;
  reportStatus: string;
  reportMarkdown: string | null;
  baselinePhotos: InspectionCasePhotoSummary[];
  currentPhotos: InspectionCasePhotoSummary[];
  findings: null | {
    sameRoomVerdict: string;
    changeSeverity: string;
    reviewRequired: boolean;
    findingCount: number;
    highlights: string[];
  };
  trackedTargets: InspectionTrackedObject[];
};

type InspectionLabCaseRow =
  Database["public"]["Tables"]["inspection_lab_cases"]["Row"];

export type InspectionLabCasePhotoRow = {
  id: string;
  case_id: string;
  capture_slot: InspectionCaptureSlot;
  storage_path: string;
  photo_type: string | null;
  order_index: number | null;
  created_at: string;
};

export type InspectionLabTrackedObjectRow = {
  id: string;
  case_id: string;
  object_key: string;
  label: string;
  category: string | null;
  source: string;
  importance: string;
  is_active: boolean;
  baseline_photo_id: string | null;
  baseline_order_index: number | null;
  baseline_photo_type: string | null;
  baseline_storage_path: string | null;
  marker_x: number | null;
  marker_y: number | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
};

type SignedUrlFactory = {
  createSignedUrl: (
    filePath: string,
    expiresIn: number
  ) => Promise<{
    data: { signedUrl: string } | null;
    error: { message: string } | null;
  }>;
};

function sanitizeSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function normalizeCaseId(value: string) {
  const safe = sanitizeSegment(value);
  return safe || "room-case";
}

export function normalizeInspectionObjectKey(value: string) {
  const safe = sanitizeSegment(value);
  return safe || "tracked-object";
}

function sanitizeFileBaseName(fileName: string) {
  const extension = path.extname(fileName).toLowerCase() || ".jpg";
  const base = path.basename(fileName, extension);
  const safeBase = sanitizeSegment(base) || "capture";

  return {
    safeBase,
    extension,
  };
}

export function getCasePhotoStoragePath(
  caseId: string,
  slot: InspectionCaptureSlot,
  orderIndex: number,
  fileName: string
) {
  const { safeBase, extension } = sanitizeFileBaseName(fileName);
  const uniqueId = crypto.randomUUID();

  return path.posix.join(
    INSPECTION_STORAGE_ROOT,
    normalizeCaseId(caseId),
    slot,
    `${String(orderIndex).padStart(3, "0")}-${safeBase}-${uniqueId}${extension}`
  );
}

function parseFindings(summary: Json | null): InspectionCaseSummary["findings"] {
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
    return null;
  }

  const source = summary as Record<string, Json | undefined>;
  const findings = source.findings;

  return {
    sameRoomVerdict:
      typeof source.sameRoomVerdict === "string"
        ? source.sameRoomVerdict
        : "unknown",
    changeSeverity:
      typeof source.changeSeverity === "string"
        ? source.changeSeverity
        : "unknown",
    reviewRequired: Boolean(source.reviewRequired),
    findingCount: Array.isArray(findings) ? findings.length : 0,
    highlights: Array.isArray(findings)
      ? findings
          .map((finding) => {
            if (!finding || typeof finding !== "object" || Array.isArray(finding)) {
              return null;
            }

            const findingSummary = (finding as Record<string, Json | undefined>).summary;
            return typeof findingSummary === "string" ? findingSummary : null;
          })
          .filter((value): value is string => Boolean(value))
          .slice(0, 4)
      : [],
  };
}

function parseTrackedTargets(summary: Json | null): InspectionTrackedObject[] {
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
    return [];
  }

  const source = summary as Record<string, Json | undefined>;
  const trackedTargets = source.trackedTargets;

  if (!Array.isArray(trackedTargets)) {
    return [];
  }

  return trackedTargets
    .map((item): InspectionTrackedObject | null => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const record = item as Record<string, Json | undefined>;
      const label =
        typeof record.label === "string"
          ? record.label
          : typeof record.name === "string"
            ? record.name
            : null;

      if (!label) {
        return null;
      }

      return {
        key:
          typeof record.key === "string"
            ? record.key
            : label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        label,
        category: typeof record.category === "string" ? record.category : null,
        source:
          record.source === "baseline_capture"
            ? "baseline_capture"
            : record.source === "auto_detected"
              ? "auto_detected"
              : record.source === "manual_added"
                ? "manual_added"
                : record.source === "manual_corrected"
                  ? "manual_corrected"
                  : "engine",
        status: record.status === "candidate" ? "candidate" : "tracked",
        activityStatus: "active",
        importance: record.importance === "medium" ? "medium" : "high",
        reason:
          typeof record.reason === "string"
            ? record.reason
            : "Derived from the current engine summary.",
        baselinePhotoId:
          typeof record.baselinePhotoId === "string" ? record.baselinePhotoId : null,
        baselineOrderIndex:
          typeof record.baselineOrderIndex === "number" ? record.baselineOrderIndex : null,
        baselinePhotoType:
          typeof record.baselinePhotoType === "string" ? record.baselinePhotoType : null,
        baselineStoragePath:
          typeof record.baselineStoragePath === "string"
            ? record.baselineStoragePath
            : null,
        markerX: typeof record.markerX === "number" ? record.markerX : null,
        markerY: typeof record.markerY === "number" ? record.markerY : null,
      } satisfies InspectionTrackedObject;
    })
    .filter((value): value is InspectionTrackedObject => Boolean(value));
}

function parseTrackedObjectsFromRows(
  rows: InspectionLabTrackedObjectRow[]
): InspectionTrackedObject[] {
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
    reason: row.review_note || "Saved during baseline review.",
    baselinePhotoId: row.baseline_photo_id,
    baselineOrderIndex: row.baseline_order_index,
    baselinePhotoType: row.baseline_photo_type,
    baselineStoragePath: row.baseline_storage_path,
    markerX: row.marker_x,
    markerY: row.marker_y,
  }));
}

function mergeTrackedObjects(
  persistedObjects: InspectionTrackedObject[],
  derivedObjects: InspectionTrackedObject[]
): InspectionTrackedObject[] {
  const merged = new Map<string, InspectionTrackedObject>();

  for (const item of derivedObjects) {
    merged.set(item.key, item);
  }

  for (const item of persistedObjects) {
    merged.set(item.key, item);
  }

  return [...merged.values()].sort((left, right) => left.label.localeCompare(right.label));
}

async function createSignedUrlOrNull(
  bucket: SignedUrlFactory,
  storagePath: string | null
) {
  if (!storagePath) return null;

  const { data, error } = await bucket.createSignedUrl(storagePath, 60 * 60);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

function sortPhotos(
  left: InspectionLabCasePhotoRow,
  right: InspectionLabCasePhotoRow
) {
  const leftOrder = left.order_index ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = right.order_index ?? Number.MAX_SAFE_INTEGER;

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  return left.created_at.localeCompare(right.created_at);
}

export async function listInspectionCases(
  caseRows: InspectionLabCaseRow[],
  photoRows: InspectionLabCasePhotoRow[],
  trackedObjectRows: InspectionLabTrackedObjectRow[],
  bucket: SignedUrlFactory
): Promise<InspectionCaseSummary[]> {
  const photoSummaries = await Promise.all(
    photoRows.map(async (row) => ({
      id: row.id,
      caseId: row.case_id,
      captureSlot: row.capture_slot,
      storagePath: row.storage_path,
      signedUrl: await createSignedUrlOrNull(bucket, row.storage_path),
      photoType: row.photo_type,
      orderIndex: row.order_index,
      createdAt: row.created_at,
    }))
  );

  const photosByCaseId = new Map<string, InspectionCasePhotoSummary[]>();
  const trackedObjectsByCaseId = new Map<string, InspectionTrackedObject[]>();

  for (const photo of photoSummaries) {
    const bucketPhotos = photosByCaseId.get(photo.caseId) || [];
    bucketPhotos.push(photo);
    photosByCaseId.set(photo.caseId, bucketPhotos);
  }

  for (const trackedObjectRow of trackedObjectRows) {
    const caseTrackedObjects =
      trackedObjectsByCaseId.get(trackedObjectRow.case_id) || [];
    caseTrackedObjects.push(...parseTrackedObjectsFromRows([trackedObjectRow]));
    trackedObjectsByCaseId.set(trackedObjectRow.case_id, caseTrackedObjects);
  }

  const cases = caseRows.map((row) => {
    const casePhotos = photosByCaseId.get(row.id) || [];
    const baselinePhotos = casePhotos
      .filter((photo) => photo.captureSlot === "baseline")
      .sort((left, right) => {
        const leftOrder = left.orderIndex ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = right.orderIndex ?? Number.MAX_SAFE_INTEGER;

        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }

        return left.createdAt.localeCompare(right.createdAt);
      });

    const currentPhotos = casePhotos
      .filter((photo) => photo.captureSlot === "current")
      .sort((left, right) => {
        const leftOrder = left.orderIndex ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = right.orderIndex ?? Number.MAX_SAFE_INTEGER;

        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }

        return left.createdAt.localeCompare(right.createdAt);
      });

    const persistedTrackedObjects = trackedObjectsByCaseId.get(row.id) || [];
    const derivedTrackedObjects = parseTrackedTargets(row.comparison_summary);

    return {
      id: row.id,
      caseId: row.case_key,
      roomType:
        row.room_type === "living_room" ? "living_room" : "bathroom",
      baselineExists: baselinePhotos.length > 0,
      currentExists: currentPhotos.length > 0,
      reportExists: Boolean(row.report_markdown),
      reportStatus: row.report_status,
      reportMarkdown: row.report_markdown,
      baselinePhotos,
      currentPhotos,
      findings: parseFindings(row.comparison_summary),
      trackedTargets: mergeTrackedObjects(persistedTrackedObjects, derivedTrackedObjects),
    } satisfies InspectionCaseSummary;
  });

  return cases.sort((left, right) => left.caseId.localeCompare(right.caseId));
}

export function sortInspectionLabPhotoRows(
  rows: InspectionLabCasePhotoRow[]
): InspectionLabCasePhotoRow[] {
  return [...rows].sort(sortPhotos);
}

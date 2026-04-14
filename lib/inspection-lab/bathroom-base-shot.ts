import path from "node:path";
import type { Database, Json } from "@/types/supabase";

export const INSPECTION_STORAGE_BUCKET = "task-attachments";
export const INSPECTION_STORAGE_ROOT = "inspection-lab/bathroom-base-shot";

export type InspectionRoomType = "bathroom" | "living_room";
export type BathroomCaptureSlot = "baseline" | "current";

export type BathroomCasePhotoSummary = {
  id: string;
  caseId: string;
  captureSlot: BathroomCaptureSlot;
  storagePath: string;
  signedUrl: string | null;
  photoType: string | null;
  orderIndex: number | null;
  createdAt: string;
};

export type BathroomTrackedTarget = {
  key: string;
  label: string;
  source: "engine" | "baseline_capture";
  status: "tracked" | "candidate";
  importance: "high" | "medium";
  reason: string;
};

export type BathroomCaseSummary = {
  id: string;
  caseId: string;
  roomType: InspectionRoomType;
  baselineExists: boolean;
  currentExists: boolean;
  reportExists: boolean;
  reportStatus: string;
  reportMarkdown: string | null;
  baselinePhotos: BathroomCasePhotoSummary[];
  currentPhotos: BathroomCasePhotoSummary[];
  findings: null | {
    sameRoomVerdict: string;
    changeSeverity: string;
    reviewRequired: boolean;
    findingCount: number;
    highlights: string[];
  };
  trackedTargets: BathroomTrackedTarget[];
};

type InspectionLabCaseRow =
  Database["public"]["Tables"]["inspection_lab_cases"]["Row"];

export type InspectionLabCasePhotoRow = {
  id: string;
  case_id: string;
  capture_slot: BathroomCaptureSlot;
  storage_path: string;
  photo_type: string | null;
  order_index: number | null;
  created_at: string;
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
  slot: BathroomCaptureSlot,
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

function parseFindings(summary: Json | null): BathroomCaseSummary["findings"] {
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

function parseTrackedTargets(summary: Json | null): BathroomTrackedTarget[] {
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
    return [];
  }

  const source = summary as Record<string, Json | undefined>;
  const trackedTargets = source.trackedTargets;

  if (!Array.isArray(trackedTargets)) {
    return [];
  }

  return trackedTargets
    .map((item) => {
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
        source: record.source === "baseline_capture" ? "baseline_capture" : "engine",
        status: record.status === "candidate" ? "candidate" : "tracked",
        importance: record.importance === "medium" ? "medium" : "high",
        reason:
          typeof record.reason === "string"
            ? record.reason
            : "Derived from the current engine summary.",
      } satisfies BathroomTrackedTarget;
    })
    .filter((value): value is BathroomTrackedTarget => Boolean(value));
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

export async function listBathroomCases(
  caseRows: InspectionLabCaseRow[],
  photoRows: InspectionLabCasePhotoRow[],
  bucket: SignedUrlFactory
): Promise<BathroomCaseSummary[]> {
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

  const photosByCaseId = new Map<string, BathroomCasePhotoSummary[]>();

  for (const photo of photoSummaries) {
    const bucketPhotos = photosByCaseId.get(photo.caseId) || [];
    bucketPhotos.push(photo);
    photosByCaseId.set(photo.caseId, bucketPhotos);
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
      trackedTargets: parseTrackedTargets(row.comparison_summary),
    } satisfies BathroomCaseSummary;
  });

  return cases.sort((left, right) => left.caseId.localeCompare(right.caseId));
}

export function sortInspectionLabPhotoRows(
  rows: InspectionLabCasePhotoRow[]
): InspectionLabCasePhotoRow[] {
  return [...rows].sort(sortPhotos);
}
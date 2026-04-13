import path from "node:path";
import type { Database, Json } from "@/types/supabase";

export const INSPECTION_STORAGE_BUCKET = "task-attachments";
export const INSPECTION_STORAGE_ROOT = "inspection-lab/bathroom-base-shot";

export type BathroomCaptureSlot = "baseline" | "current";

export type BathroomCaseSummary = {
  id: string;
  caseId: string;
  baselineExists: boolean;
  currentExists: boolean;
  reportExists: boolean;
  reportStatus: string;
  reportMarkdown: string | null;
  baselineSignedUrl: string | null;
  currentSignedUrl: string | null;
  findings: null | {
    sameRoomVerdict: string;
    changeSeverity: string;
    reviewRequired: boolean;
    findingCount: number;
    highlights: string[];
  };
};

type InspectionLabCaseRow =
  Database["public"]["Tables"]["inspection_lab_cases"]["Row"];

type SignedUrlFactory = {
  createSignedUrl: (
    filePath: string,
    expiresIn: number
  ) => Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>;
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
  return safe || "bathroom-case";
}

export function getStoragePath(caseId: string, slot: BathroomCaptureSlot) {
  return path.posix.join(
    INSPECTION_STORAGE_ROOT,
    normalizeCaseId(caseId),
    `${slot}.jpg`
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

            const summary = (finding as Record<string, Json | undefined>).summary;
            return typeof summary === "string" ? summary : null;
          })
          .filter((value): value is string => Boolean(value))
          .slice(0, 3)
      : [],
  };
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

export async function listBathroomCases(
  rows: InspectionLabCaseRow[],
  bucket: SignedUrlFactory
): Promise<BathroomCaseSummary[]> {
  const cases = await Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      caseId: row.case_key,
      baselineExists: Boolean(row.baseline_storage_path),
      currentExists: Boolean(row.current_storage_path),
      reportExists: Boolean(row.report_markdown),
      reportStatus: row.report_status,
      reportMarkdown: row.report_markdown,
      baselineSignedUrl: await createSignedUrlOrNull(bucket, row.baseline_storage_path),
      currentSignedUrl: await createSignedUrlOrNull(bucket, row.current_storage_path),
      findings: parseFindings(row.comparison_summary),
    }))
  );

  return cases.sort((left, right) => left.caseId.localeCompare(right.caseId));
}

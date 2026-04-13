import fs from "node:fs/promises";
import path from "node:path";

export const INSPECTION_LAB_ROOT = path.join(
  process.cwd(),
  "inspection-lab",
  "bathroom-base-shot"
);

export const CASES_DIR = path.join(INSPECTION_LAB_ROOT, "cases");
export const RESULTS_DIR = path.join(INSPECTION_LAB_ROOT, "results");

export type BathroomCaptureSlot = "baseline" | "current";

export type BathroomCaseManifest = {
  case_id: string;
  room_type: "bathroom";
  capture_type: "base_shot";
  baseline_photo: { path: string };
  current_photo: { path: string };
  output_dir: string;
};

export type BathroomCaseSummary = {
  caseId: string;
  caseDir: string;
  manifestPath: string;
  baselineExists: boolean;
  currentExists: boolean;
  reportExists: boolean;
  findings: null | {
    sameRoomVerdict: string;
    changeSeverity: string;
    reviewRequired: boolean;
    findingCount: number;
  };
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

export function getCaseDir(caseId: string) {
  return path.join(CASES_DIR, normalizeCaseId(caseId));
}

export function getManifestPath(caseId: string) {
  return path.join(getCaseDir(caseId), "manifest.json");
}

export function buildManifest(caseId: string): BathroomCaseManifest {
  const normalizedCaseId = normalizeCaseId(caseId);

  return {
    case_id: normalizedCaseId,
    room_type: "bathroom",
    capture_type: "base_shot",
    baseline_photo: { path: "./baseline.jpg" },
    current_photo: { path: "./current.jpg" },
    output_dir: `../../results/${normalizedCaseId}`,
  };
}

export async function ensureCaseManifest(caseId: string) {
  const normalizedCaseId = normalizeCaseId(caseId);
  const caseDir = getCaseDir(normalizedCaseId);
  const manifestPath = getManifestPath(normalizedCaseId);

  await fs.mkdir(caseDir, { recursive: true });

  try {
    await fs.access(manifestPath);
  } catch {
    await fs.writeFile(
      manifestPath,
      `${JSON.stringify(buildManifest(normalizedCaseId), null, 2)}\n`,
      "utf8"
    );
  }

  return { caseDir, manifestPath, caseId: normalizedCaseId };
}

export async function loadManifest(caseId: string) {
  const manifestPath = getManifestPath(caseId);
  const raw = await fs.readFile(manifestPath, "utf8");
  return JSON.parse(raw) as BathroomCaseManifest;
}

export async function listBathroomCases(): Promise<BathroomCaseSummary[]> {
  await fs.mkdir(CASES_DIR, { recursive: true });
  await fs.mkdir(RESULTS_DIR, { recursive: true });

  const entries = await fs.readdir(CASES_DIR, { withFileTypes: true });
  const cases = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const caseId = entry.name;
        const caseDir = getCaseDir(caseId);
        const manifestPath = getManifestPath(caseId);
        const baselinePath = path.join(caseDir, "baseline.jpg");
        const currentPath = path.join(caseDir, "current.jpg");
        const findingsPath = path.join(RESULTS_DIR, caseId, "findings.json");
        const reportPath = path.join(RESULTS_DIR, caseId, "report.md");

        const [baselineExists, currentExists, reportExists] = await Promise.all([
          fs
            .access(baselinePath)
            .then(() => true)
            .catch(() => false),
          fs
            .access(currentPath)
            .then(() => true)
            .catch(() => false),
          fs
            .access(reportPath)
            .then(() => true)
            .catch(() => false),
        ]);

        let findings: BathroomCaseSummary["findings"] = null;
        try {
          const findingsRaw = await fs.readFile(findingsPath, "utf8");
          const parsed = JSON.parse(findingsRaw) as {
            comparison?: {
              sameRoomVerdict?: string;
              changeSeverity?: string;
              reviewRequired?: boolean;
              findings?: unknown[];
            };
          };

          findings = parsed.comparison
            ? {
                sameRoomVerdict: parsed.comparison.sameRoomVerdict || "unknown",
                changeSeverity: parsed.comparison.changeSeverity || "unknown",
                reviewRequired: Boolean(parsed.comparison.reviewRequired),
                findingCount: Array.isArray(parsed.comparison.findings)
                  ? parsed.comparison.findings.length
                  : 0,
              }
            : null;
        } catch {
          findings = null;
        }

        return {
          caseId,
          caseDir,
          manifestPath,
          baselineExists,
          currentExists,
          reportExists,
          findings,
        };
      })
  );

  return cases.sort((left, right) => left.caseId.localeCompare(right.caseId));
}

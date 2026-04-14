import {
  analyzeBathroomBaseShot,
  analyzeBathroomObjectsWithAi,
  buildBathroomMarkdownReport,
  buildBathroomNarrative,
  compareBathroomBaseShots,
  mergeBathroomAiFindings,
} from "@/lib/inspection-lab/bathroom-base-shot-engine.mjs";
import type {
  BathroomCaptureSlot,
  BathroomTrackedTarget,
  InspectionRoomType,
} from "@/lib/inspection-lab/bathroom-base-shot";

export type BathroomRunnerPhotoInput = {
  id: string;
  captureSlot: BathroomCaptureSlot;
  orderIndex: number | null;
  photoType: string | null;
  storagePath: string;
  buffer: Buffer;
};

export type BathroomRunnerResult = {
  comparison: Record<string, unknown>;
  narrative: string;
  reportMarkdown: string;
};

function getFallbackImportance(photoType: string | null): "high" | "medium" {
  return ["wide", "entrance", "sofa", "tv", "table", "mirror", "sink", "toilet", "shower", "bathtub", "cabinet"].includes(
    photoType || ""
  )
    ? "high"
    : "medium";
}

function fallbackTrackedTargetsFromBaselinePhotos(
  photos: BathroomRunnerPhotoInput[]
): BathroomTrackedTarget[] {
  const seen = new Set<string>();

  return photos
    .filter((photo) => Boolean(photo.photoType))
    .map((photo): BathroomTrackedTarget => {
      const label = (photo.photoType || "baseline_zone").replace(/_/g, " ");
      const key = `${photo.captureSlot}-${photo.orderIndex ?? "x"}-${photo.photoType || "baseline_zone"}`;

      return {
        key,
        label,
        source: "baseline_capture",
        status: "candidate",
        importance: getFallbackImportance(photo.photoType),
        reason: `Derived from baseline capture order ${photo.orderIndex ?? "?"}.`,
      };
    })
    .filter((item) => {
      if (seen.has(item.key)) return false;
      seen.add(item.key);
      return true;
    });
}

function normalizeTrackedTargets(value: unknown): BathroomTrackedTarget[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): BathroomTrackedTarget | null => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const record = item as Record<string, unknown>;
      const rawLabel =
        typeof record.label === "string"
          ? record.label
          : typeof record.key === "string"
            ? record.key
            : null;

      if (!rawLabel) return null;

      return {
        key:
          typeof record.key === "string"
            ? record.key
            : rawLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        label: rawLabel.replace(/_/g, " "),
        source: record.source === "baseline_capture" ? "baseline_capture" : "engine",
        status: record.status === "candidate" ? "candidate" : "tracked",
        importance: record.importance === "medium" ? "medium" : "high",
        reason:
          typeof record.reason === "string" && record.reason.trim()
            ? record.reason.trim()
            : "Derived from the latest engine run.",
      };
    })
    .filter((item): item is BathroomTrackedTarget => Boolean(item));
}

function appendStructuredSections(
  markdown: string,
  trackedTargets: BathroomTrackedTarget[],
  baselinePhotos: BathroomRunnerPhotoInput[],
  currentPhotos: BathroomRunnerPhotoInput[]
) {
  const trackedSection =
    trackedTargets.length > 0
      ? trackedTargets
          .map(
            (item) =>
              `- ${item.label} (${item.status}, ${item.importance}) — ${item.reason}`
          )
          .join("\n")
      : "- none extracted yet";

  const baselineSection = baselinePhotos.length
    ? baselinePhotos
        .map(
          (photo) =>
            `- #${photo.orderIndex ?? "?"} ${photo.photoType || "unspecified"} (${photo.storagePath})`
        )
        .join("\n")
    : "- none";

  const currentSection = currentPhotos.length
    ? currentPhotos
        .map(
          (photo) =>
            `- #${photo.orderIndex ?? "?"} ${photo.photoType || "unspecified"} (${photo.storagePath})`
        )
        .join("\n")
    : "- none";

  return [
    markdown.trim(),
    "",
    "## Capture Coverage",
    "",
    `Baseline photos: ${baselinePhotos.length}`,
    baselineSection,
    "",
    `Current photos: ${currentPhotos.length}`,
    currentSection,
    "",
    "## Tracked From Baseline",
    "",
    trackedSection,
  ].join("\n");
}

export async function runBathroomBaseShotCase(
  caseId: string,
  roomType: InspectionRoomType,
  baselinePhotos: BathroomRunnerPhotoInput[],
  currentPhotos: BathroomRunnerPhotoInput[]
): Promise<BathroomRunnerResult> {
  const orderedBaselinePhotos = [...baselinePhotos].sort(
    (left, right) =>
      (left.orderIndex ?? Number.MAX_SAFE_INTEGER) -
      (right.orderIndex ?? Number.MAX_SAFE_INTEGER)
  );
  const orderedCurrentPhotos = [...currentPhotos].sort(
    (left, right) =>
      (left.orderIndex ?? Number.MAX_SAFE_INTEGER) -
      (right.orderIndex ?? Number.MAX_SAFE_INTEGER)
  );

  if (orderedBaselinePhotos.length === 0 || orderedCurrentPhotos.length === 0) {
    throw new Error("Both baseline and current capture sets are required.");
  }

  const primaryBaselinePhoto = orderedBaselinePhotos[0];
  const primaryCurrentPhoto = orderedCurrentPhotos[0];

  const primaryBaseline = await analyzeBathroomBaseShot(
    primaryBaselinePhoto.buffer,
    `baseline-${primaryBaselinePhoto.orderIndex ?? 1}-${primaryBaselinePhoto.photoType || "capture"}`
  );

  const primaryCurrent = await analyzeBathroomBaseShot(
    primaryCurrentPhoto.buffer,
    `current-${primaryCurrentPhoto.orderIndex ?? 1}-${primaryCurrentPhoto.photoType || "capture"}`
  );

  const baseComparison = compareBathroomBaseShots(primaryBaseline, primaryCurrent);

  let comparison: Record<string, unknown> = {
    ...(baseComparison as Record<string, unknown>),
  };

  try {
    const aiAnalysis = await analyzeBathroomObjectsWithAi(
      roomType,
      primaryBaselinePhoto.buffer,
      primaryCurrentPhoto.buffer,
      comparison
    );

    if (aiAnalysis) {
      comparison = mergeBathroomAiFindings(
        comparison,
        aiAnalysis
      ) as Record<string, unknown>;
    }
  } catch {
    // Keep deterministic result if AI is unavailable or fails.
  }

  const trackedTargetsFromEngine = normalizeTrackedTargets(comparison.trackedTargets);
  const trackedTargets =
    trackedTargetsFromEngine.length > 0
      ? trackedTargetsFromEngine
      : fallbackTrackedTargetsFromBaselinePhotos(orderedBaselinePhotos);

  const enrichedComparison: Record<string, unknown> = {
    ...comparison,
    roomType,
    trackedTargets,
    baselineCaptureCount: orderedBaselinePhotos.length,
    currentCaptureCount: orderedCurrentPhotos.length,
    baselineCaptureOrder: orderedBaselinePhotos.map((photo) => ({
      orderIndex: photo.orderIndex,
      photoType: photo.photoType,
      storagePath: photo.storagePath,
    })),
    currentCaptureOrder: orderedCurrentPhotos.map((photo) => ({
      orderIndex: photo.orderIndex,
      photoType: photo.photoType,
      storagePath: photo.storagePath,
    })),
  };

  const narrative = buildBathroomNarrative(caseId, enrichedComparison);
  const rawMarkdown = buildBathroomMarkdownReport(
    caseId,
    roomType,
    primaryBaseline,
    primaryCurrent,
    enrichedComparison
  );

  const reportMarkdown = appendStructuredSections(
    rawMarkdown,
    trackedTargets,
    orderedBaselinePhotos,
    orderedCurrentPhotos
  );

  return {
    comparison: enrichedComparison,
    narrative,
    reportMarkdown,
  };
}
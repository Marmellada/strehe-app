import engine from "@/lib/inspection-lab/bathroom-base-shot-engine-wrapper";
import type {
  InspectionCaptureSlot,
  InspectionRoomType,
  InspectionTrackedObject,
} from "@/lib/inspection-lab/bathroom-base-shot";

const {
  analyzeBathroomBaseShot,
  analyzeBathroomObjectsWithAi,
  buildBathroomMarkdownReport,
  buildBathroomNarrative,
  compareBathroomBaseShots,
  mergeBathroomAiFindings,
} = engine;

export type InspectionRunnerPhotoInput = {
  id: string;
  captureSlot: InspectionCaptureSlot;
  orderIndex: number | null;
  photoType: string | null;
  storagePath: string;
  buffer: Buffer;
};

export type InspectionRunnerResult = {
  comparison: Record<string, unknown>;
  narrative: string;
  reportMarkdown: string;
};

function getFallbackImportance(photoType: string | null): "high" | "medium" {
  return [
    "wide",
    "entrance",
    "sofa",
    "tv",
    "coffee_table",
    "tv_stand",
    "armchair",
    "mirror",
    "sink",
    "toilet",
    "shower",
    "bathtub",
    "bathtub_or_shower",
    "cabinet",
  ].includes(photoType || "")
    ? "high"
    : "medium";
}

function fallbackTrackedTargetsFromBaselinePhotos(
  roomType: InspectionRoomType,
  photos: InspectionRunnerPhotoInput[]
): InspectionTrackedObject[] {
  const seen = new Set<string>();
  const allowedHighConfidenceTypes =
    roomType === "living_room"
      ? new Set(["sofa", "coffee_table", "tv", "tv_stand", "armchair"])
      : new Set(["sink", "mirror", "toilet", "shower", "bathtub", "bathtub_or_shower", "cabinet"]);

  return photos
    .filter((photo) => Boolean(photo.photoType) && allowedHighConfidenceTypes.has(photo.photoType || ""))
    .map((photo): InspectionTrackedObject => {
      const label = (photo.photoType || "baseline_zone").replace(/_/g, " ");
      const key = `${photo.captureSlot}-${photo.orderIndex ?? "x"}-${photo.photoType || "baseline_zone"}`;

      return {
        key,
        label,
        category: photo.photoType || null,
        source: "baseline_capture",
        status: "candidate",
        activityStatus: "active",
        importance: getFallbackImportance(photo.photoType),
        reason: `Derived from baseline capture order ${photo.orderIndex ?? "?"}.`,
        baselinePhotoId: photo.id,
        baselineOrderIndex: photo.orderIndex,
        baselinePhotoType: photo.photoType,
        baselineStoragePath: photo.storagePath,
        markerX: null,
        markerY: null,
      };
    })
    .filter((item) => {
      if (seen.has(item.key)) return false;
      seen.add(item.key);
      return true;
    });
}

function normalizeTrackedTargets(value: unknown): InspectionTrackedObject[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): InspectionTrackedObject | null => {
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
        category: typeof record.category === "string" ? record.category : null,
        source: record.source === "baseline_capture" ? "baseline_capture" : "engine",
        status: record.status === "candidate" ? "candidate" : "tracked",
        activityStatus: record.activityStatus === "inactive" ? "inactive" : "active",
        importance: record.importance === "medium" ? "medium" : "high",
        reason:
          typeof record.reason === "string" && record.reason.trim()
            ? record.reason.trim()
            : "Derived from the latest engine run.",
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
      };
    })
    .filter((item): item is InspectionTrackedObject => Boolean(item));
}

function appendStructuredSections(
  markdown: string,
  trackedTargets: InspectionTrackedObject[],
  baselinePhotos: InspectionRunnerPhotoInput[],
  currentPhotos: InspectionRunnerPhotoInput[]
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

export async function runInspectionCase(
  caseId: string,
  roomType: InspectionRoomType,
  baselinePhotos: InspectionRunnerPhotoInput[],
  currentPhotos: InspectionRunnerPhotoInput[]
): Promise<InspectionRunnerResult> {
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
      : fallbackTrackedTargetsFromBaselinePhotos(roomType, orderedBaselinePhotos);

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

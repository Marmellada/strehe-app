import sharp from "sharp";

const QUALITY_THRESHOLDS = {
  minWidth: 900,
  minHeight: 1200,
  minBrightness: 0.2,
  minContrast: 0.1,
  minBlurScore: 6,
};

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_INSPECTION_MODEL = process.env.OPENAI_INSPECTION_MODEL || "gpt-4.1-mini";

const TRACKED_OBJECTS_BY_ROOM = {
  bathroom: ["sink", "mirror", "toilet", "bathtub_or_shower", "cabinet"],
  living_room: ["sofa", "coffee_table", "tv", "tv_stand", "armchair"],
};

function getTrackedObjects(roomType) {
  return TRACKED_OBJECTS_BY_ROOM[roomType] || TRACKED_OBJECTS_BY_ROOM.bathroom;
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values, mean) {
  if (!values.length) return 0;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function hammingDistance(left, right) {
  const maxLength = Math.max(left.length, right.length);
  let distance = 0;

  for (let index = 0; index < maxLength; index += 1) {
    if (left[index] !== right[index]) distance += 1;
  }

  return distance;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function toSentenceCase(value) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function extractJsonObject(text) {
  const trimmed = text.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  throw new Error("AI response did not contain a JSON object.");
}

function normalizeVisibility(value) {
  return ["visible", "not_visible", "uncertain"].includes(value) ? value : "uncertain";
}

function normalizeSameRoomVerdict(value) {
  return ["likely", "uncertain", "unlikely"].includes(value) ? value : "uncertain";
}

function normalizeConfidence(value) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0.5;
  return Number(clamp01(numeric).toFixed(2));
}

function normalizeCoordinate(value) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Number(clamp01(numeric).toFixed(4));
}

function normalizeTrackedObjectName(value, roomType) {
  const allowed = getTrackedObjects(roomType);
  return typeof value === "string" && allowed.includes(value) ? value : "unknown";
}

function getObjectImportance(roomType, objectName) {
  const highByRoom = {
    bathroom: ["sink", "mirror", "toilet", "bathtub_or_shower", "cabinet"],
    living_room: ["sofa", "coffee_table", "tv", "tv_stand", "armchair"],
  };

  return (highByRoom[roomType] || []).includes(objectName) ? "high" : "medium";
}

function buildTrackedTargets(roomType, aiAnalysis) {
  if (!aiAnalysis?.trackedObjects?.length) return [];

  const unique = new Map();

  for (const item of aiAnalysis.trackedObjects) {
    if (!item || item.objectName === "unknown") continue;

    if (!unique.has(item.objectName)) {
      unique.set(item.objectName, {
        key: item.objectName,
        label: item.objectName,
        category: item.objectName,
        source: "engine",
        status: item.baselineVisibility === "visible" ? "tracked" : "candidate",
        importance: getObjectImportance(roomType, item.objectName),
        reason:
          item.baselineVisibility === "visible"
            ? "Visible in the baseline image and considered relevant for comparison."
            : "Mentioned by the engine but baseline visibility is not fully certain.",
        baselinePhotoId: null,
        baselineOrderIndex: null,
        baselinePhotoType: null,
        baselineStoragePath: null,
        markerX: null,
        markerY: null,
      });
    }
  }

  return [...unique.values()];
}

async function getImageMimeType(input) {
  const metadata = await sharp(input).metadata();
  switch (metadata.format) {
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    default:
      return "image/jpeg";
  }
}

async function toDataUrl(input) {
  const mimeType = await getImageMimeType(input);
  const base64 = Buffer.from(input).toString("base64");
  return `data:${mimeType};base64,${base64}`;
}

async function parseResponsesOutput(response) {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI baseline detection request failed: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  const rawText =
    typeof payload.output_text === "string" && payload.output_text.trim()
      ? payload.output_text
      : Array.isArray(payload.output)
        ? payload.output
            .flatMap((item) =>
              Array.isArray(item?.content)
                ? item.content
                    .map((contentItem) =>
                      typeof contentItem?.text === "string" ? contentItem.text : null
                    )
                    .filter(Boolean)
                : []
            )
            .join("\n")
        : "";

  return JSON.parse(extractJsonObject(rawText || ""));
}

function normalizeDetectedPhotoObject(item, roomType) {
  return {
    objectName: normalizeTrackedObjectName(item?.objectName, roomType),
    visibility: item?.visibility === "visible" ? "visible" : "uncertain",
    confidence: normalizeConfidence(item?.confidence),
    centerX: normalizeCoordinate(item?.centerX),
    centerY: normalizeCoordinate(item?.centerY),
    reason: typeof item?.reason === "string" ? item.reason.trim() : "",
  };
}

async function detectSingleTrackedObjectInPhotoWithAi(roomType, objectName, imageUrl, apiKey) {
  const prompt = [
    `You are reviewing a single ${roomType.replaceAll("_", " ")} baseline photo.`,
    `Check only one object category: ${objectName}.`,
    "Look at the actual image and decide whether this specific object is clearly visible.",
    "Return strict JSON only.",
    "If it is clearly visible, include an approximate normalized center point where x and y are each between 0 and 1.",
    "If it is not clearly visible, say not_visible and leave centerX and centerY as null.",
    "JSON shape:",
    JSON.stringify(
      {
        objectName,
        visibility: "visible|not_visible|uncertain",
        confidence: 0.0,
        centerX: 0.5,
        centerY: 0.5,
        reason: "short sentence grounded in the image",
      },
      null,
      2
    ),
  ].join("\n");

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_INSPECTION_MODEL,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_text", text: "Baseline image" },
            { type: "input_image", image_url: imageUrl },
          ],
        },
      ],
      max_output_tokens: 500,
    }),
  });

  const parsed = await parseResponsesOutput(response);
  const normalized = normalizeDetectedPhotoObject(parsed, roomType);

  if (
    normalized.objectName === "unknown" ||
    normalized.visibility !== "visible" ||
    normalized.centerX === null ||
    normalized.centerY === null ||
    normalized.confidence < 0.35
  ) {
    return null;
  }

  return normalized;
}

function collectAiHighlights(aiAnalysis) {
  if (!aiAnalysis?.trackedObjects?.length) return [];

  return aiAnalysis.trackedObjects
    .filter(
      (item) =>
        item.baselineVisibility === "visible" &&
        item.currentVisibility === "not_visible" &&
        item.missingInCurrentConfidence >= 0.6
    )
    .map(
      (item) =>
        `${toSentenceCase(item.objectName)} was visible before${item.previousLocation ? ` (${item.previousLocation})` : ""} but is not visible in the current frame.`
    );
}

async function loadNormalizedGrayscale(input, width, height) {
  const { data, info } = await sharp(input)
    .rotate()
    .grayscale()
    .resize(width, height, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    width: info.width,
    height: info.height,
    pixels: Array.from(data, (value) => value / 255),
  };
}

function computeDifferenceHash(pixels, width, height) {
  let bits = "";

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      const left = pixels[y * width + x];
      const right = pixels[y * width + x + 1];
      bits += left > right ? "1" : "0";
    }
  }

  return bits;
}

function computeHistogram(pixels, bins = 16) {
  const histogram = Array.from({ length: bins }, () => 0);

  for (const pixel of pixels) {
    const index = Math.min(bins - 1, Math.floor(pixel * bins));
    histogram[index] += 1;
  }

  return histogram.map((value) => value / pixels.length);
}

function compareHistograms(left, right) {
  let totalDifference = 0;

  for (let index = 0; index < left.length; index += 1) {
    totalDifference += Math.abs((left[index] || 0) - (right[index] || 0));
  }

  return clamp01(1 - totalDifference / 2);
}

function computePixelDifference(leftPixels, rightPixels) {
  const length = Math.min(leftPixels.length, rightPixels.length);
  if (!length) return 1;

  let total = 0;
  for (let index = 0; index < length; index += 1) {
    total += Math.abs(leftPixels[index] - rightPixels[index]);
  }

  return total / length;
}

function buildQualityFlags(metrics) {
  const flags = [];

  if (metrics.width < QUALITY_THRESHOLDS.minWidth) {
    flags.push("Image width is low for reliable comparison.");
  }

  if (metrics.height < QUALITY_THRESHOLDS.minHeight) {
    flags.push("Image height is low for reliable comparison.");
  }

  if (metrics.brightness < QUALITY_THRESHOLDS.minBrightness) {
    flags.push("Image appears too dark.");
  }

  if (metrics.contrast < QUALITY_THRESHOLDS.minContrast) {
    flags.push("Image contrast is low.");
  }

  if (metrics.blurScore < QUALITY_THRESHOLDS.minBlurScore) {
    flags.push("Image may be too blurry.");
  }

  if (metrics.orientation !== "portrait") {
    flags.push("Base shot should ideally be portrait orientation.");
  }

  return flags;
}

export async function analyzeBathroomBaseShot(input, label = "image") {
  const metadata = await sharp(input).rotate().metadata();
  const preview = await loadNormalizedGrayscale(input, 128, 128);
  const hashGrid = await loadNormalizedGrayscale(input, 9, 8);

  const mean = average(preview.pixels);
  const contrast = standardDeviation(preview.pixels, mean);

  const blurSamples = [];
  for (let y = 1; y < preview.height - 1; y += 1) {
    for (let x = 1; x < preview.width - 1; x += 1) {
      const center = preview.pixels[y * preview.width + x];
      const left = preview.pixels[y * preview.width + (x - 1)];
      const right = preview.pixels[y * preview.width + (x + 1)];
      const up = preview.pixels[(y - 1) * preview.width + x];
      const down = preview.pixels[(y + 1) * preview.width + x];
      const laplacian = Math.abs(4 * center - left - right - up - down);
      blurSamples.push(laplacian);
    }
  }

  const blurScore = average(blurSamples) * 100;
  const histogram = computeHistogram(preview.pixels);
  const diffHash = computeDifferenceHash(
    hashGrid.pixels,
    hashGrid.width,
    hashGrid.height
  );

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  const metrics = {
    label,
    width,
    height,
    orientation: height >= width ? "portrait" : "landscape",
    brightness: Number(mean.toFixed(4)),
    contrast: Number(contrast.toFixed(4)),
    blurScore: Number(blurScore.toFixed(2)),
    histogram,
    previewPixels: preview.pixels,
    diffHash,
  };

  return {
    metrics,
    qualityFlags: buildQualityFlags(metrics),
  };
}

export async function analyzeBathroomObjectsWithAi(
  roomType,
  baselineInput,
  currentInput,
  deterministicComparison
) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  const trackedObjects = getTrackedObjects(roomType);
  const baselineImageUrl = await toDataUrl(baselineInput);
  const currentImageUrl = await toDataUrl(currentInput);

  const prompt = [
    `You are reviewing two ${roomType.replaceAll("_", " ")} photos of the same property: a baseline image and a current image.`,
    "Focus only on the allowed high-confidence tracked objects listed below.",
    "Allowed object names are exactly:",
    trackedObjects.join(", "),
    "Do not infer that an object is missing from the property. Only judge whether it is visible in the current frame.",
    "If the object was visible before and is not visible now, say that it is not visible in the current frame and explain why with confidence.",
    "Ignore tiny clutter, loose small items, and unstable objects unless they block a major object.",
    "Return strict JSON only.",
    `Deterministic comparison context: sameRoomVerdict=${deterministicComparison.sameRoomVerdict}, changeSeverity=${deterministicComparison.changeSeverity}.`,
    "JSON shape:",
    JSON.stringify(
      {
        sameRoomAssessment: {
          verdict: "likely|uncertain|unlikely",
          confidence: 0.0,
          summary: "short sentence",
        },
        trackedObjects: [
          {
            objectName: trackedObjects[0],
            baselineVisibility: "visible|not_visible|uncertain",
            currentVisibility: "visible|not_visible|uncertain",
            missingInCurrentConfidence: 0.0,
            previousLocation: "short phrase describing where it appeared in the baseline image",
            previousAppearance: "short phrase describing how it looked in the baseline image",
            currentVisibilityReason: "short phrase explaining the current visibility judgment",
          },
        ],
        summary: "2-4 sentence overall summary",
      },
      null,
      2
    ),
  ].join("\n");

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_INSPECTION_MODEL,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_text", text: "Baseline image" },
            { type: "input_image", image_url: baselineImageUrl },
            { type: "input_text", text: "Current image" },
            { type: "input_image", image_url: currentImageUrl },
          ],
        },
      ],
      max_output_tokens: 1200,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI inspection request failed: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  const rawText =
    typeof payload.output_text === "string" && payload.output_text.trim()
      ? payload.output_text
      : Array.isArray(payload.output)
        ? payload.output
            .flatMap((item) =>
              Array.isArray(item?.content)
                ? item.content
                    .map((contentItem) =>
                      typeof contentItem?.text === "string" ? contentItem.text : null
                    )
                    .filter(Boolean)
                : []
            )
            .join("\n")
        : "";

  const parsed = JSON.parse(extractJsonObject(rawText || ""));
  const normalizedTrackedObjects = Array.isArray(parsed.trackedObjects)
    ? parsed.trackedObjects.map((item) => ({
        objectName: normalizeTrackedObjectName(item?.objectName, roomType),
        baselineVisibility: normalizeVisibility(item?.baselineVisibility),
        currentVisibility: normalizeVisibility(item?.currentVisibility),
        missingInCurrentConfidence: normalizeConfidence(item?.missingInCurrentConfidence),
        previousLocation:
          typeof item?.previousLocation === "string" ? item.previousLocation.trim() : "",
        previousAppearance:
          typeof item?.previousAppearance === "string" ? item.previousAppearance.trim() : "",
        currentVisibilityReason:
          typeof item?.currentVisibilityReason === "string"
            ? item.currentVisibilityReason.trim()
            : "",
      }))
    : [];

  return {
    enabled: true,
    model: DEFAULT_INSPECTION_MODEL,
    roomType,
    sameRoomAssessment: {
      verdict: normalizeSameRoomVerdict(parsed?.sameRoomAssessment?.verdict),
      confidence: normalizeConfidence(parsed?.sameRoomAssessment?.confidence),
      summary:
        typeof parsed?.sameRoomAssessment?.summary === "string"
          ? parsed.sameRoomAssessment.summary.trim()
          : "",
    },
    trackedObjects: normalizedTrackedObjects,
    summary: typeof parsed?.summary === "string" ? parsed.summary.trim() : "",
  };
}

export async function detectRoomObjectsInPhotoWithAi(roomType, imageInput) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  const trackedObjects = getTrackedObjects(roomType);
  const imageUrl = await toDataUrl(imageInput);

  const prompt = [
    `You are reviewing a single ${roomType.replaceAll("_", " ")} baseline photo.`,
    "Focus only on the allowed high-confidence tracked objects listed below.",
    "Allowed object names are exactly:",
    trackedObjects.join(", "),
    "Check the actual image carefully. Do not guess based on the room type.",
    "For every allowed object, decide whether it is clearly visible, uncertain, or not visible in this specific image.",
    "Only include items in trackedObjects when they are clearly visible in this specific image.",
    "For each clearly visible object, include an approximate normalized center point in the image where x and y are each between 0 and 1.",
    "The coordinates should point near the visual center of that object in the image.",
    "If you are not reasonably confident about a location, do not include that object in trackedObjects.",
    "Return strict JSON only.",
    "JSON shape:",
    JSON.stringify(
      {
        objectChecks: trackedObjects.map((objectName) => ({
          objectName,
          visibility: "visible|uncertain|not_visible",
          confidence: 0.0,
          reason: "short sentence grounded in this image",
        })),
        trackedObjects: [
          {
            objectName: trackedObjects[0],
            visibility: "visible",
            confidence: 0.0,
            centerX: 0.5,
            centerY: 0.5,
            reason: "short sentence grounded in this image",
          },
        ],
        summary: "1-2 sentence summary grounded in this image",
      },
      null,
      2
    ),
  ].join("\n");

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_INSPECTION_MODEL,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_text", text: "Baseline image" },
            { type: "input_image", image_url: imageUrl },
          ],
        },
      ],
      max_output_tokens: 900,
    }),
  });
  const parsed = await parseResponsesOutput(response);

  const bulkTrackedObjects = Array.isArray(parsed?.trackedObjects)
    ? parsed.trackedObjects
        .map((item) => normalizeDetectedPhotoObject(item, roomType))
        .filter(
          (item) =>
            item.objectName !== "unknown" &&
            item.visibility === "visible" &&
            item.centerX !== null &&
            item.centerY !== null
        )
    : [];

  let trackedObjectsResult = bulkTrackedObjects;

  if (trackedObjectsResult.length === 0) {
    const focusedResults = await Promise.all(
      trackedObjects.map((objectName) =>
        detectSingleTrackedObjectInPhotoWithAi(
          roomType,
          objectName,
          imageUrl,
          apiKey
        )
      )
    );

    trackedObjectsResult = focusedResults.filter(Boolean);
  }

  return {
    enabled: true,
    model: DEFAULT_INSPECTION_MODEL,
    roomType,
    trackedObjects: trackedObjectsResult,
    summary: typeof parsed?.summary === "string" ? parsed.summary.trim() : "",
  };
}

export function compareBathroomBaseShots(baseline, current) {
  const hashDistance = hammingDistance(
    baseline.metrics.diffHash,
    current.metrics.diffHash
  );
  const histogramSimilarity = compareHistograms(
    baseline.metrics.histogram,
    current.metrics.histogram
  );
  const pixelDifference = computePixelDifference(
    baseline.metrics.previewPixels,
    current.metrics.previewPixels
  );
  const orientationMismatch =
    baseline.metrics.orientation !== current.metrics.orientation;

  let sameRoomVerdict = "uncertain";

  if (!orientationMismatch && hashDistance <= 18 && histogramSimilarity >= 0.78) {
    sameRoomVerdict = "likely";
  } else if (hashDistance >= 34 || histogramSimilarity <= 0.55) {
    sameRoomVerdict = "unlikely";
  }

  let changeSeverity = "minor";
  if (pixelDifference >= 0.22 || hashDistance >= 26) {
    changeSeverity = "major";
  } else if (pixelDifference >= 0.12 || hashDistance >= 18) {
    changeSeverity = "moderate";
  }

  const findings = [];

  if (baseline.qualityFlags.length) {
    findings.push({
      type: "baseline_low_quality",
      severity: "warning",
      confidence: "high",
      summary: baseline.qualityFlags.join(" "),
    });
  }

  if (current.qualityFlags.length) {
    findings.push({
      type: "current_low_quality",
      severity: "warning",
      confidence: "high",
      summary: current.qualityFlags.join(" "),
    });
  }

  if (orientationMismatch) {
    findings.push({
      type: "framing_variance",
      severity: "warning",
      confidence: "high",
      summary:
        "Baseline and current photos use different orientation, which weakens comparison reliability.",
    });
  }

  if (sameRoomVerdict === "unlikely") {
    findings.push({
      type: "probable_wrong_room",
      severity: "critical",
      confidence: "medium",
      summary:
        "Current image does not strongly resemble the baseline room state shot.",
    });
  } else if (sameRoomVerdict === "uncertain") {
    findings.push({
      type: "review_required",
      severity: "warning",
      confidence: "medium",
      summary:
        "Current image only partially matches the baseline framing. Manual review is recommended.",
    });
  }

  if (changeSeverity === "major") {
    findings.push({
      type: "major_visual_change",
      severity: "warning",
      confidence: sameRoomVerdict === "likely" ? "medium" : "low",
      summary:
        "Large visual differences were detected between baseline and current room state shots.",
    });
  } else if (changeSeverity === "moderate") {
    findings.push({
      type: "moderate_visual_change",
      severity: "info",
      confidence: sameRoomVerdict === "likely" ? "medium" : "low",
      summary:
        "Moderate visual differences were detected. This may reflect clutter, repositioning, or framing drift.",
    });
  }

  const reviewRequired = findings.some((finding) =>
    ["critical", "warning"].includes(finding.severity)
  );

  return {
    sameRoomVerdict,
    changeSeverity,
    reviewRequired,
    metrics: {
      hashDistance,
      histogramSimilarity: Number(histogramSimilarity.toFixed(4)),
      pixelDifference: Number(pixelDifference.toFixed(4)),
    },
    findings,
  };
}

export function mergeBathroomAiFindings(comparison, aiAnalysis) {
  if (!aiAnalysis?.trackedObjects?.length) {
    return comparison;
  }

  const findings = [...comparison.findings];

  for (const item of aiAnalysis.trackedObjects) {
    if (
      item.objectName === "unknown" ||
      item.baselineVisibility !== "visible" ||
      item.currentVisibility !== "not_visible"
    ) {
      continue;
    }

    const severity = item.missingInCurrentConfidence >= 0.8 ? "warning" : "info";
    const confidenceLabel =
      item.missingInCurrentConfidence >= 0.8
        ? "high"
        : item.missingInCurrentConfidence >= 0.6
          ? "medium"
          : "low";

    findings.push({
      type: "object_not_visible_in_current_frame",
      severity,
      confidence: confidenceLabel,
      objectName: item.objectName,
      summary: `${toSentenceCase(item.objectName)} was visible before${
        item.previousLocation ? ` (${item.previousLocation})` : ""
      } but is not visible in the current frame.`,
      previousAppearance: item.previousAppearance || null,
      currentVisibilityReason: item.currentVisibilityReason || null,
      missingInCurrentConfidence: item.missingInCurrentConfidence,
    });
  }

  const reviewRequired = findings.some((finding) =>
    ["critical", "warning"].includes(finding.severity)
  );

  return {
    ...comparison,
    reviewRequired,
    findings,
    aiAnalysis,
    aiHighlights: collectAiHighlights(aiAnalysis),
    trackedTargets: buildTrackedTargets(aiAnalysis.roomType || "bathroom", aiAnalysis),
  };
}

export function buildBathroomNarrative(caseId, comparison) {
  const lines = [];
  const roomTypeLabel = String(comparison.roomType || "bathroom").replaceAll("_", " ");

  lines.push(`Case ${caseId}: ${roomTypeLabel} state comparison completed.`);

  if (comparison.sameRoomVerdict === "likely") {
    lines.push("The current photo is likely from the same room and main direction.");
  } else if (comparison.sameRoomVerdict === "uncertain") {
    lines.push(
      "The current photo may be from the same room, but framing consistency is not strong enough for automatic trust."
    );
  } else {
    lines.push(
      "The current photo does not strongly match the baseline room state shot and should be reviewed manually."
    );
  }

  if (comparison.changeSeverity === "major") {
    lines.push("A large visible scene change is present.");
  } else if (comparison.changeSeverity === "moderate") {
    lines.push("A moderate visible scene change is present.");
  } else {
    lines.push("Only limited visible scene change is present.");
  }

  if (comparison.reviewRequired) {
    lines.push("Human review is recommended before using this comparison in an operational report.");
  }

  if (comparison.aiAnalysis?.summary) {
    lines.push(`AI review: ${comparison.aiAnalysis.summary}`);
  }

  if (comparison.aiHighlights?.length) {
    lines.push(`Tracked objects not visible in the current frame: ${comparison.aiHighlights.join(" ")}`);
  }

  return lines.join(" ");
}

export function buildBathroomMarkdownReport(caseId, roomType, baseline, current, comparison) {
  const findingsSection =
    comparison.findings.length === 0
      ? "- No flags raised.\n"
      : comparison.findings
          .map(
            (finding) =>
              `- **${finding.type}** (${finding.severity}, ${finding.confidence} confidence): ${finding.summary}`
          )
          .join("\n");

  return `# Room State Report

## Case
- Case ID: \`${caseId}\`
- Room Type: \`${roomType}\`
- Capture Type: \`base_shot\`

## Quality
### Baseline
- Dimensions: ${baseline.metrics.width}x${baseline.metrics.height}
- Orientation: ${baseline.metrics.orientation}
- Brightness: ${baseline.metrics.brightness}
- Contrast: ${baseline.metrics.contrast}
- Blur Score: ${baseline.metrics.blurScore}

### Current
- Dimensions: ${current.metrics.width}x${current.metrics.height}
- Orientation: ${current.metrics.orientation}
- Brightness: ${current.metrics.brightness}
- Contrast: ${current.metrics.contrast}
- Blur Score: ${current.metrics.blurScore}

## Comparison
- Same Room Verdict: **${comparison.sameRoomVerdict}**
- Change Severity: **${comparison.changeSeverity}**
- Review Required: **${comparison.reviewRequired ? "yes" : "no"}**
- Hash Distance: ${comparison.metrics.hashDistance}
- Histogram Similarity: ${comparison.metrics.histogramSimilarity}
- Pixel Difference: ${comparison.metrics.pixelDifference}

## Findings
${findingsSection}

## AI Visibility Review
${
  comparison.aiAnalysis?.trackedObjects?.length
    ? comparison.aiAnalysis.trackedObjects
        .map(
          (item) => `- **${toSentenceCase(item.objectName)}**
  - Baseline: ${item.baselineVisibility}
  - Current: ${item.currentVisibility}
  - Missing In Current Confidence: ${item.missingInCurrentConfidence}
  - Previous Location: ${item.previousLocation || "Not stated"}
  - Previous Appearance: ${item.previousAppearance || "Not stated"}
  - Current Visibility Reason: ${item.currentVisibilityReason || "Not stated"}`
        )
        .join("\n")
    : "- AI visibility review not available.\n"
}

## Narrative Summary
${buildBathroomNarrative(caseId, comparison)}
`;
}

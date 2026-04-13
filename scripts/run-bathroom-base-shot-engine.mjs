import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const DEFAULT_MANIFEST = path.resolve(
  process.cwd(),
  "inspection-lab",
  "bathroom-base-shot",
  "example-case",
  "manifest.json"
);

const QUALITY_THRESHOLDS = {
  minWidth: 900,
  minHeight: 1200,
  minBrightness: 0.2,
  minContrast: 0.1,
  minBlurScore: 6,
};

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

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function readManifest(manifestPath) {
  const raw = await fs.readFile(manifestPath, "utf8");
  return JSON.parse(raw);
}

function resolveCasePath(manifestPath, relativePath) {
  return path.resolve(path.dirname(manifestPath), relativePath);
}

async function loadNormalizedGrayscale(imagePath, width, height) {
  const { data, info } = await sharp(imagePath)
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

async function analyzeImage(imagePath) {
  const metadata = await sharp(imagePath).rotate().metadata();
  const preview = await loadNormalizedGrayscale(imagePath, 128, 128);
  const hashGrid = await loadNormalizedGrayscale(imagePath, 9, 8);

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
    path: imagePath,
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

function compareBathroomBaseShots(baseline, current) {
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
        "Current image does not strongly resemble the baseline bathroom base shot.",
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
        "Large visual differences were detected between baseline and current bathroom base shots.",
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

function buildNarrative(caseId, comparison) {
  const lines = [];

  lines.push(`Case ${caseId}: bathroom base-shot comparison completed.`);

  if (comparison.sameRoomVerdict === "likely") {
    lines.push("The current photo is likely from the same bathroom and main direction.");
  } else if (comparison.sameRoomVerdict === "uncertain") {
    lines.push(
      "The current photo may be from the same bathroom, but framing consistency is not strong enough for automatic trust."
    );
  } else {
    lines.push(
      "The current photo does not strongly match the baseline bathroom base shot and should be reviewed manually."
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

  return lines.join(" ");
}

function buildMarkdownReport(manifest, baseline, current, comparison) {
  const findingsSection =
    comparison.findings.length === 0
      ? "- No flags raised.\n"
      : comparison.findings
          .map(
            (finding) =>
              `- **${finding.type}** (${finding.severity}, ${finding.confidence} confidence): ${finding.summary}`
          )
          .join("\n");

  return `# Bathroom Base-Shot Report

## Case
- Case ID: \`${manifest.case_id}\`
- Room Type: \`${manifest.room_type}\`
- Capture Type: \`${manifest.capture_type}\`

## Inputs
- Baseline Photo: \`${manifest.baseline_photo.path}\`
- Current Photo: \`${manifest.current_photo.path}\`

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

## Narrative Summary
${buildNarrative(manifest.case_id, comparison)}
`;
}

async function main() {
  const manifestPath = path.resolve(process.argv[2] || DEFAULT_MANIFEST);
  const manifest = await readManifest(manifestPath);

  if (manifest.room_type !== "bathroom") {
    throw new Error("This v1 engine currently supports only room_type='bathroom'.");
  }

  if (manifest.capture_type !== "base_shot") {
    throw new Error(
      "This v1 engine currently supports only capture_type='base_shot'."
    );
  }

  const baselinePhotoPath = resolveCasePath(manifestPath, manifest.baseline_photo.path);
  const currentPhotoPath = resolveCasePath(manifestPath, manifest.current_photo.path);

  const baseline = await analyzeImage(baselinePhotoPath);
  const current = await analyzeImage(currentPhotoPath);
  const comparison = compareBathroomBaseShots(baseline, current);

  const outputDir = resolveCasePath(
    manifestPath,
    manifest.output_dir || "../../results/" + manifest.case_id
  );

  await ensureDir(outputDir);

  const findingsPayload = {
    manifest: {
      case_id: manifest.case_id,
      room_type: manifest.room_type,
      capture_type: manifest.capture_type,
    },
    baseline: {
      path: baselinePhotoPath,
      qualityFlags: baseline.qualityFlags,
      metrics: {
        width: baseline.metrics.width,
        height: baseline.metrics.height,
        orientation: baseline.metrics.orientation,
        brightness: baseline.metrics.brightness,
        contrast: baseline.metrics.contrast,
        blurScore: baseline.metrics.blurScore,
      },
    },
    current: {
      path: currentPhotoPath,
      qualityFlags: current.qualityFlags,
      metrics: {
        width: current.metrics.width,
        height: current.metrics.height,
        orientation: current.metrics.orientation,
        brightness: current.metrics.brightness,
        contrast: current.metrics.contrast,
        blurScore: current.metrics.blurScore,
      },
    },
    comparison,
    narrative: buildNarrative(manifest.case_id, comparison),
  };

  const reportMarkdown = buildMarkdownReport(
    manifest,
    baseline,
    current,
    comparison
  );

  await fs.writeFile(
    path.join(outputDir, "findings.json"),
    JSON.stringify(findingsPayload, null, 2),
    "utf8"
  );
  await fs.writeFile(path.join(outputDir, "report.md"), reportMarkdown, "utf8");

  console.log(`Bathroom inspection report written to: ${outputDir}`);
  console.log(JSON.stringify(comparison, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

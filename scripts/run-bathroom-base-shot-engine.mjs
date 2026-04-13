import fs from "node:fs/promises";
import path from "node:path";
import {
  analyzeBathroomBaseShot,
  buildBathroomMarkdownReport,
  buildBathroomNarrative,
  compareBathroomBaseShots,
} from "../lib/inspection-lab/bathroom-base-shot-engine.mjs";

const DEFAULT_MANIFEST = path.resolve(
  process.cwd(),
  "inspection-lab",
  "bathroom-base-shot",
  "example-case",
  "manifest.json"
);

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

  const baseline = await analyzeBathroomBaseShot(
    await fs.readFile(baselinePhotoPath),
    "baseline"
  );
  const current = await analyzeBathroomBaseShot(
    await fs.readFile(currentPhotoPath),
    "current"
  );
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
    narrative: buildBathroomNarrative(manifest.case_id, comparison),
  };

  const reportMarkdown = buildBathroomMarkdownReport(
    manifest.case_id,
    baseline,
    current,
    comparison,
    {
      baselinePhotoLabel: manifest.baseline_photo.path,
      currentPhotoLabel: manifest.current_photo.path,
    }
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

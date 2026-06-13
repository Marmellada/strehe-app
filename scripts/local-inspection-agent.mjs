import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import {
  analyzeBathroomBaseShot,
  compareBathroomBaseShots,
} from "../lib/inspection-lab/bathroom-base-shot-engine.mjs";

const CAPABILITY = "inspection.photo.compare";
const MAX_QUALITY_ATTEMPTS = 3;
const VERDICTS = new Set(["likely", "uncertain", "unlikely"]);
const SEVERITIES = new Set(["minor", "moderate", "major"]);

function readEnv(filePath) {
  const values = new Map();
  if (!fs.existsSync(filePath)) return values;

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    values.set(
      trimmed.slice(0, separator).trim(),
      trimmed
        .slice(separator + 1)
        .trim()
        .replace(/^['"]|['"]$/g, "")
    );
  }

  return values;
}

function requireValue(values, key) {
  const value = values.get(key) || process.env[key];
  if (!value) throw new Error(`Missing ${key} in the local inspection agent environment.`);
  return value;
}

function ensureLocalOllamaUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (!["127.0.0.1", "localhost", "::1"].includes(url.hostname)) {
    throw new Error("OLLAMA_BASE_URL must point to this PC. Public AI APIs are disabled.");
  }
  return url.toString().replace(/\/$/, "");
}

function cleanJsonText(value) {
  const trimmed = String(value || "").trim();
  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  return start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed;
}

function metadataRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeVisionResult(value) {
  const candidate = metadataRecord(value);
  const observations = Array.isArray(candidate.observations)
    ? candidate.observations
        .filter((item) => item && typeof item === "object" && !Array.isArray(item))
        .slice(0, 12)
        .map((item) => ({
          type:
            typeof item.type === "string"
              ? item.type.slice(0, 80)
              : "visual_observation",
          severity: ["info", "warning", "critical"].includes(item.severity)
            ? item.severity
            : "info",
          summary:
            typeof item.summary === "string"
              ? item.summary.trim().slice(0, 500)
              : "",
        }))
        .filter((item) => item.summary)
    : [];

  return {
    same_room_verdict: VERDICTS.has(candidate.same_room_verdict)
      ? candidate.same_room_verdict
      : "uncertain",
    change_severity: SEVERITIES.has(candidate.change_severity)
      ? candidate.change_severity
      : "moderate",
    summary:
      typeof candidate.summary === "string"
        ? candidate.summary.trim().slice(0, 1200)
        : "",
    observations,
  };
}

function validateVisionResult(value) {
  const errors = [];
  if (!VERDICTS.has(value.same_room_verdict)) {
    errors.push("same_room_verdict must be likely, uncertain, or unlikely");
  }
  if (!SEVERITIES.has(value.change_severity)) {
    errors.push("change_severity must be minor, moderate, or major");
  }
  if (!value.summary || value.summary.length < 20) {
    errors.push("summary must contain a practical visual explanation");
  }
  if (!Array.isArray(value.observations)) {
    errors.push("observations must be an array");
  }
  return errors;
}

async function runLocalVisionReview(config, baseline, current, context) {
  const corrections = [];
  let previousErrors = [];
  const [baselineVisionInput, currentVisionInput] = await Promise.all([
    sharp(baseline)
      .rotate()
      .resize({ width: 1024, height: 1024, fit: "inside" })
      .jpeg({ quality: 85 })
      .toBuffer(),
    sharp(current)
      .rotate()
      .resize({ width: 1024, height: 1024, fit: "inside" })
      .jpeg({ quality: 85 })
      .toBuffer(),
  ]);

  for (let attempt = 1; attempt <= MAX_QUALITY_ATTEMPTS; attempt += 1) {
    const prompt = [
      "Compare the two property inspection photos. The first image is the baseline and the second is current.",
      `Room type: ${context.roomType.replaceAll("_", " ")}.`,
      `Deterministic same-room signal: ${context.deterministic.sameRoomVerdict}.`,
      `Deterministic change signal: ${context.deterministic.changeSeverity}.`,
      "Be conservative. Do not identify people, infer ownership, or invent hidden damage.",
      "Describe only visible room-state differences that are useful to a property manager.",
      "Return JSON only with this exact shape:",
      JSON.stringify({
        same_room_verdict: "likely|uncertain|unlikely",
        change_severity: "minor|moderate|major",
        summary: "brief practical comparison",
        observations: [
          {
            type: "visible_change",
            severity: "info|warning|critical",
            summary: "visible evidence only",
          },
        ],
      }),
      previousErrors.length
        ? `Correct these validation problems from the previous attempt: ${previousErrors.join(
            "; "
          )}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const response = await fetch(`${config.ollamaBaseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.ollamaModel,
          stream: false,
          think: false,
          format: "json",
          messages: [
            {
              role: "user",
              content: prompt,
              images: [
                baselineVisionInput.toString("base64"),
                currentVisionInput.toString("base64"),
              ],
            },
          ],
          options: {
            temperature: 0.1,
            num_ctx: 8192,
          },
        }),
        signal: AbortSignal.timeout(180000),
      });

      if (!response.ok) {
        throw new Error(`Ollama returned ${response.status}: ${await response.text()}`);
      }

      const payload = await response.json();
      const parsed = JSON.parse(cleanJsonText(payload?.message?.content));
      const normalized = normalizeVisionResult(parsed);
      previousErrors = validateVisionResult(normalized);

      if (previousErrors.length === 0) {
        return {
          result: normalized,
          model: config.ollamaModel,
          attempts: attempt,
          corrections,
        };
      }

      corrections.push(
        `Local vision attempt ${attempt} was rejected: ${previousErrors.join("; ")}.`
      );
    } catch (error) {
      previousErrors = [
        error instanceof Error ? error.message : "Unknown local vision error.",
      ];
      corrections.push(
        `Local vision attempt ${attempt} failed: ${previousErrors[0]}`
      );
    }
  }

  return {
    result: null,
    model: config.ollamaModel,
    attempts: MAX_QUALITY_ATTEMPTS,
    corrections,
  };
}

function selectWorst(values, ranking) {
  return [...values].sort(
    (left, right) => ranking.indexOf(right) - ranking.indexOf(left)
  )[0];
}

function buildReport(caseId, roomType, comparison, pairs, localModel) {
  const pairLines = pairs
    .map(
      (pair) =>
        `- Pair ${pair.order_index}: **${pair.same_room_verdict}** room match, **${pair.change_severity}** change. ${pair.summary}`
    )
    .join("\n");

  return `# Local Room Comparison

## Case
- Case ID: \`${caseId}\`
- Room type: \`${roomType}\`
- Processing: local PC only
- Local vision model: ${localModel || "deterministic fallback"}

## Summary
- Same room verdict: **${comparison.sameRoomVerdict}**
- Change severity: **${comparison.changeSeverity}**
- Human review required: **yes**

## Photo Pairs
${pairLines}

## Privacy
The agent received expiring copies through the private agent-artifacts bucket. No public AI API was used, and no image bytes or storage paths are included in this report.
`;
}

function forbiddenKeys(value, currentPath = "") {
  const matches = [];
  if (!value || typeof value !== "object") return matches;

  for (const [key, child] of Object.entries(value)) {
    const pathValue = currentPath ? `${currentPath}.${key}` : key;
    if (
      [
        "storage_path",
        "signed_url",
        "image_bytes",
        "base64",
        "source_photo_id",
      ].includes(key)
    ) {
      matches.push(pathValue);
    }
    matches.push(...forbiddenKeys(child, pathValue));
  }
  return matches;
}

function validateFinalResult(result) {
  const errors = [];
  if (result.schema_version !== 1) errors.push("schema_version must be 1");
  if (result.comparison_type !== "room_state") {
    errors.push("comparison_type must be room_state");
  }
  if (!result.summary || result.summary.pair_count < 1) {
    errors.push("at least one matched photo pair is required");
  }
  if (!VERDICTS.has(result.summary?.same_room_verdict)) {
    errors.push("summary same-room verdict is invalid");
  }
  if (!SEVERITIES.has(result.summary?.change_severity)) {
    errors.push("summary change severity is invalid");
  }
  if (
    result.privacy?.local_processing !== true ||
    result.privacy?.external_ai_used !== false ||
    result.privacy?.temporary_photos_only !== true
  ) {
    errors.push("privacy boundary is incomplete");
  }
  const forbidden = forbiddenKeys(result);
  if (forbidden.length > 0) {
    errors.push(`forbidden raw input references found: ${forbidden.join(", ")}`);
  }
  return errors;
}

async function analyzeJob(config, supabase, job) {
  const { data: artifacts, error: artifactsError } = await supabase
    .from("agent_artifacts")
    .select("id, storage_bucket, storage_path, mime_type, metadata")
    .eq("job_id", job.id)
    .eq("artifact_kind", "input")
    .order("created_at");
  if (artifactsError) throw artifactsError;

  const inputs = [];
  for (const artifact of artifacts || []) {
    const metadata = metadataRecord(artifact.metadata);
    const slot = metadata.capture_slot;
    const orderIndex = Number(metadata.order_index);
    if (!["baseline", "current"].includes(slot) || !Number.isInteger(orderIndex)) {
      continue;
    }

    const { data, error } = await supabase.storage
      .from(artifact.storage_bucket)
      .download(artifact.storage_path);
    if (error || !data) {
      throw new Error(`Temporary inspection input download failed: ${error?.message}`);
    }

    inputs.push({
      slot,
      orderIndex,
      photoType:
        typeof metadata.photo_type === "string" ? metadata.photo_type : null,
      buffer: Buffer.from(await data.arrayBuffer()),
    });
  }

  const baselineByOrder = new Map(
    inputs
      .filter((item) => item.slot === "baseline")
      .map((item) => [item.orderIndex, item])
  );
  const currentByOrder = new Map(
    inputs
      .filter((item) => item.slot === "current")
      .map((item) => [item.orderIndex, item])
  );
  const matchedOrders = [...baselineByOrder.keys()]
    .filter((order) => currentByOrder.has(order))
    .sort((left, right) => left - right);

  if (matchedOrders.length === 0) {
    throw new Error("No baseline/current photo pairs share the same order number.");
  }

  const payload = metadataRecord(job.payload);
  const caseId =
    typeof payload.case_id === "string" ? payload.case_id : String(job.id);
  const roomType =
    payload.room_type === "living_room" ? "living_room" : "bathroom";
  const pairs = [];
  const corrections = [];
  let localModelUsed = false;
  let maxVisionAttempts = 0;

  for (const orderIndex of matchedOrders) {
    const baselineInput = baselineByOrder.get(orderIndex);
    const currentInput = currentByOrder.get(orderIndex);
    const [baselineAnalysis, currentAnalysis] = await Promise.all([
      analyzeBathroomBaseShot(
        baselineInput.buffer,
        `baseline-${orderIndex}-${baselineInput.photoType || "capture"}`
      ),
      analyzeBathroomBaseShot(
        currentInput.buffer,
        `current-${orderIndex}-${currentInput.photoType || "capture"}`
      ),
    ]);
    const deterministic = compareBathroomBaseShots(
      baselineAnalysis,
      currentAnalysis
    );
    const vision = await runLocalVisionReview(
      config,
      baselineInput.buffer,
      currentInput.buffer,
      { roomType, deterministic }
    );
    corrections.push(...vision.corrections);
    maxVisionAttempts = Math.max(maxVisionAttempts, vision.attempts);
    localModelUsed ||= Boolean(vision.result);

    const sameRoomVerdict =
      vision.result?.same_room_verdict || deterministic.sameRoomVerdict;
    const changeSeverity =
      vision.result?.change_severity || deterministic.changeSeverity;
    const summary =
      vision.result?.summary ||
      deterministic.findings.map((finding) => finding.summary).join(" ") ||
      "The deterministic comparison found no strong visible warning.";
    const visualFindings = vision.result?.observations || [];
    const findings = [
      ...deterministic.findings.map((finding) => ({
        type: finding.type,
        severity: finding.severity,
        confidence: finding.confidence,
        summary: finding.summary,
        source: "deterministic",
      })),
      ...visualFindings.map((finding) => ({
        ...finding,
        confidence: "local_model",
        source: "local_vision",
      })),
    ];

    pairs.push({
      order_index: orderIndex,
      photo_type: baselineInput.photoType || currentInput.photoType,
      same_room_verdict: sameRoomVerdict,
      change_severity: changeSeverity,
      review_required: true,
      finding_count: findings.length,
      summary,
      metrics: deterministic.metrics,
      findings,
    });
  }

  const aggregateVerdict = selectWorst(
    pairs.map((pair) => pair.same_room_verdict),
    ["likely", "uncertain", "unlikely"]
  );
  const aggregateSeverity = selectWorst(
    pairs.map((pair) => pair.change_severity),
    ["minor", "moderate", "major"]
  );
  const findingCount = pairs.reduce(
    (sum, pair) => sum + pair.finding_count,
    0
  );
  const comparison = {
    sameRoomVerdict: aggregateVerdict,
    changeSeverity: aggregateSeverity,
    reviewRequired: true,
    findingCount,
    findings: pairs.flatMap((pair) => pair.findings).slice(0, 30),
    baselineCaptureCount: inputs.filter((item) => item.slot === "baseline").length,
    currentCaptureCount: inputs.filter((item) => item.slot === "current").length,
  };

  let result = {
    schema_version: 1,
    comparison_type: "room_state",
    case_id: caseId,
    room_type: roomType,
    summary: {
      pair_count: pairs.length,
      same_room_verdict: aggregateVerdict,
      change_severity: aggregateSeverity,
      review_required: true,
      finding_count: findingCount,
    },
    pairs,
    comparison,
    report_markdown: buildReport(
      caseId,
      roomType,
      comparison,
      pairs,
      localModelUsed ? config.ollamaModel : null
    ),
    privacy: {
      temporary_photos_only: true,
      external_ai_used: false,
      local_processing: true,
      raw_images_returned: false,
      storage_paths_returned: false,
    },
    runtime: {
      engine: "sharp-deterministic-plus-local-ollama",
      local_model: localModelUsed ? config.ollamaModel : null,
      local_model_used: localModelUsed,
      gpu_preferred: true,
    },
    quality: {
      status: "checking",
      attempts: Math.max(1, maxVisionAttempts),
      checks: ["schema", "image-pairs", "privacy", "usefulness"],
      corrections,
      human_review_required: true,
    },
  };

  for (let attempt = 1; attempt <= MAX_QUALITY_ATTEMPTS; attempt += 1) {
    const errors = validateFinalResult(result);
    if (errors.length === 0) {
      result = {
        ...result,
        quality: {
          ...result.quality,
          status: "passed",
          attempts: Math.max(attempt, result.quality.attempts),
        },
      };
      return result;
    }
    corrections.push(`Result quality attempt ${attempt}: ${errors.join("; ")}.`);
    result = {
      ...result,
      summary: {
        ...result.summary,
        pair_count: pairs.length,
        review_required: true,
      },
      privacy: {
        temporary_photos_only: true,
        external_ai_used: false,
        local_processing: true,
        raw_images_returned: false,
        storage_paths_returned: false,
      },
    };
  }

  throw new Error("Inspection output failed bounded quality validation.");
}

async function processNextJob(config, supabase) {
  const now = new Date().toISOString();
  const { data: jobs, error: jobsError } = await supabase
    .from("agent_jobs")
    .select("id, payload")
    .eq("required_capability", CAPABILITY)
    .eq("status", "queued")
    .lte("available_at", now)
    .gt("expires_at", now)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(5);
  if (jobsError) throw jobsError;
  if (!jobs?.length) return false;

  for (const candidate of jobs) {
    const { data: claimed, error: claimError } = await supabase.rpc(
      "claim_agent_job",
      {
        target_job_id: candidate.id,
        lease_seconds: 600,
      }
    );
    if (claimError || !claimed) continue;

    try {
      const result = await analyzeJob(config, supabase, claimed);
      const { error: completionError } = await supabase.rpc(
        "complete_agent_job",
        {
          target_job_id: claimed.id,
          job_result: result,
        }
      );
      if (completionError) throw completionError;
      console.log(
        `Completed ${claimed.id}: ${result.summary.same_room_verdict}, ${result.summary.change_severity}, local model ${result.runtime.local_model_used ? "used" : "fallback"}.`
      );
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown inspection worker failure.";
      await supabase.rpc("fail_agent_job", {
        target_job_id: claimed.id,
        failure_code: "inspection_processing_failed",
        failure_message: message,
      });
      console.error(`Failed ${claimed.id}: ${message}`);
      return true;
    }
  }

  return false;
}

const env = readEnv(
  path.resolve(process.cwd(), ".env.inspection-agent.local")
);
const config = {
  supabaseUrl: requireValue(env, "SUPABASE_URL"),
  anonKey: requireValue(env, "SUPABASE_ANON_KEY"),
  email: requireValue(env, "SUPABASE_AGENT_EMAIL"),
  password: requireValue(env, "SUPABASE_AGENT_PASSWORD"),
  ollamaBaseUrl: ensureLocalOllamaUrl(
    env.get("OLLAMA_BASE_URL") || "http://127.0.0.1:11434"
  ),
  ollamaModel: env.get("OLLAMA_MODEL") || "qwen3.5:2b",
  pollSeconds: Math.max(
    2,
    Number(env.get("INSPECTION_WORKER_POLL_SECONDS") || 10)
  ),
};
const supabase = createClient(config.supabaseUrl, config.anonKey, {
  auth: { autoRefreshToken: true, persistSession: false },
});
const { error: signInError } = await supabase.auth.signInWithPassword({
  email: config.email,
  password: config.password,
});
if (signInError) throw signInError;

if (process.argv.includes("--once")) {
  const processed = await processNextJob(config, supabase);
  console.log(processed ? "Inspection queue pass completed." : "No inspection job was ready.");
} else {
  console.log(
    `Local inspection agent is watching for ${CAPABILITY} with ${config.ollamaModel}.`
  );
  while (true) {
    await processNextJob(config, supabase);
    await new Promise((resolve) =>
      setTimeout(resolve, config.pollSeconds * 1000)
    );
  }
}

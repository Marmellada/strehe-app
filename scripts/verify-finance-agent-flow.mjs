import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

function readEnv(filePath) {
  const values = new Map();
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

const localRoot = path.resolve(
  process.argv[2] || "../strehe-finance-local"
);
const appEnv = readEnv(path.resolve(".env.local"));
const admin = createClient(
  appEnv.get("NEXT_PUBLIC_SUPABASE_URL"),
  appEnv.get("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const [{ data: space, error: spaceError }, { data: requester, error: userError }] =
  await Promise.all([
    admin.from("household_spaces").select("id").eq("is_active", true).limit(1).single(),
    admin
      .from("app_users")
      .select("id")
      .eq("role", "admin")
      .eq("is_active", true)
      .limit(1)
      .single(),
  ]);
if (spaceError) throw spaceError;
if (userError) throw userError;

const { data: agent, error: agentError } = await admin
  .from("agent_principals")
  .select("id")
  .eq("agent_key", "finance.local")
  .single();
if (agentError) throw agentError;

const python = path.join(localRoot, ".venv", "Scripts", "python.exe");
const jobIds = [];
const localPlanIds = [];
const localReceiptInputIds = [];
const stagedArtifactPaths = [];
try {
  const jobsToCreate = [
    {
      job_type: "finance.report.generate",
      required_capability: "finance.report.generate",
      payload: { month: "2026-06", verification: true },
    },
    {
      job_type: "finance.plan.propose",
      required_capability: "finance.plan.propose",
      payload: {
        month: "2026-07",
        name: "Queue verification plan",
        expected_income_cents: 250000,
        essential_budget_cents: 120000,
        flexible_budget_cents: 40000,
        savings_target_cents: 30000,
        rationale: "Verify the local planner capability.",
        verification: true,
      },
    },
    {
      job_type: "finance.receipt.ingest",
      required_capability: "finance.receipt.ingest",
      payload: {
        schema_version: 1,
        original_filename: "verification-receipt.png",
        mime_type: "image/png",
        source_note: "Temporary end-to-end verification receipt.",
        temporary_upload: true,
        verification: true,
      },
    },
  ];

  const { data: jobs, error: jobError } = await admin
    .from("agent_jobs")
    .insert(
      jobsToCreate.map((job, index) => ({
        ...job,
        workspace_type: "household",
        household_space_id: space.id,
        requested_by_user_id: requester.id,
        assigned_agent_id: agent.id,
        status: "queued",
        priority: index + 1,
        requires_review: job.job_type !== "finance.receipt.ingest",
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }))
    )
    .select("id, job_type");
  if (jobError) throw jobError;
  jobIds.push(...jobs.map((job) => job.id));

  const receiptJob = jobs.find(
    (job) => job.job_type === "finance.receipt.ingest"
  );
  if (!receiptJob) {
    throw new Error("Receipt verification job was not created.");
  }

  const receiptSvg = `
    <svg width="1200" height="1600" xmlns="http://www.w3.org/2000/svg">
      <rect width="1200" height="1600" fill="white"/>
      <g fill="black" font-family="Arial, sans-serif" font-size="78">
        <text x="100" y="180">ALBI MARKET</text>
        <text x="100" y="340">KUPON FISKAL</text>
        <text x="100" y="500">14-06-2026 12:30:00</text>
        <text x="100" y="760">TOTALI NE EURO 12,20</text>
        <text x="100" y="920">CASH 12,20</text>
        <text x="100" y="1200">VERIFICATION ONLY</text>
      </g>
    </svg>
  `;
  const receiptBuffer = await sharp(Buffer.from(receiptSvg))
    .png()
    .toBuffer();
  const receiptStoragePath =
    `${agent.id}/${receiptJob.id}/input/receipt.png`;
  const { error: receiptUploadError } = await admin.storage
    .from("agent-artifacts")
    .upload(receiptStoragePath, receiptBuffer, {
      contentType: "image/png",
      upsert: false,
    });
  if (receiptUploadError) throw receiptUploadError;
  stagedArtifactPaths.push(receiptStoragePath);

  const { error: receiptArtifactError } = await admin
    .from("agent_artifacts")
    .insert({
      job_id: receiptJob.id,
      artifact_kind: "input",
      storage_bucket: "agent-artifacts",
      storage_path: receiptStoragePath,
      mime_type: "image/png",
      byte_size: receiptBuffer.byteLength,
      metadata: {
        original_filename: "verification-receipt.png",
        temporary_transport: true,
      },
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
  if (receiptArtifactError) throw receiptArtifactError;

  for (const job of jobsToCreate) {
    const worker = spawnSync(python, ["-m", "src.main", "--cloud-once"], {
      cwd: localRoot,
      encoding: "utf8",
    });
    if (worker.status !== 0) {
      throw new Error(
        worker.stderr || worker.stdout || `Local worker failed for ${job.job_type}.`
      );
    }
  }

  const { data: completedJobs, error: completedError } = await admin
    .from("agent_jobs")
    .select("id, job_type, status, result")
    .in("id", jobIds);
  if (completedError) throw completedError;

  for (const completed of completedJobs) {
    const expectedStatus =
      completed.job_type === "finance.receipt.ingest"
        ? "completed"
        : "awaiting_review";
    if (completed.status !== expectedStatus) {
      throw new Error(
        `Unexpected ${completed.job_type} status: ${completed.status}`
      );
    }
    const result = completed.result || {};
    if (completed.job_type === "finance.receipt.ingest") {
      const serialized = JSON.stringify(result).toLowerCase();
      if (
        result.receipt_type !== "local_expense_ingest" ||
        result.processing_status !== "saved_for_review" ||
        result.local_expense_created !== true ||
        result.privacy?.temporary_transport_only !== true ||
        result.privacy?.temporary_artifact_deleted !== true ||
        result.privacy?.raw_receipt_returned !== false ||
        result.privacy?.ocr_text_returned !== false ||
        result.privacy?.financial_details_returned !== false ||
        result.quality?.status !== "passed" ||
        typeof result.local_input_id !== "string" ||
        serialized.includes("albi shopping") ||
        serialized.includes("12.2") ||
        serialized.includes("structured_extraction")
      ) {
        throw new Error("Receipt privacy or local-save verification failed.");
      }
      localReceiptInputIds.push(result.local_input_id);
      continue;
    }

    if (
      result.account_balances ||
      result.transactions ||
      result.privacy?.raw_transactions_uploaded !== false ||
      result.privacy?.account_details_uploaded !== false ||
      result.privacy?.receipt_data_uploaded !== false
    ) {
      throw new Error(
        `${completed.job_type} privacy boundary verification failed.`
      );
    }
    if (
      result.quality?.status !== "passed" ||
      result.quality?.human_review_required !== true
    ) {
      throw new Error(`${completed.job_type} quality verification failed.`);
    }
    if (
      completed.job_type === "finance.plan.propose" &&
      typeof result.local_plan_id === "string"
    ) {
      localPlanIds.push(result.local_plan_id);
    }
  }

  const planJob = completedJobs.find(
    (job) => job.job_type === "finance.plan.propose"
  );
  if (!planJob || localPlanIds.length !== 1) {
    throw new Error("Planner verification did not return one local plan.");
  }

  const reviewedAt = new Date().toISOString();
  const { error: reviewError } = await admin
    .from("agent_jobs")
    .update({
      status: "completed",
      review_decision: "approved",
      reviewed_at: reviewedAt,
      completed_at: reviewedAt,
    })
    .eq("id", planJob.id);
  if (reviewError) throw reviewError;

  const sync = spawnSync(
    python,
    [
      "-c",
      [
        "import sys",
        "from src.cloud_worker import CloudFinanceWorker",
        "from src.config import settings",
        "worker = CloudFinanceWorker(settings)",
        "worker.sync_reviewed_plans()",
        'print(worker.database.get_plan(sys.argv[1])["status"])',
      ].join("\n"),
      localPlanIds[0],
    ],
    {
      cwd: localRoot,
      encoding: "utf8",
    }
  );
  if (
    sync.status !== 0 ||
    sync.stdout.trim().split(/\r?\n/).at(-1) !== "approved"
  ) {
    throw new Error(
      sync.stderr || sync.stdout || "Approved plan did not sync locally."
    );
  }

  console.log(
    "Real queue verification passed for receipt, report, and plan."
  );
  console.log(
    "Verified bounded quality checks and aggregate-only results with no raw finance records."
  );
  console.log(
    "Verified temporary receipt upload -> local OCR/Ollama -> local draft -> cloud artifact deletion."
  );
  console.log("Verified approved plan review synchronized back to the local PC.");
} finally {
  if (stagedArtifactPaths.length > 0) {
    await admin.storage
      .from("agent-artifacts")
      .remove(stagedArtifactPaths);
  }
  if (jobIds.length > 0) {
    await admin.from("agent_jobs").delete().in("id", jobIds);
  }
  if (localPlanIds.length > 0) {
    const cleanup = spawnSync(
      python,
      [
        "-c",
        [
          "import sys",
          "from src.config import settings",
          "from src.db import ExpenseDatabase",
          "database = ExpenseDatabase(settings.database_path)",
          "database.initialize()",
          "with database.connect() as connection:",
          "    connection.executemany(",
          '        "DELETE FROM finance_plans WHERE id = ?",',
          "        [(plan_id,) for plan_id in sys.argv[1:]],",
          "    )",
        ].join("\n"),
        ...localPlanIds,
      ],
      {
        cwd: localRoot,
        encoding: "utf8",
      }
    );
    if (cleanup.status !== 0) {
      console.warn(
        cleanup.stderr || cleanup.stdout || "Local verification plan cleanup failed."
      );
    }
  }
  if (localReceiptInputIds.length > 0) {
    const cleanup = spawnSync(
      python,
      [
        "-c",
        [
          "import shutil",
          "import sys",
          "from src.config import settings",
          "from src.db import ExpenseDatabase",
          "database = ExpenseDatabase(settings.database_path)",
          "database.initialize()",
          "with database.connect() as connection:",
          "    for input_id in sys.argv[1:]:",
          '        connection.execute("DELETE FROM private_expenses WHERE input_id = ?", (input_id,))',
          '        connection.execute("DELETE FROM agent_work_items WHERE source_id = ?", (input_id,))',
          '        connection.execute("DELETE FROM private_expense_inputs WHERE id = ?", (input_id,))',
          "        shutil.rmtree(settings.files_dir / input_id, ignore_errors=True)",
        ].join("\n"),
        ...localReceiptInputIds,
      ],
      {
        cwd: localRoot,
        encoding: "utf8",
      }
    );
    if (cleanup.status !== 0) {
      console.warn(
        cleanup.stderr ||
          cleanup.stdout ||
          "Local verification receipt cleanup failed."
      );
    }
  }
}

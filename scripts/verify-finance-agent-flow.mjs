import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

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
        requires_review: true,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }))
    )
    .select("id, job_type");
  if (jobError) throw jobError;
  jobIds.push(...jobs.map((job) => job.id));

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
    if (completed.status !== "awaiting_review") {
      throw new Error(
        `Unexpected ${completed.job_type} status: ${completed.status}`
      );
    }
    const result = completed.result || {};
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
    "Real queue verification passed for report and plan: queued -> local -> awaiting_review."
  );
  console.log(
    "Verified bounded quality checks and aggregate-only results with no raw finance records."
  );
  console.log("Verified approved plan review synchronized back to the local PC.");
} finally {
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
}

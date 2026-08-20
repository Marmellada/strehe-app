import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { readEnv } from "./lib/env.mjs";

// Resumability proof: run a baseline session, simulate interruption, re-run, and
// assert idempotent task creation, resume-at-pending, and no map duplication.

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
}

const sourceEnv = readEnv("D:/Personal/Projects/Strehe-Prona/strehe-app/.env.local");
const url = sourceEnv.get("NEXT_PUBLIC_SUPABASE_URL") || sourceEnv.get("SUPABASE_URL");
const sr = sourceEnv.get("SUPABASE_SERVICE_ROLE_KEY");
const admin = createClient(url, sr, { auth: { autoRefreshToken: false, persistSession: false } });

const agent = (await admin.from("agent_principals").select("id").eq("agent_key", "engineering.local").single()).data;
const requester = (await admin.from("app_users").select("id").eq("role", "admin").eq("is_active", true).limit(1).single()).data;

const COMMIT = "4624e546223c13359b926c3286b47d0d1ebc1fed";
const SESSION = "ENGINEERING-BASELINE-PROOF";
const DB = "D:/Personal/Projects/Strehe-Prona/STREHE-ENGINEERING-RUNTIME/state/engineering.sqlite3";

function enqueue(sessionId) {
  return admin.from("agent_jobs").insert({
    job_type: "engineering.baseline",
    required_capability: "engineering.local",
    workspace_type: "system",
    subject_type: "verification",
    requested_by_user_id: requester.id,
    assigned_agent_id: agent.id,
    status: "queued",
    priority: 1,
    payload: { type: "baseline", session_id: sessionId, commit_sha: COMMIT },
    requires_review: true,
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  }).select("id").single();
}

function runWorker() {
  return spawnSync(process.execPath, ["scripts/gmk-agent-worker/worker.mjs", "--agent", "engineering", "--once"], {
    cwd: process.cwd(), encoding: "utf8", timeout: 300000,
  });
}

// ---- Run 1: full baseline ----
const job1 = await enqueue(SESSION);
if (job1.error) { console.error("enqueue failed:", job1.error.message); process.exit(2); }
const w1 = runWorker();
check("baseline worker exit 0", w1.status === 0, w1.status === 0 ? "" : (w1.stderr || w1.stdout).slice(-300));

const db = new DatabaseSync(DB);
const modules = db.prepare("select count(*) n from modules").get().n;
const flows = db.prepare("select count(*) n from critical_flows").get().n;
const deps = db.prepare("select count(*) n from module_dependencies").get().n;
const tests = db.prepare("select count(*) n from test_catalog").get().n;
const tasks = db.prepare("select count(*) n from review_tasks where session_id=?").get(SESSION).n;
const tasksDone = db.prepare("select count(*) n from review_tasks where session_id=? and status='done'").get(SESSION).n;
const evidence = db.prepare("select count(*) n from review_evidence").get().n;

check("modules populated", modules >= 20, `${modules} modules`);
check("flows populated", flows >= 4, `${flows} flows`);
check("deps populated", deps >= 15, `${deps} deps`);
check("test catalog populated", tests >= 5, `${tests} tests`);
check("multiple tasks created", tasks >= 5, `${tasks} tasks`);
check("all tasks done (run 1)", tasks === tasksDone, `${tasksDone}/${tasks} done`);
check("evidence persisted", evidence >= tasks, `${evidence} evidence rows`);

// ---- Simulate interruption: reset last task to pending, session to running ----
db.prepare("update review_tasks set status='pending' where id=(select max(id) from review_tasks where session_id=?)").run(SESSION);
db.prepare("update review_sessions set status='running' where id=?").run(SESSION);
check("interruption simulated (1 task reset to pending)", true);

// ---- Run 2: resume ----
await enqueue(SESSION);
const w2 = runWorker();
check("resume worker exit 0", w2.status === 0, w2.status === 0 ? "" : (w2.stderr || w2.stdout).slice(-300));

const tasksAfter = db.prepare("select count(*) n from review_tasks where session_id=?").get(SESSION).n;
const tasksDoneAfter = db.prepare("select count(*) n from review_tasks where session_id=? and status='done'").get(SESSION).n;
const modulesAfter = db.prepare("select count(*) n from modules").get().n;
const flowsAfter = db.prepare("select count(*) n from critical_flows").get().n;
const commitState = db.prepare("select value from runtime_state where key='last_mapped_commit'").get()?.value;

check("no task duplication on resume", tasksAfter === tasks, `${tasks} -> ${tasksAfter}`);
check("resumed to completion", tasksDoneAfter === tasksAfter, `${tasksDoneAfter}/${tasksAfter} done`);
check("no module duplication", modulesAfter === modules, `${modules} -> ${modulesAfter}`);
check("no flow duplication", flowsAfter === flows, `${flows} -> ${flowsAfter}`);
check("commit preserved", commitState === COMMIT, commitState || "(missing)");
db.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
process.exit(failed.length === 0 ? 0 : 1);

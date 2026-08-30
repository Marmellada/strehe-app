import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import inboxSpec from "./agents/inbox.spec.mjs";
import { readEnv } from "./lib/env.mjs";
import {
  assertControlledHarnessSource,
  assertNoActiveRuntimeWork,
  assertOperatorPauseState,
  GO_RESET_TASK_NAME,
  inspectGoRoute,
  inspectOpenCodeBudget,
} from "./lib/go-ready.mjs";
import { inspectCapabilityState } from "./lib/overnight.mjs";
import { loadRouterConfig, ROUTER_CONFIG_FILENAMES } from "./lib/router/config.mjs";

function parseArgs(argv) {
  const result = { operatorPauseState: null, expectedBranch: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--runtime-root") result.runtimeRoot = argv[++index];
    else if (arg === "--worktree") result.worktree = argv[++index];
    else if (arg === "--fixture") result.fixture = argv[++index];
    else if (arg === "--expected-branch") result.expectedBranch = argv[++index];
    else if (arg === "--operator-pause-state") result.operatorPauseState = argv[++index];
    else throw new Error(`unknown_argument (${arg})`);
  }
  return result;
}

function git(worktree, args) {
  return execFileSync("git", ["-C", worktree, ...args], {
    encoding: "utf8", timeout: 30_000, windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function inspectRepository(worktree, expectedBranch) {
  const topLevel = path.resolve(git(worktree, ["rev-parse", "--show-toplevel"]));
  if (topLevel.toLowerCase() !== path.resolve(worktree).toLowerCase()) throw new Error("unexpected_worktree_path");
  const branch = git(worktree, ["branch", "--show-current"]);
  if (!branch || (expectedBranch && branch !== expectedBranch)) {
    throw new Error(`unexpected_branch (${branch || "detached"})`);
  }
  const status = git(worktree, ["status", "--porcelain=v1", "--untracked-files=all"]);
  if (status) throw new Error("worktree_dirty");
  return { branch, commit: git(worktree, ["rev-parse", "HEAD"]), clean: true };
}

function powershellJson(script) {
  const output = execFileSync("powershell.exe", [
    "-NoProfile", "-NonInteractive", "-Command", script,
  ], {
    encoding: "utf8", timeout: 15_000, windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  return output ? JSON.parse(output) : null;
}

function inspectWindowsDormancy() {
  if (process.platform !== "win32") throw new Error("windows_task_state_unavailable");
  const taskName = GO_RESET_TASK_NAME.replace(/'/g, "''");
  const task = powershellJson(`$t=Get-ScheduledTask -TaskName '${taskName}' -ErrorAction Stop; [pscustomobject]@{State=[string]$t.State;Enabled=[bool]$t.Settings.Enabled}|ConvertTo-Json -Compress`);
  if (!task || task.State !== "Disabled" || task.Enabled !== false) {
    throw new Error(`engineering_task_not_disabled (${task?.State || "unknown"})`);
  }
  const processes = powershellJson("$p=@(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'scripts[\\\\/]gmk-agent-worker[\\\\/](worker|coordinator)\\.mjs' } | Select-Object ProcessId,Name,CommandLine); ConvertTo-Json -Compress -InputObject $p");
  const processCount = Array.isArray(processes) ? processes.length : processes ? 1 : 0;
  if (processCount > 0) throw new Error(`active_engineering_runtime_processes (${processCount})`);
  return { task_state: task.State, task_enabled: task.Enabled, runtime_processes: 0 };
}

function assertFiles(runtimeRoot) {
  for (const name of Object.values(ROUTER_CONFIG_FILENAMES)) {
    const file = path.join(runtimeRoot, "config", name);
    if (!fs.statSync(file, { throwIfNoEntry: false })?.isFile()) throw new Error(`router_config_missing (${name})`);
  }
}

function runDeterministicTests(worktree) {
  const testFiles = [
    "scripts/gmk-agent-worker/test-proactive.mjs",
    "scripts/gmk-agent-worker/test-router.mjs",
    "scripts/gmk-agent-worker/test-router-p3.mjs",
    "scripts/gmk-agent-worker/test-router-p4.mjs",
    "scripts/gmk-agent-worker/test-router-p5.mjs",
    "scripts/gmk-agent-worker/test-router-p6.mjs",
    "scripts/gmk-agent-worker/test-go-ready.mjs",
  ];
  const result = spawnSync(process.execPath, ["--test", ...testFiles], {
    cwd: worktree, encoding: "utf8", timeout: 10 * 60_000, windowsHide: true,
    env: { ...process.env, NO_PROXY: "*", HTTP_PROXY: "http://127.0.0.1:9", HTTPS_PROXY: "http://127.0.0.1:9" },
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    const detail = result.error?.code || result.signal || result.status || "none";
    throw new Error(`deterministic_tests_failed (exit=${detail})`);
  }
  return { command: `node --test ${testFiles.join(" ")}`, passed: true };
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const worktree = path.resolve(args.worktree || process.cwd());
    const runtimeRoot = path.resolve(args.runtimeRoot || path.join(worktree, "..", ".."));
    const fixturePath = path.resolve(worktree, args.fixture || "tests/fixtures/inbox/k-english-inquiry.json");
    const evidence = {};
    evidence.repository = inspectRepository(worktree, args.expectedBranch);
    evidence.windows = inspectWindowsDormancy();
    evidence.operator = assertOperatorPauseState(args.operatorPauseState);
    assertFiles(runtimeRoot);
    const routerConfig = loadRouterConfig(runtimeRoot);
    const routerEnv = readEnv(path.join(runtimeRoot, ".env.gmk-router.local"));
    if (!String(routerEnv.get("OPENCODE_GO_API_KEY") || routerEnv.get("OPENCODE_API_KEY") || "").trim()) {
      throw new Error("opencode_go_secret_missing");
    }
    evidence.configuration = { valid: true, opencode_secret_present: true };
    evidence.capabilities = inspectCapabilityState(process.env, {
      inboxTools: inboxSpec.tools,
      inboxJobTypes: inboxSpec.jobTypes,
    });
    if (evidence.capabilities.allowed !== true) throw new Error(evidence.capabilities.reason || "capability_state_blocked");
    evidence.harness = assertControlledHarnessSource(worktree);
    const dbPath = path.join(runtimeRoot, "state", "engineering.sqlite3");
    const db = new DatabaseSync(dbPath, { readOnly: true });
    try {
      if (db.prepare("PRAGMA quick_check").get()?.quick_check !== "ok") throw new Error("sqlite_quick_check_failed");
      evidence.runtime = assertNoActiveRuntimeWork(db);
      const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
      evidence.route = inspectGoRoute(db, routerConfig, fixture).route;
      evidence.budget = inspectOpenCodeBudget(db, routerConfig.budget);
    } finally {
      db.close();
    }
    evidence.tests = runDeterministicTests(worktree);
    process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
    process.stdout.write("READY_FOR_GO_RESET_TEST\n");
  } catch (error) {
    const reason = String(error?.message || error).replace(/[\r\n]+/g, " ").slice(0, 500);
    process.stdout.write(`BLOCKED: ${reason}\n`);
    process.exitCode = 2;
  }
}

await main();

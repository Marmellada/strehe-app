import { execFile, execFileSync, spawn } from "node:child_process";

export const DEFAULT_CONCURRENCY_LIMITS = Object.freeze({
  maxHeavyJobs: 1,
  maxLightJobs: 2,
  maxTotalAgents: 2,
  maxCodexProcesses: 1,
});

export const DEFAULT_EXECUTION_LIMITS = Object.freeze({
  heavy: { wallClockMs: 45 * 60 * 1000, llmCallCeiling: 60 },
  light: { wallClockMs: 15 * 60 * 1000, llmCallCeiling: 25 },
  codex: { wallClockMs: 30 * 60 * 1000, llmCallCeiling: null },
});

export const RESERVATION_STARTUP_GRACE_MS = 10_000;
export const WATCHDOG_SETTLEMENT_GRACE_MS = 5_000;

function positivePid(value) {
  const pid = Number(value);
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

function parseProcessRows(output) {
  const parsed = JSON.parse(String(output || "[]"));
  return (Array.isArray(parsed) ? parsed : [parsed]).map((row) => ({
    pid: Number(row.ProcessId ?? row.pid),
    parentPid: Number(row.ParentProcessId ?? row.parentPid),
  })).filter((row) => positivePid(row.pid));
}

function treeContainsLiveProcess(rows, rootPid) {
  const descendants = new Set([rootPid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of rows) {
      if (descendants.has(row.parentPid) && !descendants.has(row.pid)) {
        descendants.add(row.pid);
        changed = true;
      }
    }
  }
  return rows.some((row) => descendants.has(row.pid));
}

export function probeProcessTreeLiveness(rootPid, {
  platform = process.platform,
  execFileSyncImpl = execFileSync,
  killImpl = process.kill,
} = {}) {
  const pid = positivePid(rootPid);
  if (!pid) return "unknown";
  try {
    if (platform === "win32") {
      const script = "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId | ConvertTo-Json -Compress";
      const output = execFileSyncImpl("powershell.exe", [
        "-NoProfile", "-NonInteractive", "-Command", script,
      ], {
        encoding: "utf8",
        timeout: 10_000,
        windowsHide: true,
        maxBuffer: 4 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      });
      return treeContainsLiveProcess(parseProcessRows(output), pid) ? "alive" : "dead";
    }
    try {
      killImpl(pid, 0);
      return "alive";
    } catch (error) {
      if (error?.code === "ESRCH") return "dead";
      if (error?.code === "EPERM") return "alive";
      return "unknown";
    }
  } catch {
    return "unknown";
  }
}

function reconcileReservations(db, {
  now,
  startupGraceMs,
  probeLiveness,
}) {
  const rows = db.prepare(
    `SELECT job_id, owner_pid, worker_pid, reserved_at, deadline_at
     FROM coordinator_reservations`,
  ).all();
  const reclaimed = [];
  for (const row of rows) {
    if (positivePid(row.worker_pid)) {
      if (probeLiveness(row.worker_pid) !== "dead") continue;
      db.prepare("DELETE FROM coordinator_reservations WHERE job_id = ? AND worker_pid = ?")
        .run(row.job_id, row.worker_pid);
      reclaimed.push(row.job_id);
      continue;
    }
    const ageMs = now.getTime() - new Date(row.reserved_at).getTime();
    if (!Number.isFinite(ageMs) || ageMs < startupGraceMs) continue;
    if (probeLiveness(row.owner_pid) !== "dead") continue;
    db.prepare("DELETE FROM coordinator_reservations WHERE job_id = ? AND worker_pid IS NULL")
      .run(row.job_id);
    reclaimed.push(row.job_id);
  }
  return reclaimed;
}

export function reserveExecution(db, {
  jobId,
  resourceClass,
  provider,
  processKind = "worker",
  deadlineAt,
  ownerPid = process.pid,
  now = new Date(),
  limits = DEFAULT_CONCURRENCY_LIMITS,
  startupGraceMs = RESERVATION_STARTUP_GRACE_MS,
  probeLiveness = (pid) => probeProcessTreeLiveness(pid),
}) {
  try {
    if (!["heavy", "light"].includes(resourceClass)) throw new Error(`invalid resource class: ${resourceClass}`);
    if (!jobId || !deadlineAt) throw new Error("reservation requires jobId and deadlineAt");
    if (!positivePid(ownerPid)) throw new Error("reservation requires a valid owner PID");
    db.exec("BEGIN IMMEDIATE");
    try {
      const reclaimed = reconcileReservations(db, { now, startupGraceMs, probeLiveness });
      const rows = db.prepare("SELECT resource_class, process_kind FROM coordinator_reservations").all();
      const heavy = rows.filter((row) => row.resource_class === "heavy").length;
      const light = rows.filter((row) => row.resource_class === "light").length;
      const codex = rows.filter((row) => row.process_kind === "codex").length;
      let reason = null;
      if (rows.length >= limits.maxTotalAgents) reason = "concurrency_total_limit";
      else if (resourceClass === "heavy" && heavy >= limits.maxHeavyJobs) reason = "concurrency_heavy_limit";
      else if (resourceClass === "light" && light >= limits.maxLightJobs) reason = "concurrency_light_limit";
      else if (processKind === "codex" && codex >= limits.maxCodexProcesses) reason = "concurrency_codex_limit";
      if (reason) {
        db.exec("COMMIT");
        return { allowed: false, reason, counts: { heavy, light, total: rows.length, codex }, reclaimed };
      }
      db.prepare(
        `INSERT INTO coordinator_reservations
          (job_id, resource_class, provider, process_kind, owner_pid, reserved_at, deadline_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(String(jobId), resourceClass, String(provider), processKind, ownerPid, now.toISOString(), deadlineAt);
      db.exec("COMMIT");
      return {
        allowed: true,
        reason: "concurrency_reserved",
        counts: { heavy, light, total: rows.length, codex },
        reclaimed,
      };
    } catch (error) {
      try { db.exec("ROLLBACK"); } catch {}
      throw error;
    }
  } catch (error) {
    return {
      allowed: false,
      reason: "concurrency_state_unavailable",
      error: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
    };
  }
}

export function bindReservationWorker(db, {
  jobId,
  workerPid = process.pid,
  boundAt = new Date(),
}) {
  try {
    const pid = positivePid(workerPid);
    if (!jobId || !pid) throw new Error("worker binding requires jobId and a valid worker PID");
    const info = db.prepare(
      `UPDATE coordinator_reservations
       SET worker_pid = ?, worker_bound_at = ?
       WHERE job_id = ? AND (worker_pid IS NULL OR worker_pid = ?)`,
    ).run(pid, boundAt.toISOString(), String(jobId), pid);
    if (Number(info.changes) !== 1) throw new Error(`reservation unavailable for worker binding: ${jobId}`);
    return { allowed: true, reason: "worker_pid_bound", workerPid: pid };
  } catch (error) {
    return {
      allowed: false,
      reason: "worker_pid_binding_failed",
      error: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
    };
  }
}

export function releaseExecution(db, jobId, {
  allowUnbound = false,
  processTreeGoneConfirmed = false,
  probeLiveness = (pid) => probeProcessTreeLiveness(pid),
} = {}) {
  try {
    const row = db.prepare(
      "SELECT worker_pid FROM coordinator_reservations WHERE job_id = ?",
    ).get(String(jobId));
    if (!row) return true;
    if (!positivePid(row.worker_pid)) {
      if (!allowUnbound) return false;
    } else if (!processTreeGoneConfirmed && probeLiveness(row.worker_pid) !== "dead") {
      return false;
    }
    db.prepare("DELETE FROM coordinator_reservations WHERE job_id = ?").run(String(jobId));
    return true;
  } catch {
    return false;
  }
}

export function releaseExecutionAfterResult(db, jobId, processResult, options = {}) {
  if (processResult?.processMayBeAlive === true) return false;
  return releaseExecution(db, jobId, {
    ...options,
    allowUnbound: true,
    processTreeGoneConfirmed: processResult?.terminationConfirmed === true,
  });
}

export function createCountingLlm(adapter, maxCalls) {
  if (!Number.isInteger(maxCalls) || maxCalls < 1) return adapter;
  let calls = 0;
  return {
    ...adapter,
    setContext(context) { adapter.setContext?.(context); },
    async chat(input) {
      calls += 1;
      if (calls > maxCalls) {
        const error = new Error(`LLM call ceiling exceeded (${maxCalls})`);
        error.code = "iteration_limit_exceeded";
        throw error;
      }
      return adapter.chat(input);
    },
    get callCount() { return calls; },
  };
}

function execFileText(command, args, execFileImpl = execFile) {
  return new Promise((resolve, reject) => {
    execFileImpl(command, args, {
      encoding: "utf8",
      timeout: 10000,
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
    }, (error, stdout) => error ? reject(error) : resolve(String(stdout || "")));
  });
}

async function windowsDescendantPids(rootPid, execFileImpl) {
  const script = "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId | ConvertTo-Json -Compress";
  const output = await execFileText("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], execFileImpl);
  const rows = parseProcessRows(output);
  const descendants = [];
  const parents = [Number(rootPid)];
  for (let index = 0; index < parents.length; index += 1) {
    for (const row of rows) {
      if (row.parentPid === parents[index] && !descendants.includes(row.pid)) {
        descendants.push(row.pid);
        parents.push(row.pid);
      }
    }
  }
  return descendants.reverse();
}

export async function terminateProcessTree(child, {
  platform = process.platform,
  spawnImpl = spawn,
  execFileImpl = execFile,
  killPid = process.kill,
  probeLiveness = (pid) => probeProcessTreeLiveness(pid),
} = {}) {
  if (!child?.pid) return false;
  if (platform !== "win32") {
    try { child.kill("SIGTERM"); } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
    return probeLiveness(child.pid) === "dead";
  }
  let descendants = [];
  try { descendants = await windowsDescendantPids(child.pid, execFileImpl); } catch {}
  const taskkillConfirmed = await new Promise((resolve) => {
    const killer = spawnImpl("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
      shell: false,
      windowsHide: true,
      stdio: "ignore",
    });
    killer.unref?.();
    const fallback = setTimeout(() => resolve(false), 2000);
    fallback.unref?.();
    killer.on("error", () => { clearTimeout(fallback); resolve(false); });
    killer.on("close", (code) => { clearTimeout(fallback); resolve(code === 0); });
  });
  if (taskkillConfirmed) return true;
  for (const pid of descendants) {
    try { killPid(pid); } catch {}
  }
  try { child.kill(); } catch {}
  return probeLiveness(child.pid) === "dead";
}

export function runBoundedProcess({
  command,
  args = [],
  options = {},
  timeoutMs,
  settlementGraceMs = WATCHDOG_SETTLEMENT_GRACE_MS,
  spawnImpl = spawn,
  terminateImpl = terminateProcessTree,
}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("timeoutMs must be positive");
  if (!Number.isFinite(settlementGraceMs) || settlementGraceMs <= 0) {
    throw new Error("settlementGraceMs must be positive");
  }
  return new Promise((resolve) => {
    const child = spawnImpl(command, args, options);
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    let closeResult = null;
    let terminationConfirmed = false;
    let terminationAttemptFinished = false;
    let settlementTimer = null;
    const append = (current, chunk) => (current + chunk.toString()).slice(-64 * 1024);
    child.stdout?.on("data", (chunk) => { stdout = append(stdout, chunk); });
    child.stderr?.on("data", (chunk) => { stderr = append(stderr, chunk); });
    let wallClockTimer = null;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(wallClockTimer);
      clearTimeout(settlementTimer);
      resolve({ ...result, timedOut, stdout, stderr, pid: child.pid ?? null });
    };
    const finishTimedOutIfReady = () => {
      if (!closeResult || !terminationAttemptFinished) return;
      finish({
        ...closeResult,
        ok: false,
        terminationConfirmed,
        processMayBeAlive: !terminationConfirmed,
      });
    };
    child.on("error", (error) => {
      const result = { ok: false, code: null, signal: null, error };
      if (!timedOut) finish(result);
      else { closeResult = result; finishTimedOutIfReady(); }
    });
    child.on("close", (code, signal) => {
      const result = { ok: !timedOut && code === 0, code, signal };
      if (!timedOut) finish(result);
      else { closeResult = result; finishTimedOutIfReady(); }
    });
    wallClockTimer = setTimeout(() => {
      timedOut = true;
      settlementTimer = setTimeout(() => finish({
        ok: false,
        code: closeResult?.code ?? null,
        signal: closeResult?.signal ?? null,
        error: closeResult?.error,
        terminationConfirmed,
        processMayBeAlive: !terminationConfirmed,
      }), settlementGraceMs);
      settlementTimer.unref?.();
      Promise.resolve()
        .then(() => terminateImpl(child))
        .then((confirmed) => { terminationConfirmed = confirmed === true; })
        .catch(() => { terminationConfirmed = false; })
        .finally(() => {
          terminationAttemptFinished = true;
          finishTimedOutIfReady();
        });
    }, timeoutMs);
    wallClockTimer.unref?.();
  });
}

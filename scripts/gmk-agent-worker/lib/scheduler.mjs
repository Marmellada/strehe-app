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

export async function reconcileOrphanedCodexReservations(db, {
  getJobLeaseState,
  now = new Date(),
  probeLiveness = (pid) => probeProcessTreeLiveness(pid),
  terminateImpl = (child) => terminateProcessTree(child),
} = {}) {
  const rows = db.prepare(
    `SELECT job_id, owner_pid, worker_pid
     FROM coordinator_reservations
     WHERE process_kind = 'codex' AND worker_pid IS NOT NULL`,
  ).all();
  const evidence = [];
  for (const row of rows) {
    const ownerState = probeLiveness(row.owner_pid);
    const workerState = probeLiveness(row.worker_pid);
    if (ownerState !== "dead" || workerState !== "alive") continue;
    let leaseState;
    try {
      leaseState = await getJobLeaseState?.(row.job_id);
    } catch (error) {
      evidence.push({
        jobId: row.job_id, workerPid: row.worker_pid, action: "retained",
        reason: "lease_state_unknown", error: String(error?.message || error).slice(0, 500),
      });
      continue;
    }
    const leaseExpiresAt = leaseState?.lease_expires_at ? new Date(leaseState.lease_expires_at) : null;
    const validLease = leaseState?.status === "running"
      && leaseExpiresAt != null
      && Number.isFinite(leaseExpiresAt.getTime())
      && leaseExpiresAt.getTime() > now.getTime();
    const invalidLease = leaseState != null && (
      leaseState.status !== "running"
      || leaseExpiresAt == null
      || (Number.isFinite(leaseExpiresAt.getTime()) && leaseExpiresAt.getTime() <= now.getTime())
    );
    if (validLease) {
      evidence.push({ jobId: row.job_id, workerPid: row.worker_pid, action: "retained", reason: "lease_valid" });
      continue;
    }
    if (!invalidLease) {
      evidence.push({ jobId: row.job_id, workerPid: row.worker_pid, action: "retained", reason: "lease_state_unknown" });
      continue;
    }
    let terminationRequested = false;
    try {
      terminationRequested = await terminateImpl({
        pid: row.worker_pid,
        kill(signal) { return process.kill(row.worker_pid, signal); },
      });
    } catch (error) {
      evidence.push({
        jobId: row.job_id, workerPid: row.worker_pid, action: "retained",
        reason: "orphan_termination_failed", error: String(error?.message || error).slice(0, 500),
      });
      continue;
    }
    if (terminationRequested !== true || probeLiveness(row.worker_pid) !== "dead") {
      evidence.push({
        jobId: row.job_id, workerPid: row.worker_pid, action: "retained",
        reason: "orphan_termination_unconfirmed",
      });
      continue;
    }
    const deleted = db.prepare(
      `DELETE FROM coordinator_reservations
       WHERE job_id = ? AND owner_pid = ? AND worker_pid = ? AND process_kind = 'codex'`,
    ).run(row.job_id, row.owner_pid, row.worker_pid);
    evidence.push({
      jobId: row.job_id, workerPid: row.worker_pid,
      action: Number(deleted.changes) === 1 ? "released" : "retained",
      reason: Number(deleted.changes) === 1 ? "orphan_termination_confirmed" : "reservation_changed",
    });
  }
  return evidence;
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
  idleTimeoutMs = null,
  input = null,
  maxOutputBytes = 64 * 1024,
  settlementGraceMs = WATCHDOG_SETTLEMENT_GRACE_MS,
  spawnImpl = spawn,
  terminateImpl = terminateProcessTree,
  onSpawn = null,
}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("timeoutMs must be positive");
  if (idleTimeoutMs != null && (!Number.isFinite(idleTimeoutMs) || idleTimeoutMs <= 0)) {
    throw new Error("idleTimeoutMs must be positive when provided");
  }
  if (!Number.isInteger(maxOutputBytes) || maxOutputBytes < 1024) {
    throw new Error("maxOutputBytes must be an integer of at least 1024");
  }
  if (!Number.isFinite(settlementGraceMs) || settlementGraceMs <= 0) {
    throw new Error("settlementGraceMs must be positive");
  }
  return new Promise((resolve) => {
    let child;
    try {
      child = spawnImpl(command, args, options);
    } catch (error) {
      resolve({
        ok: false, code: null, signal: null, error, timedOut: false,
        timeoutReason: null, terminationConfirmed: true, processMayBeAlive: false,
        stdout: "", stderr: "", stdoutHead: "", stderrHead: "",
        stdoutBytes: 0, stderrBytes: 0, pid: null,
      });
      return;
    }
    let stdout = "";
    let stderr = "";
    let stdoutHead = "";
    let stderrHead = "";
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let timedOut = false;
    let timeoutReason = null;
    let forcedError = null;
    let settled = false;
    let closeResult = null;
    let terminationConfirmed = false;
    let terminationAttemptFinished = false;
    let settlementTimer = null;
    let wallClockTimer = null;
    let idleTimer = null;
    const append = (current, chunk) => {
      const combined = Buffer.concat([Buffer.from(current, "utf8"), Buffer.from(chunk)]);
      return combined.subarray(Math.max(0, combined.length - maxOutputBytes)).toString("utf8");
    };
    const appendHead = (current, chunk) => {
      if (Buffer.byteLength(current, "utf8") >= 8 * 1024) return current;
      return Buffer.concat([Buffer.from(current, "utf8"), Buffer.from(chunk)])
        .subarray(0, 8 * 1024).toString("utf8");
    };
    const resetIdleTimer = () => {
      if (idleTimeoutMs == null || settled || timeoutReason) return;
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => beginTermination("idle_output_exceeded"), idleTimeoutMs);
      idleTimer.unref?.();
    };
    child.stdout?.on("data", (chunk) => {
      stdoutBytes += Buffer.byteLength(chunk);
      stdoutHead = appendHead(stdoutHead, chunk);
      stdout = append(stdout, chunk);
      resetIdleTimer();
    });
    child.stderr?.on("data", (chunk) => {
      stderrBytes += Buffer.byteLength(chunk);
      stderrHead = appendHead(stderrHead, chunk);
      stderr = append(stderr, chunk);
      resetIdleTimer();
    });
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(wallClockTimer);
      clearTimeout(idleTimer);
      clearTimeout(settlementTimer);
      resolve({
        terminationConfirmed: true,
        processMayBeAlive: false,
        ...result,
        timedOut,
        timeoutReason,
        stdout,
        stderr,
        stdoutHead,
        stderrHead,
        stdoutBytes,
        stderrBytes,
        pid: child.pid ?? null,
      });
    };
    const finishForcedIfReady = () => {
      if (!terminationAttemptFinished || (!closeResult && !terminationConfirmed)) return;
      finish({
        ...(closeResult || { code: null, signal: null }),
        ok: false,
        error: forcedError || closeResult?.error,
        terminationConfirmed,
        processMayBeAlive: !terminationConfirmed,
      });
    };
    child.on("error", (error) => {
      const result = { ok: false, code: null, signal: null, error };
      if (!timeoutReason && !forcedError) finish(result);
      else { closeResult = result; finishForcedIfReady(); }
    });
    child.on("close", (code, signal) => {
      const result = { ok: !timeoutReason && !forcedError && code === 0, code, signal };
      if (!timeoutReason && !forcedError) finish(result);
      else { closeResult = result; finishForcedIfReady(); }
    });
    const beginTermination = (reason, error = null) => {
      if (settled || timeoutReason || forcedError) return;
      if (reason === "wall_clock_exceeded" || reason === "idle_output_exceeded") {
        timedOut = true;
        timeoutReason = reason;
      } else {
        forcedError = error || new Error(reason);
      }
      settlementTimer = setTimeout(() => finish({
        ok: false,
        code: closeResult?.code ?? null,
        signal: closeResult?.signal ?? null,
        error: forcedError || closeResult?.error,
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
          finishForcedIfReady();
        });
    };
    try {
      const spawnResult = onSpawn?.(child);
      if (spawnResult === false || spawnResult?.allowed === false) {
        const error = new Error(spawnResult?.reason || "process spawn binding rejected");
        error.code = spawnResult?.reason || "process_spawn_rejected";
        beginTermination("startup_rejected", error);
        return;
      }
    } catch (error) {
      beginTermination("startup_rejected", error);
      return;
    }
    if (input != null) {
      child.stdin?.on("error", () => {});
      child.stdin?.end(input, "utf8");
    }
    wallClockTimer = setTimeout(() => beginTermination("wall_clock_exceeded"), timeoutMs);
    wallClockTimer.unref?.();
    resetIdleTimer();
  });
}

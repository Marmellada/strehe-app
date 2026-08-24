import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const GIB = 1024 ** 3;

export const DEFAULT_HEALTH_LIMITS = Object.freeze({
  heavyFreeMemoryBytes: 6 * GIB,
  lightFreeMemoryBytes: 3 * GIB,
  heavyCpuPercent: 75,
  freeDiskBytes: 2 * GIB,
  cpuSampleMs: 15000,
});

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cpuTotals(cpus) {
  if (!Array.isArray(cpus) || cpus.length === 0) throw new Error("CPU inventory is empty");
  return cpus.reduce((sum, cpu) => {
    const times = cpu?.times;
    if (!times) throw new Error("CPU timing data is unavailable");
    const total = Object.values(times).reduce((value, part) => value + Number(part || 0), 0);
    return { idle: sum.idle + Number(times.idle || 0), total: sum.total + total };
  }, { idle: 0, total: 0 });
}

export async function sampleCpuPercent({
  sampleMs = DEFAULT_HEALTH_LIMITS.cpuSampleMs,
  cpuReader = os.cpus,
  wait = delay,
} = {}) {
  const before = cpuTotals(cpuReader());
  await wait(sampleMs);
  const after = cpuTotals(cpuReader());
  const totalDelta = after.total - before.total;
  const idleDelta = after.idle - before.idle;
  if (!(totalDelta > 0) || idleDelta < 0) throw new Error("CPU timing sample did not advance");
  return Math.max(0, Math.min(100, ((totalDelta - idleDelta) / totalDelta) * 100));
}

function execFileText(command, args, execFileImpl = execFile) {
  return new Promise((resolve, reject) => {
    execFileImpl(command, args, {
      encoding: "utf8",
      timeout: 10000,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    }, (error, stdout) => error ? reject(error) : resolve(String(stdout || "")));
  });
}

export async function listProcessNames({ platform = process.platform, execFileImpl = execFile } = {}) {
  if (platform === "win32") {
    const output = await execFileText("tasklist.exe", ["/FO", "CSV", "/NH"], execFileImpl);
    return output.split(/\r?\n/).map((line) => line.match(/^"([^"]+)"/)?.[1]).filter(Boolean);
  }
  const output = await execFileText("ps", ["-A", "-o", "comm="], execFileImpl);
  return output.split(/\r?\n/).map((line) => path.basename(line.trim())).filter(Boolean);
}

export function sampleMemory() {
  const freeMemoryBytes = os.freemem();
  const totalMemoryBytes = os.totalmem();
  if (!(freeMemoryBytes >= 0) || !(totalMemoryBytes > 0)) throw new Error("physical memory sample is invalid");
  return { freeMemoryBytes, totalMemoryBytes };
}

export function sampleDisk(runtimeRoot) {
  const stateDir = path.join(runtimeRoot, "state");
  fs.mkdirSync(stateDir, { recursive: true });
  const stats = fs.statfsSync(stateDir);
  const freeDiskBytes = Number(stats.bavail) * Number(stats.bsize);
  if (!(freeDiskBytes >= 0)) throw new Error("disk free-space sample is invalid");
  return { freeDiskBytes };
}

export function assessHealthSample(sample, {
  resourceClass = "heavy",
  rejectLocalInference = false,
  limits = DEFAULT_HEALTH_LIMITS,
} = {}) {
  if (!["heavy", "light"].includes(resourceClass)) {
    return { allowed: false, reason: "health_resource_class_invalid", evidence: { resourceClass } };
  }
  const requiredMemory = resourceClass === "heavy"
    ? limits.heavyFreeMemoryBytes
    : limits.lightFreeMemoryBytes;
  if (sample.freeMemoryBytes < requiredMemory) {
    return {
      allowed: false,
      reason: "health_low_memory",
      evidence: { free_memory_bytes: sample.freeMemoryBytes, required_memory_bytes: requiredMemory },
    };
  }
  if (resourceClass === "heavy" && sample.cpuPercent >= limits.heavyCpuPercent) {
    return {
      allowed: false,
      reason: "health_high_cpu",
      evidence: { cpu_percent: sample.cpuPercent, required_below_percent: limits.heavyCpuPercent },
    };
  }
  if (sample.freeDiskBytes < limits.freeDiskBytes) {
    return {
      allowed: false,
      reason: "health_low_disk",
      evidence: { free_disk_bytes: sample.freeDiskBytes, required_disk_bytes: limits.freeDiskBytes },
    };
  }
  const activeInference = (sample.processNames || []).filter((name) => /^(ollama|llama-server)(\.exe)?$/i.test(name));
  if (rejectLocalInference && activeInference.length > 0) {
    return {
      allowed: false,
      reason: "health_ollama_active",
      evidence: { active_processes: activeInference },
    };
  }
  return {
    allowed: true,
    reason: "healthy",
    evidence: {
      free_memory_bytes: sample.freeMemoryBytes,
      total_memory_bytes: sample.totalMemoryBytes,
      cpu_percent: sample.cpuPercent,
      free_disk_bytes: sample.freeDiskBytes,
      local_inference_checked: rejectLocalInference,
    },
  };
}

export async function evaluateHealth({
  runtimeRoot,
  resourceClass = "heavy",
  rejectLocalInference = false,
  limits = DEFAULT_HEALTH_LIMITS,
  samplers = {},
} = {}) {
  try {
    const memory = await (samplers.memory || sampleMemory)();
    const cpuPercent = await (samplers.cpu || (() => sampleCpuPercent({ sampleMs: limits.cpuSampleMs })))();
    const disk = await (samplers.disk || (() => sampleDisk(runtimeRoot)))();
    const processNames = rejectLocalInference
      ? await (samplers.processes || listProcessNames)()
      : [];
    return assessHealthSample({ ...memory, cpuPercent, ...disk, processNames }, {
      resourceClass,
      rejectLocalInference,
      limits,
    });
  } catch (error) {
    return {
      allowed: false,
      reason: "health_sampling_error",
      evidence: { error: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500) },
    };
  }
}

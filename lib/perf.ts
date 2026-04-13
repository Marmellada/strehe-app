type PerfStep = {
  label: string;
  durationMs: number;
};

type PerfMetadata = Record<string, string | number | boolean | null | undefined>;

const PERF_LOG_MIN_MS = Number(process.env.PERF_LOG_MIN_MS ?? "400");
const PERF_VERBOSE = process.env.ENABLE_PERF_LOGS === "true";

function now() {
  return performance.now();
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function shouldLog(totalMs: number) {
  if (PERF_VERBOSE) return true;
  return totalMs >= PERF_LOG_MIN_MS;
}

export function createPerfTimer(name: string) {
  const start = now();
  let cursor = start;
  const steps: PerfStep[] = [];

  function mark(label: string) {
    const current = now();
    steps.push({
      label,
      durationMs: round(current - cursor),
    });
    cursor = current;
  }

  function finish(metadata: PerfMetadata = {}) {
    const totalMs = round(now() - start);

    if (!shouldLog(totalMs)) {
      return totalMs;
    }

    console.log("[PERF]", {
      name,
      totalMs,
      steps,
      metadata,
    });

    return totalMs;
  }

  return {
    mark,
    finish,
  };
}

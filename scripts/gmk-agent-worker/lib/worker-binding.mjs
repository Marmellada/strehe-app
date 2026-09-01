import path from "node:path";
import { bindReservationWorker } from "./scheduler.mjs";
import { openDatabase } from "./sqlite.mjs";

export function bindTargetedWorker({ runtimeRoot, jobId, workerPid = process.pid }) {
  if (!runtimeRoot) {
    const error = new Error("GMK_RUNTIME_ROOT is required for worker PID binding");
    error.code = "worker_pid_binding_failed";
    throw error;
  }
  const { db } = openDatabase(path.resolve(runtimeRoot));
  try {
    const binding = bindReservationWorker(db, { jobId, workerPid });
    if (!binding.allowed) {
      const error = new Error("worker PID binding was rejected");
      error.code = "worker_pid_binding_failed";
      throw error;
    }
    return binding;
  } finally {
    db.close();
  }
}

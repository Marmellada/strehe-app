import { processNextJob } from "./claim-loop.mjs";
import { maybeEnqueueProactiveJob, readEngineeringControl } from "./proactive.mjs";
import { reconcileReviewedEngineeringJobs } from "./review-reconciliation.mjs";

export async function processWorkerPass(runtime, spec, { engineering = false, now = new Date() } = {}) {
  const reconciledReviews = engineering
    ? await reconcileReviewedEngineeringJobs(runtime, { advancedAt: now.toISOString() })
    : [];
  const control = engineering
    ? await readEngineeringControl(runtime)
    : { paused: false, proactive_enabled: false, control_available: false };
  const processed = control.paused ? false : await processNextJob(runtime, spec);
  let scheduled = null;
  if (!processed && engineering && !control.paused && control.control_available) {
    scheduled = await maybeEnqueueProactiveJob(runtime, { now, control });
  }
  return { processed, scheduled, control, reconciledReviews };
}

export async function processWorkerOnce(runtime, spec, { engineering = false, now = new Date() } = {}) {
  return processWorkerPass(runtime, spec, { engineering, now });
}

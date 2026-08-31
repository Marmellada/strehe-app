"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_ACTIONS = new Set([
  "run_review",
  "enable_proactive",
  "disable_proactive",
  "pause",
  "resume",
  "finding_lifecycle",
  "enqueue_review",
]);

const FULL_SHA = /^[0-9a-f]{40}$/i;
const REVIEW_SESSION = /^[A-Z0-9][A-Z0-9._-]{7,127}$/;

export async function controlEngineeringAgentAction(formData: FormData) {
  await requireRole(["admin"]);
  const action = String(formData.get("control_action") || "");
  if (!ALLOWED_ACTIONS.has(action)) throw new Error("Invalid Engineering Agent control action.");
  const supabase = await createClient();
  const findingId = Number(formData.get("finding_id"));
  const findingLifecycle = String(formData.get("finding_lifecycle") || "");
  if (action === "finding_lifecycle" && (!Number.isSafeInteger(findingId) || findingId <= 0 || !["ACKNOWLEDGED", "DEFERRED", "RESOLVED"].includes(findingLifecycle))) {
    throw new Error("Invalid finding lifecycle update.");
  }
  let request;
  if (action === "finding_lifecycle") {
    request = supabase.rpc("operator_update_engineering_finding_lifecycle", { finding_id: findingId, finding_lifecycle: findingLifecycle });
  } else if (action === "enqueue_review") {
    const reviewSessionId = String(formData.get("review_session_id") || "");
    const baseCommit = String(formData.get("base_commit") || "");
    const targetCommit = String(formData.get("target_commit") || "");
    if (!REVIEW_SESSION.test(reviewSessionId)
      || !FULL_SHA.test(baseCommit)
      || !FULL_SHA.test(targetCommit)
      || baseCommit.toLowerCase() === targetCommit.toLowerCase()) {
      throw new Error("Invalid bounded Engineering review range.");
    }
    request = supabase.rpc("operator_enqueue_engineering_review", {
      review_session_id: reviewSessionId,
      base_commit: baseCommit,
      target_commit: targetCommit,
    });
  } else {
    request = supabase.rpc("operator_control_engineering_agent", { control_action: action });
  }
  const { error } = await request;
  if (error) throw new Error(`Unable to update Engineering Agent: ${error.message}`);
  revalidatePath("/operator/agents");
}

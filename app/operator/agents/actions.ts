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
]);

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
  const request = action === "finding_lifecycle"
    ? supabase.rpc("operator_update_engineering_finding_lifecycle", { finding_id: findingId, finding_lifecycle: findingLifecycle })
    : supabase.rpc("operator_control_engineering_agent", { control_action: action });
  const { error } = await request;
  if (error) throw new Error(`Unable to update Engineering Agent: ${error.message}`);
  revalidatePath("/operator/agents");
}

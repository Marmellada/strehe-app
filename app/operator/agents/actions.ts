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
  "recover_proactive",
]);

const FULL_SHA = /^[0-9a-f]{40}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REVIEW_SESSION = /^[A-Z0-9][A-Z0-9._-]{7,127}$/;
const RECOVERY_SESSION = /^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/;
const RECOVERY_PINS = Object.freeze({
  jobId: "795ec8d1-1b07-48e1-b18d-442f50ee1ff1",
  sessionId: "ENG-PROACTIVE-795ec8d1-1b07-48e1-b18d-442f50ee1ff1",
  targetCommit: "d022d3a63fca2835b877235691b7d255d58e461c",
  moduleFingerprint: "d93c0866e59a2857c5dad9ff011f95456052b5e0cf2e688816f9097399c26aad",
  evidenceSha256: "d1daebe0d8582440e2cf42e70366f9e158ff759a918d79405a8b2289aeb5a513",
});

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
  } else if (action === "recover_proactive") {
    const targetJobId = String(formData.get("target_job_id") || "").toLowerCase();
    const expectedSessionId = String(formData.get("expected_session_id") || "");
    const expectedTargetCommit = String(formData.get("expected_target_commit") || "").toLowerCase();
    const expectedModuleFingerprint = String(formData.get("expected_module_fingerprint") || "").toLowerCase();
    const evidenceSha256 = String(formData.get("evidence_sha256") || "").toLowerCase();
    if (!UUID.test(targetJobId)
      || !RECOVERY_SESSION.test(expectedSessionId)
      || !FULL_SHA.test(expectedTargetCommit)
      || !/^[0-9a-f]{64}$/.test(expectedModuleFingerprint)
      || !/^[0-9a-f]{64}$/.test(evidenceSha256)
      || targetJobId !== RECOVERY_PINS.jobId
      || expectedSessionId !== RECOVERY_PINS.sessionId
      || expectedTargetCommit !== RECOVERY_PINS.targetCommit
      || expectedModuleFingerprint !== RECOVERY_PINS.moduleFingerprint
      || evidenceSha256 !== RECOVERY_PINS.evidenceSha256) {
      throw new Error("Recovery manifest does not match the approved proactive evidence.");
    }
    request = supabase.rpc("operator_recover_engineering_proactive", {
      target_job_id: targetJobId,
      expected_session_id: expectedSessionId,
      expected_target_commit: expectedTargetCommit,
      expected_module_fingerprint: expectedModuleFingerprint,
      evidence_sha256: evidenceSha256,
    });
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

export async function reviewEngineeringJobAction(formData: FormData) {
  await requireRole(["admin"]);
  const jobId = String(formData.get("job_id") || "").toLowerCase();
  const decision = String(formData.get("decision") || "");
  const notes = String(formData.get("notes") || "").trim().slice(0, 4000);

  if (!UUID.test(jobId) || !["approved", "rejected"].includes(decision)) {
    throw new Error("Invalid Engineering review decision.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("review_agent_job", {
    target_job_id: jobId,
    decision,
    notes: notes || null,
  });

  if (error) {
    throw new Error(`Unable to record Engineering review decision: ${error.message}`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/operator/agents");
  revalidatePath("/operator/review");
  revalidatePath(`/operator/agents/jobs/${jobId}`);
}

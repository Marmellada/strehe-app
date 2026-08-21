import { expect, test } from "@playwright/test";
import { buildEngineeringAgentView, canControlAgentOperations, canViewAgentOperations } from "@/lib/agents/operator-view";

test("Agents UI authorization separates operator viewing from admin controls", () => {
  expect(canViewAgentOperations("admin")).toBe(true);
  expect(canViewAgentOperations("office")).toBe(true);
  expect(canViewAgentOperations("field")).toBe(false);
  expect(canViewAgentOperations("contractor")).toBe(false);
  expect(canControlAgentOperations("admin")).toBe(true);
  expect(canControlAgentOperations("office")).toBe(false);
});

test("Agents UI derives idle, working, and error states deterministically", () => {
  const now = Date.parse("2026-08-21T08:00:00Z");
  const base = {
    principal: { id: "a", agent_key: "engineering.local", display_name: "Engineering", is_active: true, last_seen_at: "2026-08-21T07:59:30Z" },
    control: { proactive_enabled: true, paused: false, next_proactive_at: "2026-08-21T12:00:00Z", manual_review_requested_at: null, local_model_name: "local-model", worker_state: "idle", current_job_id: null, last_error_class: null, status_snapshot: {}, snapshot_updated_at: "2026-08-21T07:59:30Z" },
    jobs: [],
  };
  expect(buildEngineeringAgentView(base, now).state).toBe("idle");
  const runningJob = { id: "j", job_type: "engineering.review", status: "running", priority: 10, target_module: "Auth", summary: null, finding_count: 0, error_status: null, claimed_at: null, lease_expires_at: "2026-08-21T08:05:00Z", completed_at: null, created_at: "2026-08-21T07:59:00Z", updated_at: "2026-08-21T07:59:00Z", attempt_count: 1, review_decision: null };
  expect(buildEngineeringAgentView({ ...base, jobs: [runningJob] }, now).state).toBe("working");
  expect(buildEngineeringAgentView({ ...base, control: { ...base.control, worker_state: "error", last_error_class: "ollama_timeout" } }, now).state).toBe("error");
  expect(buildEngineeringAgentView({ ...base, principal: { ...base.principal, last_seen_at: "2026-08-21T07:00:00Z" } }, now).state).toBe("offline");
  expect(buildEngineeringAgentView({ ...base, principal: { ...base.principal, last_seen_at: "2026-08-21T07:00:00Z" }, jobs: [runningJob] }, now).state).toBe("working");
});

test("Agents UI treats only genuinely completed work as last completed and only OPEN findings as pending", () => {
  const now = Date.parse("2026-08-21T08:00:00Z");
  const jobBase = { job_type: "engineering.proactive", priority: 500, target_module: "Auth", summary: null, finding_count: 0, error_status: null, claimed_at: null, lease_expires_at: null, created_at: "2026-08-21T07:00:00Z", updated_at: "2026-08-21T07:30:00Z", attempt_count: 1, review_decision: null };
  const payload = {
    principal: { id: "a", agent_key: "engineering.local", display_name: "Engineering", is_active: true, last_seen_at: "2026-08-21T07:59:30Z" },
    control: {
      proactive_enabled: true, paused: false, next_proactive_at: null, manual_review_requested_at: null,
      local_model_name: "local-model", worker_state: "idle", current_job_id: null, last_error_class: null,
      snapshot_updated_at: "2026-08-21T07:59:30Z",
      status_snapshot: { findings: [
        { id: 1, module: "Auth", summary: "Open", evidence: [], recommendation: null, severity: "high", confidence: "high", lifecycle: "OPEN", created_at: "2026-08-21T07:00:00Z" },
        { id: 2, module: "Auth", summary: "Done", evidence: [], recommendation: null, severity: "low", confidence: "high", lifecycle: "RESOLVED", created_at: "2026-08-21T06:00:00Z" },
      ] },
    },
    jobs: [
      { ...jobBase, id: "awaiting", status: "awaiting_review", completed_at: null },
      { ...jobBase, id: "older-completion", status: "completed", completed_at: "2026-08-21T07:15:00Z", created_at: "2026-08-21T07:10:00Z" },
      { ...jobBase, id: "completed", status: "completed", completed_at: "2026-08-21T07:30:00Z", created_at: "2026-08-21T06:00:00Z" },
    ],
  };
  const view = buildEngineeringAgentView(payload, now);
  expect(view.lastCompleted?.id).toBe("completed");
  expect(view.counts.pendingFindings).toBe(1);
  expect(view.counts.pendingReview).toBe(1);
});

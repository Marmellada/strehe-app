import { AgentControlButton } from "./AgentControlButton";
import { controlEngineeringAgentAction } from "./actions";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableShell } from "@/components/ui/Table";
import { buildEngineeringAgentView, canControlAgentOperations } from "@/lib/agents/operator-view";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function shortId(value: string | null | undefined) {
  return value ? value.slice(0, 8) : "—";
}

export default async function AgentsPage() {
  const current = await requireRole(["admin", "office"]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_engineering_agent_dashboard");
  if (error) throw new Error(`Unable to load Engineering Agent: ${error.message}`);
  const agent = buildEngineeringAgentView(data);
  const canControl = canControlAgentOperations(current.appUser.role);

  return (
    <div className="space-y-6">
      <PageHeader title="Agents" description="Monitor STREHË agents and request review-gated work. Engineering is the only active agent in V1." />

      <SectionCard
        title="Engineering Agent"
        description="Local-only, read/analyze/test/recommend. Remediation and production changes always require human approval."
        action={<StatusBadge status={agent.state} />}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Heartbeat</p><p className="mt-1 text-sm">{formatDate(agent.principal?.last_seen_at)}</p></div>
          <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current job</p><p className="mt-1 text-sm">{agent.currentJob ? `${agent.currentJob.job_type} · ${shortId(agent.currentJob.id)}` : "Idle"}</p></div>
          <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Local model</p><p className="mt-1 text-sm">{agent.control?.local_model_name || "Not reported"}</p></div>
          <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Last completed work</p><p className="mt-1 text-sm">{agent.lastCompleted ? `${agent.lastCompleted.job_type} · ${formatDate(agent.lastCompleted.completed_at)}` : "—"}</p></div>
          <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Proactive checking</p><p className="mt-1 text-sm">{agent.control?.proactive_enabled ? "Enabled" : "Disabled"}{agent.control?.paused ? " · paused" : ""}</p></div>
          <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Next eligible</p><p className="mt-1 text-sm">{formatDate(agent.control?.next_proactive_at)}</p></div>
          <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Review queue</p><p className="mt-1 text-sm">{agent.counts.pendingReview} awaiting human review</p></div>
          <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Safety boundary</p><p className="mt-1 text-sm">Local Ollama · no mutation tools</p></div>
        </div>

        {canControl ? (
          <div className="mt-6 space-y-4 border-t pt-4">
            <div className="flex flex-wrap gap-2">
              <form action={controlEngineeringAgentAction}><input type="hidden" name="control_action" value="run_review" /><AgentControlButton variant="default">Run proactive check now</AgentControlButton></form>
              <form action={controlEngineeringAgentAction}><input type="hidden" name="control_action" value={agent.control?.proactive_enabled ? "disable_proactive" : "enable_proactive"} /><AgentControlButton>{agent.control?.proactive_enabled ? "Disable proactive checking" : "Enable proactive checking"}</AgentControlButton></form>
              <form action={controlEngineeringAgentAction}><input type="hidden" name="control_action" value={agent.control?.paused ? "resume" : "pause"} /><AgentControlButton>{agent.control?.paused ? "Resume agent" : "Pause agent"}</AgentControlButton></form>
            </div>
            <form action={controlEngineeringAgentAction} className="grid gap-3 rounded-lg border p-4 md:grid-cols-3">
              <input type="hidden" name="control_action" value="enqueue_review" />
              <label className="text-sm font-medium">Review session<input required name="review_session_id" pattern="[A-Z0-9][A-Z0-9._-]{7,127}" placeholder="STREHE-ENGINEERING-REVIEW-001" className="mt-1 w-full rounded-md border bg-background px-3 py-2 font-mono text-xs" /></label>
              <label className="text-sm font-medium">Base commit<input required name="base_commit" pattern="[0-9a-fA-F]{40}" placeholder="40-character reviewed SHA" className="mt-1 w-full rounded-md border bg-background px-3 py-2 font-mono text-xs" /></label>
              <label className="text-sm font-medium">Target commit<input required name="target_commit" pattern="[0-9a-fA-F]{40}" placeholder="40-character target SHA" className="mt-1 w-full rounded-md border bg-background px-3 py-2 font-mono text-xs" /></label>
              <div className="md:col-span-3"><AgentControlButton>Queue bounded change-aware review</AgentControlButton></div>
            </form>
          </div>
        ) : <p className="mt-6 border-t pt-4 text-sm text-muted-foreground">Monitoring is available to office operators. Admin access is required for controls.</p>}
      </SectionCard>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Pending findings" value={agent.counts.pendingFindings} />
        <StatCard title="Stale / needs review" value={agent.counts.stale} />
        <StatCard title="Validated modules" value={agent.counts.validated} />
        <StatCard title="Deferred modules" value={agent.counts.deferred} />
      </div>

      <SectionCard title="Module validation state" description="Safe mirror of the authoritative local Engineering memory.">
        {agent.modules.length === 0 ? <EmptyState title="No module snapshot yet" description="The worker will publish one after it starts against the new control-plane migration." /> : (
          <TableShell><Table><TableHeader><TableRow><TableHead>Module</TableHead><TableHead>Criticality</TableHead><TableHead>Validation</TableHead><TableHead>Last meaningful review</TableHead><TableHead>Outcome</TableHead><TableHead>Commit</TableHead></TableRow></TableHeader>
          <TableBody>{agent.modules.map((module) => <TableRow key={module.name}><TableCell className="font-medium">{module.name}</TableCell><TableCell><Badge>{module.criticality}</Badge></TableCell><TableCell><StatusBadge status={module.validation_state} /></TableCell><TableCell>{formatDate(module.last_meaningful_review_at)}</TableCell><TableCell>{module.last_review_outcome || "—"}</TableCell><TableCell className="font-mono text-xs">{shortId(module.last_validated_commit)}</TableCell></TableRow>)}</TableBody></Table></TableShell>
        )}
      </SectionCard>

      <SectionCard title="Findings history" description="Recommendations only; no remediation is executed by the Engineering Agent.">
        {agent.findings.length === 0 ? <EmptyState title="No findings recorded" description="Explicit no-finding reviews still advance module freshness." /> : (
          <div className="space-y-3">{agent.findings.map((finding) => <article key={finding.id} className="rounded-lg border p-4"><div className="flex flex-wrap items-center gap-2"><StatusBadge status={finding.severity} /><Badge>{finding.module || "Repository"}</Badge><StatusBadge status={finding.lifecycle} /><span className="text-xs text-muted-foreground">{formatDate(finding.created_at)}</span></div><h3 className="mt-3 font-medium">{finding.summary}</h3>{finding.evidence.length > 0 ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{finding.evidence.map((item, index) => <li key={index}>{String(item)}</li>)}</ul> : null}{finding.recommendation ? <p className="mt-3 text-sm"><span className="font-medium">Recommendation:</span> {finding.recommendation}</p> : null}{canControl && finding.lifecycle !== "RESOLVED" ? <div className="mt-3 flex flex-wrap gap-2">{["ACKNOWLEDGED", "DEFERRED", "RESOLVED"].map((lifecycle) => <form action={controlEngineeringAgentAction} key={lifecycle}><input type="hidden" name="control_action" value="finding_lifecycle" /><input type="hidden" name="finding_id" value={finding.id} /><input type="hidden" name="finding_lifecycle" value={lifecycle} /><AgentControlButton>{lifecycle === "ACKNOWLEDGED" ? "Acknowledge" : lifecycle === "DEFERRED" ? "Defer" : "Resolve"}</AgentControlButton></form>)}</div> : null}</article>)}</div>
        )}
      </SectionCard>

      <SectionCard title="Recent activity and job lifecycle">
        {agent.jobs.length === 0 ? <EmptyState title="No Engineering jobs" description="Queued and completed work will appear here." /> : (
          <TableShell><Table><TableHeader><TableRow><TableHead>Job</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead>Target</TableHead><TableHead>Summary</TableHead><TableHead>Attempts</TableHead><TableHead>Created</TableHead><TableHead>Completed</TableHead></TableRow></TableHeader><TableBody>{agent.jobs.map((job) => <TableRow key={job.id}><TableCell className="font-mono text-xs">{shortId(job.id)}</TableCell><TableCell>{job.job_type}</TableCell><TableCell><StatusBadge status={job.status} /></TableCell><TableCell>{job.target_module || "—"}</TableCell><TableCell className="max-w-xs truncate">{job.summary || job.error_status || "—"}</TableCell><TableCell>{job.attempt_count}</TableCell><TableCell>{formatDate(job.created_at)}</TableCell><TableCell>{formatDate(job.completed_at)}</TableCell></TableRow>)}</TableBody></Table></TableShell>
        )}
      </SectionCard>
    </div>
  );
}

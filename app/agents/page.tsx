import {
  Alert,
  AlertDescription,
  AlertTitle,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  StatCard,
  StatusBadge,
} from "@/components/ui";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

type AgentRow = {
  id: string;
  agent_key: string;
  display_name: string;
  is_active: boolean;
  last_seen_at: string | null;
};

type AgentJobRow = {
  id: string;
  job_type: string;
  status: string;
  assigned_agent_id: string | null;
  created_at: string;
  result: unknown;
};

type AgentCapabilityRow = {
  agent_id: string;
  capability_key: string;
  constraints: unknown;
};

const workforce = [
  {
    name: "Expense Intake",
    status: "active",
    description:
      "Runs locally with OCR, deterministic extraction, and the local Ollama model. Raw receipts never enter the web app.",
  },
  {
    name: "Finance Analyst",
    status: "active",
    description:
      "Builds aggregate monthly reports, validates arithmetic and privacy, and waits for household review.",
  },
  {
    name: "Finance Planner",
    status: "active",
    description:
      "Creates monthly proposals from local balances and limited assumptions, then synchronizes the human decision back to the PC.",
  },
  {
    name: "Inspection Comparison",
    status: "paused",
    description:
      "Kept internal until local vision and temporary photo transport are verified. The old external-AI experiment is not activated.",
  },
] as const;

function formatTimestamp(value: string | null) {
  if (!value) return "Never connected";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function qualityStatus(result: unknown) {
  if (!result || typeof result !== "object") return null;
  const quality = (result as { quality?: unknown }).quality;
  if (!quality || typeof quality !== "object") return null;
  const status = (quality as { status?: unknown }).status;
  return typeof status === "string" ? status : null;
}

export default async function AgentWorkspacePage() {
  await requireRole(["admin"]);
  const supabase = await createClient();

  const [agentsResult, jobsResult, capabilitiesResult] = await Promise.all([
    supabase
      .from("agent_principals")
      .select("id, agent_key, display_name, is_active, last_seen_at")
      .order("display_name"),
    supabase
      .from("agent_jobs")
      .select("id, job_type, status, assigned_agent_id, created_at, result")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("agent_capabilities")
      .select("agent_id, capability_key, constraints")
      .order("capability_key"),
  ]);

  const loadError =
    agentsResult.error || jobsResult.error || capabilitiesResult.error;

  if (loadError) {
    throw new Error(`Agent Workspace failed: ${loadError.message}`);
  }

  const agents = (agentsResult.data ?? []) as AgentRow[];
  const jobs = (jobsResult.data ?? []) as AgentJobRow[];
  const capabilities = (capabilitiesResult.data ?? []) as AgentCapabilityRow[];
  const activeAgents = agents.filter((agent) => agent.is_active).length;
  const openJobs = jobs.filter((job) =>
    ["queued", "running", "awaiting_review"].includes(job.status)
  ).length;

  return (
    <main className="space-y-6">
      <PageHeader
        title="Agent Workspace"
        description="A controlled workspace for local agents, their capabilities, temporary jobs, and human review."
      />

      <Alert variant="info">
        <AlertTitle>No shared agent account</AlertTitle>
        <AlertDescription>
          Each local agent will receive its own alias identity and only the
          capabilities explicitly granted to it. Mailbox access is not
          required.
        </AlertDescription>
      </Alert>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Registered Agents" value={agents.length} />
        <StatCard title="Active Agents" value={activeAgents} />
        <StatCard
          title="Capability Grants"
          value={capabilities.length}
        />
        <StatCard title="Open Jobs" value={openJobs} />
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Workforce Map</CardTitle>
            <CardDescription>
              Specialists stay narrow. They validate and retry outputs, but
              they cannot grant themselves capabilities or bypass human review.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {workforce.map((specialist) => (
                <div
                  key={specialist.name}
                  className="rounded-xl border border-border p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-foreground">
                      {specialist.name}
                    </p>
                    <StatusBadge status={specialist.status} />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {specialist.description}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Agent Registry</CardTitle>
            <CardDescription>
              Machine identities remain separate from human STREHË users.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {agents.length === 0 ? (
              <EmptyState
                title="No agents provisioned"
                description="This is intentional. Provisioning will open only after the permission migration is tested."
              />
            ) : (
              <div className="divide-y divide-border">
                {agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        {agent.display_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {agent.agent_key} · {formatTimestamp(agent.last_seen_at)}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {capabilities
                          .filter(
                            (capability) => capability.agent_id === agent.id
                          )
                          .map((capability) => (
                            <span
                              key={capability.capability_key}
                              className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground"
                            >
                              {capability.capability_key}
                            </span>
                          ))}
                      </div>
                    </div>
                    <StatusBadge
                      status={agent.is_active ? "active" : "inactive"}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Jobs</CardTitle>
            <CardDescription>
              Generic jobs allow receipt extraction, photo comparison, and
              future local tools to use the same secure workflow.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {jobs.length === 0 ? (
              <EmptyState
                title="No jobs queued"
                description="The workspace is ready for agent-specific integrations."
              />
            ) : (
              <div className="divide-y divide-border">
                {jobs.map((job) => {
                  const quality = qualityStatus(job.result);
                  return (
                    <div
                      key={job.id}
                      className="flex items-center justify-between gap-4 py-3"
                    >
                      <div>
                        <p className="font-medium text-foreground">
                          {job.job_type.replaceAll(".", " ")}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {job.assigned_agent_id
                            ? "Assigned to an agent"
                            : "Waiting for a capable agent"}
                        </p>
                        {quality ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Quality: {quality}
                          </p>
                        ) : null}
                      </div>
                      <StatusBadge status={job.status} />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

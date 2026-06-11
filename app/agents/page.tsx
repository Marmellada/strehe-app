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
};

function formatTimestamp(value: string | null) {
  if (!value) return "Never connected";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function AgentWorkspacePage() {
  await requireRole(["admin"]);
  const supabase = await createClient();

  const [agentsResult, jobsResult, capabilityCountResult] = await Promise.all([
    supabase
      .from("agent_principals")
      .select("id, agent_key, display_name, is_active, last_seen_at")
      .order("display_name"),
    supabase
      .from("agent_jobs")
      .select("id, job_type, status, assigned_agent_id, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("agent_capabilities")
      .select("id", { count: "exact", head: true }),
  ]);

  const loadError =
    agentsResult.error || jobsResult.error || capabilityCountResult.error;

  if (loadError) {
    throw new Error(`Agent Workspace failed: ${loadError.message}`);
  }

  const agents = (agentsResult.data ?? []) as AgentRow[];
  const jobs = (jobsResult.data ?? []) as AgentJobRow[];
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
          value={capabilityCountResult.count ?? 0}
        />
        <StatCard title="Open Jobs" value={openJobs} />
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
                    className="flex items-center justify-between gap-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        {agent.display_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {agent.agent_key} · {formatTimestamp(agent.last_seen_at)}
                      </p>
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
                {jobs.map((job) => (
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
                    </div>
                    <StatusBadge status={job.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

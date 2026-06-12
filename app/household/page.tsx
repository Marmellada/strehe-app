import Link from "next/link";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
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
import { requireHouseholdAccess } from "@/lib/auth/require-household-access";

type HouseholdProjectRow = {
  id: string;
  title: string;
  status: string;
  target_date: string | null;
};

type AgentJobRow = {
  id: string;
  job_type: string;
  status: string;
  created_at: string;
};

function formatDate(value: string | null) {
  if (!value) return "No target date";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export default async function HouseholdPage() {
  const { supabase, spaces } = await requireHouseholdAccess();
  const spaceIds = spaces.map((space) => space.id);

  const [membersResult, projectsResult, jobsResult] =
    spaceIds.length > 0
      ? await Promise.all([
          supabase
            .from("household_members")
            .select("id", { count: "exact", head: true })
            .in("household_space_id", spaceIds)
            .eq("is_active", true),
          supabase
            .from("household_projects")
            .select("id, title, status, target_date")
            .in("household_space_id", spaceIds)
            .neq("status", "archived")
            .order("created_at", { ascending: false })
            .limit(5),
          supabase
            .from("agent_jobs")
            .select("id, job_type, status, created_at")
            .in("household_space_id", spaceIds)
            .order("created_at", { ascending: false })
            .limit(5),
        ])
      : [
          { count: 0, error: null },
          { data: [], error: null },
          { data: [], error: null },
        ];

  const loadError =
    membersResult.error || projectsResult.error || jobsResult.error;

  if (loadError) {
    throw new Error(`Household dashboard failed: ${loadError.message}`);
  }

  const projects = (projectsResult.data ?? []) as HouseholdProjectRow[];
  const jobs = (jobsResult.data ?? []) as AgentJobRow[];
  const pendingJobs = jobs.filter((job) =>
    ["queued", "running", "awaiting_review"].includes(job.status)
  ).length;

  return (
    <main className="space-y-6">
      <PageHeader
        title="Household"
        description="A private workspace for your family projects, shared decisions, and locally owned finances."
        actions={
          spaces.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link href="/household/finance">Finance & Planner</Link>
              </Button>
              <Button asChild>
                <Link href="/household/projects/new">New Project</Link>
              </Button>
            </div>
          ) : null
        }
      />

      <Alert variant="info">
        <AlertTitle>Local-first finance</AlertTitle>
        <AlertDescription>
          Financial records and original documents remain on your PC. Supabase
          will carry only temporary agent jobs and review data until local
          storage is confirmed.
        </AlertDescription>
      </Alert>

      {spaces.length === 0 ? (
        <EmptyState
          title="Household setup is pending"
          description="The first household space will be created when the foundation migration is applied."
        />
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Household Spaces" value={spaces.length} />
            <StatCard title="Members" value={membersResult.count ?? 0} />
            <StatCard title="Open Projects" value={projects.length} />
            <StatCard title="Agent Items Pending" value={pendingJobs} />
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Household Projects</CardTitle>
                <CardDescription>
                  Shared plans and goals that may remain safely in the web app.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {projects.length === 0 ? (
                  <EmptyState
                    title="No household projects yet"
                    description="Project creation will be added in the next Household milestone."
                  />
                ) : (
                  <div className="divide-y divide-border">
                    {projects.map((project) => (
                      <div
                        key={project.id}
                        className="flex items-center justify-between gap-4 py-3"
                      >
                        <div>
                          <Link
                            href={`/household/projects/${project.id}`}
                            className="font-medium text-foreground hover:underline"
                          >
                            {project.title}
                          </Link>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(project.target_date)}
                          </p>
                        </div>
                        <StatusBadge status={project.status} />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Temporary Agent Inbox</CardTitle>
                <CardDescription>
                  Work sent to your local PC, including future receipt
                  extraction and reporting requests.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {jobs.length === 0 ? (
                  <EmptyState
                    title="No agent jobs yet"
                    description="Nothing has been uploaded or requested for local processing."
                  />
                ) : (
                  <div className="divide-y divide-border">
                    {jobs.map((job) => (
                      <div
                        key={job.id}
                        className="flex items-center justify-between gap-4 py-3"
                      >
                        <div>
                          <Link
                            href={
                              job.job_type.startsWith("finance.")
                                ? "/household/finance"
                                : "/household"
                            }
                            className="font-medium text-foreground hover:underline"
                          >
                            {job.job_type.replaceAll(".", " ")}
                          </Link>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(job.created_at)}
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
        </>
      )}
    </main>
  );
}

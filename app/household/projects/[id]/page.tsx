import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { HouseholdProjectForm } from "@/components/household/HouseholdProjectForm";
import { Button, Card, CardContent, PageHeader } from "@/components/ui";
import { requireHouseholdAccess } from "@/lib/auth/require-household-access";

const PROJECT_STATUSES = new Set(["planned", "active", "paused", "completed"]);

type PageProps = {
  params: Promise<{ id: string }>;
};

type HouseholdProject = {
  id: string;
  household_space_id: string;
  title: string;
  description: string | null;
  status: string;
  target_date: string | null;
};

async function updateHouseholdProject(formData: FormData) {
  "use server";

  const { supabase, spaces } = await requireHouseholdAccess();
  const projectId = String(formData.get("project_id") || "").trim();
  const householdSpaceId = String(
    formData.get("household_space_id") || ""
  ).trim();
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const status = String(formData.get("status") || "").trim();
  const targetDate = String(formData.get("target_date") || "").trim();

  if (!projectId) {
    throw new Error("Project identifier is required.");
  }

  if (!spaces.some((space) => space.id === householdSpaceId)) {
    throw new Error("Household space was not found.");
  }

  if (!title) {
    throw new Error("Project title is required.");
  }

  if (!PROJECT_STATUSES.has(status)) {
    throw new Error("Project status is invalid.");
  }

  const { error } = await supabase
    .from("household_projects")
    .update({
      household_space_id: householdSpaceId,
      title,
      description: description || null,
      status,
      target_date: targetDate || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  if (error) {
    throw new Error(`Failed to update Household project: ${error.message}`);
  }

  revalidatePath("/household");
  revalidatePath(`/household/projects/${projectId}`);
  redirect(`/household/projects/${projectId}`);
}

export default async function HouseholdProjectPage({ params }: PageProps) {
  const { id } = await params;
  const { supabase, spaces } = await requireHouseholdAccess();
  const { data, error } = await supabase
    .from("household_projects")
    .select(
      "id, household_space_id, title, description, status, target_date"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Household project: ${error.message}`);
  }

  if (!data) {
    notFound();
  }

  const project = data as HouseholdProject;

  return (
    <main className="space-y-6">
      <PageHeader
        title={project.title}
        description="Update the shared plan and keep family decisions in one place."
        actions={
          <Button asChild variant="ghost">
            <Link href="/household">Back to Household</Link>
          </Button>
        }
      />

      <Card>
        <CardContent>
          <HouseholdProjectForm
            action={updateHouseholdProject}
            spaces={spaces}
            project={project}
            cancelHref="/household"
            submitLabel="Save Project"
          />
        </CardContent>
      </Card>
    </main>
  );
}

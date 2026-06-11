import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { HouseholdProjectForm } from "@/components/household/HouseholdProjectForm";
import { Button, Card, CardContent, PageHeader } from "@/components/ui";
import { requireHouseholdAccess } from "@/lib/auth/require-household-access";

const PROJECT_STATUSES = new Set(["planned", "active", "paused", "completed"]);

async function createHouseholdProject(formData: FormData) {
  "use server";

  const { authUser, supabase, spaces } = await requireHouseholdAccess();
  const householdSpaceId = String(
    formData.get("household_space_id") || ""
  ).trim();
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const status = String(formData.get("status") || "").trim();
  const targetDate = String(formData.get("target_date") || "").trim();

  if (!spaces.some((space) => space.id === householdSpaceId)) {
    throw new Error("Household space was not found.");
  }

  if (!title) {
    throw new Error("Project title is required.");
  }

  if (!PROJECT_STATUSES.has(status)) {
    throw new Error("Project status is invalid.");
  }

  const { data: project, error } = await supabase
    .from("household_projects")
    .insert({
      household_space_id: householdSpaceId,
      title,
      description: description || null,
      status,
      target_date: targetDate || null,
      created_by_user_id: authUser.id,
    })
    .select("id")
    .single();

  if (error || !project) {
    throw new Error(
      `Failed to create Household project: ${error?.message || "Unknown error."}`
    );
  }

  revalidatePath("/household");
  redirect(`/household/projects/${project.id}`);
}

export default async function NewHouseholdProjectPage() {
  const { spaces } = await requireHouseholdAccess();

  return (
    <main className="space-y-6">
      <PageHeader
        title="New Household Project"
        description="Create a shared plan with notes, decisions, status, and a target date."
        actions={
          <Button asChild variant="ghost">
            <Link href="/household">Back to Household</Link>
          </Button>
        }
      />

      <Card>
        <CardContent>
          <HouseholdProjectForm
            action={createHouseholdProject}
            spaces={spaces}
            cancelHref="/household"
            submitLabel="Create Project"
          />
        </CardContent>
      </Card>
    </main>
  );
}

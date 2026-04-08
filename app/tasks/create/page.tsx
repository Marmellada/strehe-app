import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import TaskForm from "@/components/tasks/TaskForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type PropertyRow = {
  id: string;
  property_code: string | null;
  title: string | null;
  address_line_1: string | null;
};

type AppUserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
};

async function createTask(formData: FormData) {
  "use server";

  const { authUser, appUser } = await requireRole(["admin", "office"]);
  const supabase = await createClient();

  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const status = String(formData.get("status") || "").trim();
  const priority = String(formData.get("priority") || "").trim();
  const dueDateRaw = String(formData.get("due_date") || "").trim();
  const assignedUserIdRaw = String(formData.get("assigned_user_id") || "").trim();
  const propertyIdRaw = String(formData.get("property_id") || "").trim();

  if (!title) throw new Error("Title is required.");
  if (!status) throw new Error("Status is required.");
  if (!priority) throw new Error("Priority is required.");
  if (!propertyIdRaw) throw new Error("Property is required.");

  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("id, property_code")
    .eq("id", propertyIdRaw)
    .single();

  if (propertyError || !property) {
    throw new Error("Selected property was not found.");
  }

  let assignedUserSnapshot: string | null = null;

  if (assignedUserIdRaw) {
    const { data: assignedUser, error: assignedUserError } = await supabase
      .from("app_users")
      .select("id, full_name, email")
      .eq("id", assignedUserIdRaw)
      .single();

    if (assignedUserError || !assignedUser) {
      throw new Error("Selected assignee was not found.");
    }

    assignedUserSnapshot =
      assignedUser.full_name?.trim() || assignedUser.email || assignedUser.id;
  }

  const payload = {
    title,
    description: description || null,
    status,
    priority,
    due_date: dueDateRaw || null,
    assigned_user_id: assignedUserIdRaw || null,
    assigned_user_name_snapshot: assignedUserSnapshot,
    created_by_user_id: authUser.id,
    created_by_user_name_snapshot:
      appUser.full_name?.trim() || appUser.email || authUser.id,
    property_id: propertyIdRaw,
    property_code_snapshot: property.property_code || null,
  };

  const { error } = await supabase.from("tasks").insert(payload);

  if (error) {
    throw new Error(`Failed to create task: ${error.message}`);
  }

  revalidatePath("/tasks");
  redirect("/tasks");
}

export default async function CreateTaskPage() {
  await requireRole(["admin", "office"]);

  const supabase = await createClient();

  const [
    { data: users, error: usersError },
    { data: properties, error: propertiesError },
  ] = await Promise.all([
    supabase
      .from("app_users")
      .select("id, email, full_name")
      .eq("is_active", true)
      .order("full_name", { ascending: true }),
    supabase
      .from("properties")
      .select("id, property_code, title, address_line_1")
      .order("property_code", { ascending: true }),
  ]);

  if (usersError) {
    throw new Error(`Failed to load users: ${usersError.message}`);
  }

  if (propertiesError) {
    throw new Error(`Failed to load properties: ${propertiesError.message}`);
  }

  const typedUsers: AppUserRow[] = (users || []) as AppUserRow[];
  const typedProperties: PropertyRow[] = (properties || []) as PropertyRow[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Task"
        description="Create and assign a new task"
        actions={
          <Link href="/tasks">
            <Button variant="ghost">Back to Tasks</Button>
          </Link>
        }
      />

      <Card>
        <div className="p-6">
          <TaskForm
            action={createTask}
            users={typedUsers}
            properties={typedProperties}
            cancelHref="/tasks"
            submitLabel="Create Task"
          />
        </div>
      </Card>
    </div>
  );
}

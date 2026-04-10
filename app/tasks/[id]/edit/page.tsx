import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { revalidatePath } from "next/cache";
import TaskForm from "@/components/tasks/TaskForm";

interface PageProps {
  params: Promise<{ id: string }>;
}

type TaskEditRow = {
  id: string;
  title: string | null;
  description: string | null;
  assigned_user_id: string | null;
  priority: string | null;
  status: string | null;
  blocked_reason: string | null;
  cancelled_reason: string | null;
  due_date: string | null;
  completed_at: string | null;
  property_id: string | null;
  subscription_id: string | null;
  service_id: string | null;
};

type AppUserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
};

type PropertyRow = {
  id: string;
  property_code: string | null;
  title: string | null;
  address_line_1: string | null;
};

async function updateTask(formData: FormData) {
  "use server";

  await requireRole(["admin", "office"]);
  const supabase = await createClient();

  const taskId = String(formData.get("taskId") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const assigned_user_id = String(formData.get("assigned_user_id") || "").trim();
  const priority = String(formData.get("priority") || "").trim();
  const status = String(formData.get("status") || "").trim();
  const due_date = String(formData.get("due_date") || "").trim();
  const property_id = String(formData.get("property_id") || "").trim();
  const blocked_reason = String(formData.get("blocked_reason") || "").trim();
  const cancelled_reason = String(formData.get("cancelled_reason") || "").trim();

  if (!title) throw new Error("Title is required.");
  if (status === "blocked" && !blocked_reason) {
    throw new Error("Blocked tasks require a reason.");
  }
  if (status === "cancelled" && !cancelled_reason) {
    throw new Error("Cancelled tasks require a reason.");
  }

  const { data: existingTask, error: existingTaskError } = await supabase
    .from("tasks")
    .select("id, status, property_id, subscription_id, service_id")
    .eq("id", taskId)
    .single();

  if (existingTaskError || !existingTask) {
    throw new Error("Task not found.");
  }

  if (existingTask.status === "completed") {
    throw new Error("Completed tasks cannot be edited. Reopen first.");
  }

  const isAutoTask = Boolean(existingTask.subscription_id);

  const updates: Record<string, string | null> = {
    title,
    description: description || null,
    assigned_user_id: assigned_user_id || null,
    assigned_user_name_snapshot: null,
    priority,
    status,
    due_date: due_date || null,
    property_code_snapshot: null,
    blocked_reason: status === "blocked" ? blocked_reason : null,
    cancelled_reason: status === "cancelled" ? cancelled_reason : null,
  };

  if (assigned_user_id) {
    const { data: assignedUser, error: assignedUserError } = await supabase
      .from("app_users")
      .select("id, full_name, email")
      .eq("id", assigned_user_id)
      .single();

    if (assignedUserError || !assignedUser) {
      throw new Error("Selected assignee was not found.");
    }

    updates.assigned_user_name_snapshot =
      assignedUser.full_name?.trim() || assignedUser.email || assignedUser.id;
  }

  if (isAutoTask) {
    updates.property_id = existingTask.property_id;
    if (existingTask.property_id) {
      const { data: lockedProperty, error: lockedPropertyError } = await supabase
        .from("properties")
        .select("id, property_code")
        .eq("id", existingTask.property_id)
        .single();

      if (lockedPropertyError || !lockedProperty) {
        throw new Error("Task property was not found.");
      }

      updates.property_code_snapshot = lockedProperty.property_code || null;
    }
  } else {
    if (!property_id) {
      throw new Error("Property is required.");
    }

    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("id, property_code")
      .eq("id", property_id)
      .single();

    if (propertyError || !property) {
      throw new Error("Selected property was not found.");
    }

    updates.property_id = property_id;
    updates.property_code_snapshot = property.property_code || null;
  }

  if (status === "completed") {
    updates.completed_at = new Date().toISOString();
  } else {
    updates.completed_at = null;
  }

  const { error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", taskId);

  if (error) {
    throw new Error(`Failed to update task: ${error.message}`);
  }

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/tasks");
  redirect(`/tasks/${taskId}`);
}

export default async function TaskEditPage({ params }: PageProps) {
  const { id } = await params;

  await requireRole(["admin", "office"]);
  const supabase = await createClient();

  const [
    { data: task, error: taskError },
    { data: users, error: usersError },
    { data: properties, error: propertiesError },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id, title, description, assigned_user_id, priority, status, blocked_reason, cancelled_reason, due_date, completed_at, property_id, subscription_id, service_id"
      )
      .eq("id", id)
      .single(),
    supabase
      .from("app_users")
      .select("id, email, full_name")
      .eq("is_active", true)
      .order("full_name"),
    supabase
      .from("properties")
      .select("id, property_code, title, address_line_1")
      .order("property_code"),
  ]);

  if (taskError) {
    if (taskError.code === "PGRST116") notFound();
    throw new Error(taskError.message);
  }

  if (!task) {
    notFound();
  }

  if (usersError) {
    throw new Error(`Failed to load users: ${usersError.message}`);
  }

  if (propertiesError) {
    throw new Error(`Failed to load properties: ${propertiesError.message}`);
  }

  const typedTask = task as TaskEditRow;
  const typedUsers = (users || []) as AppUserRow[];
  const typedProperties = (properties || []) as PropertyRow[];
  const isAutoTask = Boolean(typedTask.subscription_id);

  if (typedTask.status === "completed" || typedTask.status === "cancelled") {
    redirect(`/tasks/${id}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Task"
        description={typedTask.title || "Task"}
        actions={
          <Link href={`/tasks/${id}`}>
            <Button variant="ghost">← Back to Task</Button>
          </Link>
        }
      />

      <Card>
        <div className="p-6 space-y-6">
          {isAutoTask ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              This is an auto-generated subscription task. Property linkage is locked.
            </div>
          ) : null}

          <TaskForm
            action={updateTask}
            users={typedUsers}
            properties={typedProperties}
            task={typedTask}
            cancelHref={`/tasks/${id}`}
            submitLabel="Save Changes"
            lockProperty={isAutoTask}
          />
        </div>
      </Card>
    </div>
  );
}

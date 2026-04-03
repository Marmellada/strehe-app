import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormInput } from "@/components/ui/FormInput";
import { revalidatePath } from "next/cache";

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
  due_date: string | null;
  completed_at: string | null;
};

async function updateTask(formData: FormData) {
  "use server";

  await requireRole(["admin", "office"]);
  const supabase = await createClient();

  const taskId = String(formData.get("taskId") || "");
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const assigned_user_id = String(formData.get("assigned_user_id") || "").trim();
  const priority = String(formData.get("priority") || "").trim();
  const status = String(formData.get("status") || "").trim();
  const due_date = String(formData.get("due_date") || "").trim();

  if (!title) throw new Error("Title is required");

  const { data: existingTask, error: existingTaskError } = await supabase
    .from("tasks")
    .select("id, status")
    .eq("id", taskId)
    .single();

  if (existingTaskError || !existingTask) {
    throw new Error("Task not found.");
  }

  if (existingTask.status === "completed") {
    throw new Error("Completed tasks cannot be edited. Reopen first.");
  }

  const updates: Record<string, any> = {
    title,
    description: description || null,
    assigned_user_id: assigned_user_id || null,
    priority,
    status,
    due_date: due_date || null,
    updated_at: new Date().toISOString(),
  };

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
  ] = await Promise.all([
    supabase.from("tasks").select("*").eq("id", id).single(),
    supabase
      .from("app_users")
      .select("id, email, full_name, role")
      .eq("is_active", true)
      .order("full_name"),
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

  const typedTask = task as TaskEditRow;

  if (typedTask.status === "completed") {
    redirect(`/tasks/${id}`);
  }

  const selectClass =
    "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500";

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
        <form action={updateTask} className="p-6 space-y-6">
          <input type="hidden" name="taskId" value={id} />

          <div className="grid grid-cols-1 gap-6">
            <FormInput
              label="Title"
              name="title"
              required
              defaultValue={typedTask.title ?? ""}
            />

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Description
              </label>
              <textarea
                name="description"
                rows={4}
                defaultValue={typedTask.description ?? ""}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Status
              </label>
              <select
                name="status"
                defaultValue={typedTask.status ?? "open"}
                className={selectClass}
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="blocked">Blocked</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Priority
              </label>
              <select
                name="priority"
                defaultValue={typedTask.priority ?? "medium"}
                className={selectClass}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Assign To
            </label>
            <select
              name="assigned_user_id"
              defaultValue={typedTask.assigned_user_id ?? ""}
              className={selectClass}
            >
              <option value="">— Unassigned —</option>
              {(users || []).map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.full_name?.trim() || u.email} ({u.role})
                </option>
              ))}
            </select>
          </div>

          <FormInput
            label="Due Date"
            name="due_date"
            type="date"
            defaultValue={typedTask.due_date?.split("T")[0] ?? ""}
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-700">
            <Link href={`/tasks/${id}`}>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </Link>

            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
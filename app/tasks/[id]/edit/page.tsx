// app/tasks/[id]/edit/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormInput } from "@/components/ui/FormInput";
import { revalidatePath } from "next/cache";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function updateTask(formData: FormData) {
  "use server";

  const supabase = await createClient();

  const taskId = formData.get("taskId") as string;
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const property_id = formData.get("property_id") as string;
  const service_id = formData.get("service_id") as string;
  const subscription_id = formData.get("subscription_id") as string;
  const assigned_to_user_id = formData.get("assigned_to_user_id") as string;
  const priority = formData.get("priority") as string;
  const status = formData.get("status") as string;
  const due_date = formData.get("due_date") as string;
  const estimated_cost = formData.get("estimated_cost") as string;
  const actual_cost = formData.get("actual_cost") as string;

  if (!title?.trim()) throw new Error("Title is required");

  const updates: Record<string, unknown> = {
    title: title.trim(),
    description: description?.trim() || null,
    property_id: property_id || null,
    service_id: service_id || null,
    subscription_id: subscription_id || null,
    assigned_to_user_id: assigned_to_user_id || null,
    priority,
    status,
    due_date: due_date || null,
    estimated_cost: estimated_cost ? parseFloat(estimated_cost) : null,
    actual_cost: actual_cost ? parseFloat(actual_cost) : null,
    updated_at: new Date().toISOString(),
  };

  // Auto-set completed_at when marking complete
  if (status === "completed") {
    updates.completed_at = new Date().toISOString();
  } else {
    updates.completed_at = null;
  }

  const { error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", taskId);

  if (error) throw new Error(`Failed to update task: ${error.message}`);

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/tasks");
  redirect(`/tasks/${taskId}`);
}

export default async function TaskEditPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: task },
    { data: properties },
    { data: services },
    { data: users },
    { data: subscriptions },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("*")
      .eq("id", id)
      .single(),
    supabase
      .from("properties")
      .select("id, code, address")
      .order("code"),
    supabase
      .from("services")
      .select("id, name, category")
      .order("name"),
    supabase
      .from("users")
      .select("id, full_name, role")
      .in("role", ["staff", "contractor", "manager", "operations"])
      .eq("is_active", true)
      .order("full_name"),
    supabase
      .from("subscriptions")
      .select("id, properties(code), packages(name)")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (!task) notFound();

  const selectClass =
    "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Task"
        description={task.title}
        actions={
          <Link href={`/tasks/${id}`}>
            <Button variant="ghost">← Back to Task</Button>
          </Link>
        }
      />

      <Card>
        <form action={updateTask} className="p-6 space-y-6">
          <input type="hidden" name="taskId" value={id} />

          {/* Title & Description */}
          <div className="grid grid-cols-1 gap-6">
            <FormInput
              label="Title"
              name="title"
              required
              defaultValue={task.title}
            />
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Description
              </label>
              <textarea
                name="description"
                rows={4}
                defaultValue={task.description ?? ""}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          {/* Status & Priority */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Status
              </label>
              <select name="status" defaultValue={task.status} className={selectClass}>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Priority
              </label>
              <select name="priority" defaultValue={task.priority} className={selectClass}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          {/* Property & Service */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Property
              </label>
              <select
                name="property_id"
                defaultValue={task.property_id ?? ""}
                className={selectClass}
              >
                <option value="">— No Property —</option>
                {properties?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.address}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Service
              </label>
              <select
                name="service_id"
                defaultValue={task.service_id ?? ""}
                className={selectClass}
              >
                <option value="">— No Service —</option>
                {services?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.category})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Assignment & Subscription */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Assign To
              </label>
              <select
                name="assigned_to_user_id"
                defaultValue={task.assigned_to_user_id ?? ""}
                className={selectClass}
              >
                <option value="">— Unassigned —</option>
                {users?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Subscription
              </label>
              <select
                name="subscription_id"
                defaultValue={task.subscription_id ?? ""}
                className={selectClass}
              >
                <option value="">— No Subscription —</option>
                {subscriptions?.map((sub: any) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.properties?.code} — {sub.packages?.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Due Date & Costs */}
          <div className="grid grid-cols-3 gap-6">
            <FormInput
              label="Due Date"
              name="due_date"
              type="date"
              defaultValue={task.due_date?.split("T")[0] ?? ""}
            />
            <FormInput
              label="Estimated Cost (EUR)"
              name="estimated_cost"
              type="number"
              defaultValue={task.estimated_cost?.toString() ?? ""}
              placeholder="0.00"
            />
            <FormInput
              label="Actual Cost (EUR)"
              name="actual_cost"
              type="number"
              defaultValue={task.actual_cost?.toString() ?? ""}
              placeholder="0.00"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-700">
            <Link href={`/tasks/${id}`}>
              <Button type="button" variant="ghost">Cancel</Button>
            </Link>
            <Button type="submit" variant="default">
              Save Changes
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

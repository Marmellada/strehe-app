// app/tasks/create/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormInput } from "@/components/ui/FormInput";

async function createTask(formData: FormData) {
  "use server";

  const supabase = await createClient();

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const property_id = formData.get("property_id") as string || null;
  const service_id = formData.get("service_id") as string || null;
  const subscription_id = formData.get("subscription_id") as string || null;
  const assigned_to_user_id = formData.get("assigned_to_user_id") as string || null;
  const priority = formData.get("priority") as string || "medium";
  const status = formData.get("status") as string || "pending";
  const due_date = formData.get("due_date") as string || null;
  const estimated_cost = formData.get("estimated_cost") as string || null;

  if (!title?.trim()) {
    throw new Error("Title is required");
  }

  const { data, error } = await supabase
    .from("tasks")
    .insert({
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create task: ${error.message}`);

  redirect(`/tasks/${data.id}`);
}

export default async function TaskCreatePage() {
  const supabase = await createClient();

  const [
    { data: properties },
    { data: services },
    { data: users },
    { data: subscriptions },
  ] = await Promise.all([
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Task"
        description="Add a new task to the system"
        actions={
          <Link href="/tasks">
            <Button variant="ghost">← Back to Tasks</Button>
          </Link>
        }
      />

      <Card>
        <form action={createTask} className="p-6 space-y-6">

          {/* Core Fields */}
          <div className="grid grid-cols-1 gap-6">
            <FormInput
              label="Title"
              name="title"
              required
              placeholder="e.g. Fix leaking pipe in bathroom"
            />
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Description
              </label>
              <textarea
                name="description"
                rows={4}
                placeholder="Detailed description of the task..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
          </div>

          {/* Status & Priority */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Status
              </label>
              <select
                name="status"
                defaultValue="pending"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
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
              <select
                name="priority"
                defaultValue="medium"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
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
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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

          {/* Due Date & Cost */}
          <div className="grid grid-cols-2 gap-6">
            <FormInput
              label="Due Date"
              name="due_date"
              type="date"
            />
            <FormInput
              label="Estimated Cost (EUR)"
              name="estimated_cost"
              type="number"
              placeholder="0.00"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-700">
            <Link href="/tasks">
              <Button type="button" variant="ghost">Cancel</Button>
            </Link>
            <Button type="submit" variant="default">
              Create Task
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

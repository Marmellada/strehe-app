import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "../../../lib/supabase/server";
import { requireRole } from "../../../lib/auth/require-role";

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

  const { authUser } = await requireRole(["admin", "office"]);
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

  const payload = {
    title,
    description: description || null,
    status,
    priority,
    due_date: dueDateRaw || null,
    assigned_user_id: assignedUserIdRaw || null,
    created_by_user_id: authUser.id,
    property_id: propertyIdRaw,
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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Create Task</h1>
          <p className="page-subtitle">Create and assign a new task</p>
        </div>

        <Link href="/tasks" className="btn btn-secondary">
          Back to Tasks
        </Link>
      </div>

      <div className="card max-w-3xl">
        <form action={createTask} className="p-6 space-y-6">
          <div className="field">
            <label className="label" htmlFor="title">
              Title
            </label>
            <input id="title" name="title" className="input" required />
          </div>

          <div className="field">
            <label className="label" htmlFor="description">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              className="input"
              rows={5}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="field">
              <label className="label" htmlFor="status">
                Status
              </label>
              <select
                id="status"
                name="status"
                className="input"
                defaultValue="open"
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="blocked">Blocked</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div className="field">
              <label className="label" htmlFor="priority">
                Priority
              </label>
              <select
                id="priority"
                name="priority"
                className="input"
                defaultValue="medium"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div className="field">
              <label className="label" htmlFor="due_date">
                Due Date
              </label>
              <input
                id="due_date"
                name="due_date"
                type="date"
                className="input"
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="assigned_user_id">
                Assign To
              </label>
              <select
                id="assigned_user_id"
                name="assigned_user_id"
                className="input"
                defaultValue=""
              >
                <option value="">Unassigned</option>
                {typedUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name?.trim() || u.email || "Unnamed User"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label className="label" htmlFor="property_id">
              Property
            </label>
            <select
              id="property_id"
              name="property_id"
              className="input"
              defaultValue=""
              required
            >
              <option value="">Select property</option>
              {typedProperties.map((property) => (
                <option key={property.id} value={property.id}>
                  {[
                    property.property_code,
                    property.title,
                    property.address_line_1,
                  ]
                    .filter(Boolean)
                    .join(" — ")}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Link href="/tasks" className="btn btn-secondary">
              Cancel
            </Link>

            <button type="submit" className="btn">
              Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
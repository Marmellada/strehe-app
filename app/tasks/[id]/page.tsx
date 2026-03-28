import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";

async function deleteTask(formData: FormData) {
  "use server";

  const id = String(formData.get("id") || "").trim();

  if (!id) {
    throw new Error("Missing task id.");
  }

  const { error } = await supabase.from("tasks").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  redirect("/tasks");
}

async function markTaskCompleted(formData: FormData) {
  "use server";

  const id = String(formData.get("id") || "").trim();

  if (!id) {
    throw new Error("Missing task id.");
  }

  const { error } = await supabase
    .from("tasks")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/tasks/${id}`);
}

async function reopenTask(formData: FormData) {
  "use server";

  const id = String(formData.get("id") || "").trim();

  if (!id) {
    throw new Error("Missing task id.");
  }

  const { error } = await supabase
    .from("tasks")
    .update({
      status: "open",
      completed_at: null,
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/tasks/${id}`);
}

function formatLabel(value: string | null | undefined) {
  if (!value) return "-";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (l: string) => l.toUpperCase());
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";

  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatPrice(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";

  const num = typeof value === "number" ? value : Number(value);

  if (Number.isNaN(num)) return "-";

  return `€${num.toFixed(2)}`;
}

type TaskPageProps = {
  params: Promise<{ id: string }>;
};

export default async function TaskDetailPage({
  params,
}: TaskPageProps) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("tasks")
    .select(
      `
        id,
        title,
        description,
        property_id,
        reported_by_client_id,
        assigned_to_client_id,
        service_id,
        subscription_id,
        status,
        priority,
        due_date,
        completed_at,
        created_at,
        updated_at,
        property:properties!tasks_property_fk (
          id,
          title,
          property_code,
          address_line_1
        ),
        reported_by:clients!tasks_reported_by_fk (
          id,
          full_name,
          company_name
        ),
        assigned_to:clients!tasks_assigned_to_fk (
          id,
          full_name,
          company_name
        ),
        service:services!tasks_service_fk (
          id,
          name,
          category,
          base_price
        ),
        subscription:subscriptions!tasks_subscription_fk (
          id,
          status,
          monthly_price,
          start_date,
          end_date,
          client:clients!subscriptions_client_fk (
            id,
            full_name,
            company_name
          ),
          property:properties!subscriptions_property_fk (
            id,
            title,
            property_code
          ),
          package:packages!subscriptions_package_fk (
            id,
            name
          )
        )
      `
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return notFound();
  }

  const task: any = data;

  const reportedBy =
    task.reported_by?.company_name ||
    task.reported_by?.full_name ||
    "-";

  const assignedTo =
    task.assigned_to?.company_name ||
    task.assigned_to?.full_name ||
    "-";

  const subscriptionClientName =
    task.subscription?.client?.company_name ||
    task.subscription?.client?.full_name ||
    "-";

  const subscriptionPropertyLabel =
    task.subscription?.property?.property_code
      ? `${task.subscription.property.property_code} - ${task.subscription.property?.title || ""}`
      : task.subscription?.property?.title || "-";

  const isCompleted = task.status === "completed";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title">{task.title || "Untitled Task"}</h1>
          <p className="page-subtitle">{formatLabel(task.status)}</p>
        </div>

        <div className="flex gap-2">
          <Link href={`/tasks/${task.id}/edit`} className="btn">
            Edit Task
          </Link>

          {isCompleted ? (
            <form action={reopenTask}>
              <input type="hidden" name="id" value={task.id} />
              <button type="submit" className="btn">
                Reopen Task
              </button>
            </form>
          ) : (
            <form action={markTaskCompleted}>
              <input type="hidden" name="id" value={task.id} />
              <button type="submit" className="btn">
                Mark Completed
              </button>
            </form>
          )}

          <form action={deleteTask}>
            <input type="hidden" name="id" value={task.id} />
            <button type="submit" className="btn btn-danger">
              Delete Task
            </button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="grid grid-2 gap-4">
          <div>
            <p className="field-label">Title</p>
            <p>{task.title || "-"}</p>
          </div>

          <div>
            <p className="field-label">Status</p>
            <p>{formatLabel(task.status)}</p>
          </div>

          <div>
            <p className="field-label">Priority</p>
            <p>{formatLabel(task.priority)}</p>
          </div>

          <div>
            <p className="field-label">Due Date</p>
            <p>{formatDate(task.due_date)}</p>
          </div>

          <div>
            <p className="field-label">Completed At</p>
            <p>{formatDateTime(task.completed_at)}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title mb-4">Property</h2>

        <div className="grid grid-2 gap-4">
          <div>
            <p className="field-label">Property</p>
            <p>{task.property?.title || "-"}</p>
          </div>

          <div>
            <p className="field-label">Property Code</p>
            <p>{task.property?.property_code || "-"}</p>
          </div>

          <div>
            <p className="field-label">Address</p>
            <p>{task.property?.address_line_1 || "-"}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title mb-4">People</h2>

        <div className="grid grid-2 gap-4">
          <div>
            <p className="field-label">Reported By</p>
            <p>{reportedBy}</p>
          </div>

          <div>
            <p className="field-label">Assigned To</p>
            <p>{assignedTo}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title mb-4">Service Link</h2>

        <div className="grid grid-2 gap-4">
          <div>
            <p className="field-label">Service</p>
            <p>{task.service?.name || "-"}</p>
          </div>

          <div>
            <p className="field-label">Category</p>
            <p>{formatLabel(task.service?.category)}</p>
          </div>

          <div>
            <p className="field-label">Base Price</p>
            <p>{formatPrice(task.service?.base_price)}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title mb-4">Subscription Link</h2>

        <div className="grid grid-2 gap-4">
          <div>
            <p className="field-label">Subscription Status</p>
            <p>{formatLabel(task.subscription?.status)}</p>
          </div>

          <div>
            <p className="field-label">Subscription Price</p>
            <p>{formatPrice(task.subscription?.monthly_price)}</p>
          </div>

          <div>
            <p className="field-label">Client</p>
            <p>{subscriptionClientName}</p>
          </div>

          <div>
            <p className="field-label">Property</p>
            <p>{subscriptionPropertyLabel}</p>
          </div>

          <div>
            <p className="field-label">Package</p>
            <p>{task.subscription?.package?.name || "-"}</p>
          </div>

          <div>
            <p className="field-label">Start Date</p>
            <p>{formatDate(task.subscription?.start_date)}</p>
          </div>

          <div>
            <p className="field-label">End Date</p>
            <p>{formatDate(task.subscription?.end_date)}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title mb-4">Description</h2>
        <p>{task.description || "No description provided."}</p>
      </div>

      <div className="card">
        <h2 className="section-title mb-4">System Info</h2>

        <div className="grid grid-2 gap-4">
          <div>
            <p className="field-label">Created At</p>
            <p>{formatDateTime(task.created_at)}</p>
          </div>

          <div>
            <p className="field-label">Updated At</p>
            <p>{formatDateTime(task.updated_at)}</p>
          </div>
        </div>
      </div>

      <div>
        <Link href="/tasks" className="text-sm underline">
          ← Back to tasks
        </Link>
      </div>
    </div>
  );
}
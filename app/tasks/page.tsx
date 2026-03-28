import Link from "next/link";
import { supabase } from "@/lib/supabase";

function formatLabel(value: string | null | undefined) {
  if (!value) return "-";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (l: string) => l.toUpperCase());
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function TasksPage() {
  const { data: tasks, error } = await supabase
    .from("tasks")
    .select(`
      id,
      title,
      status,
      priority,
      due_date,
      property:properties!tasks_property_fk (
        id,
        title,
        property_code
      ),
      assigned_to:clients!tasks_assigned_to_fk (
        id,
        full_name,
        company_name
      ),
      service:services!tasks_service_fk (
        id,
        name
      ),
      subscription:subscriptions!tasks_subscription_fk (
        id
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Tasks page error:", error);
    return <div>Error loading tasks</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Tasks</h1>
          <p className="page-subtitle">Manage operational work</p>
        </div>

        <Link href="/tasks/create" className="btn">
          + New Task
        </Link>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Property</th>
                <th>Assigned To</th>
                <th>Service</th>
                <th>Covered</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Due Date</th>
              </tr>
            </thead>

            <tbody>
              {tasks?.map((task: any) => {
                const assignedTo =
                  task.assigned_to?.company_name ||
                  task.assigned_to?.full_name ||
                  "-";

                const propertyLabel =
                  task.property?.property_code
                    ? `${task.property.property_code} - ${task.property?.title || ""}`
                    : task.property?.title || "-";

                return (
                  <tr key={task.id}>
                    <td>
                      <Link href={`/tasks/${task.id}`}>
                        {task.title || "-"}
                      </Link>
                    </td>

                    <td>{propertyLabel}</td>

                    <td>{assignedTo}</td>

                    <td>{task.service?.name || "-"}</td>

                    <td>{task.subscription?.id ? "Yes" : "No"}</td>

                    <td>{formatLabel(task.status)}</td>

                    <td>{formatLabel(task.priority)}</td>

                    <td>{formatDate(task.due_date)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {tasks?.length === 0 && (
            <div className="empty-state">No tasks found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
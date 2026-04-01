// app/tasks/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DeleteTaskButton } from "@/components/tasks/DeleteTaskButton";
import { deleteTask } from "./actions";

interface PageProps {
  params: Promise<{ id: string }>;
}

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  in_progress: "default",
  completed: "outline",
  cancelled: "destructive",
  on_hold: "secondary",
};

const priorityColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  urgent: "destructive",
  high: "destructive",
  medium: "default",
  low: "secondary",
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function TaskDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: task, error } = await supabase
    .from("tasks")
    .select(
      `
      *,
      property:properties!tasks_property_fk(
        id,
        property_code,
        address_line_1,
        address_line_2,
        city,
        country
      ),
      service:services!tasks_service_fk(
        id,
        name,
        category
      ),
      subscription:subscriptions!tasks_subscription_fk(
        id,
        start_date,
        end_date,
        package:packages(name)
      ),
      assigned_user:users!tasks_assigned_to_user_id_fkey(
        id,
        full_name,
        email,
        role
      ),
      reported_user:users!tasks_reported_by_user_id_fkey(
        id,
        full_name,
        email,
        role
      ),
      assigned_client:clients!tasks_assigned_to_fk(
        id,
        full_name,
        email
      ),
      reported_client:clients!tasks_reported_by_fk(
        id,
        full_name,
        email
      )
    `
    )
    .eq("id", id)
    .single();

  if (error) {
    console.error("Task fetch error:", error.message);
    if (error.code === "PGRST116") {
      notFound();
    }
    throw new Error(error.message);
  }

  if (!task) {
    notFound();
  }

  // Build a readable address string from parts
  const propertyAddress = task.property
    ? [
        task.property.address_line_1,
        task.property.address_line_2,
        task.property.city,
        task.property.country,
      ]
        .filter(Boolean)
        .join(", ")
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={task.title}
        description={`Task #${task.id.slice(0, 8).toUpperCase()}`}
        actions={
          <div className="flex items-center gap-3">
            <Link href="/tasks">
              <Button variant="ghost">← Back to Tasks</Button>
            </Link>
            <Link href={`/tasks/${task.id}/edit`}>
              <Button variant="outline">Edit Task</Button>
            </Link>
          </div>
        }
      />

      {/* Status Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={statusColors[task.status] || "default"}>
          {task.status.replace("_", " ")}
        </Badge>
        <Badge variant={priorityColors[task.priority] || "default"}>
          {task.priority} priority
        </Badge>
        {task.service && (
          <Badge variant="default">{task.service.category}</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">

          {/* Description */}
          {task.description && (
            <Card>
              <div className="p-6">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Description
                </h2>
                <p className="text-white whitespace-pre-wrap">
                  {task.description}
                </p>
              </div>
            </Card>
          )}

          {/* Property */}
          <Card>
            <div className="p-6">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                Property
              </h2>
              {task.property ? (
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-white font-medium">{propertyAddress}</p>
                    <p className="text-gray-400 text-sm mt-1">
                      Code:{" "}
                      <span className="text-gray-200">
                        {task.property.property_code}
                      </span>
                    </p>
                  </div>
                  <Link href={`/properties/${task.property.id}`}>
                    <Button variant="ghost" size="sm">
                      View Property →
                    </Button>
                  </Link>
                </div>
              ) : (
                <p className="text-gray-500 italic">No property linked</p>
              )}
            </div>
          </Card>

          {/* Service */}
          {task.service && (
            <Card>
              <div className="p-6">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                  Service
                </h2>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">{task.service.name}</p>
                    <p className="text-gray-400 text-sm mt-1">
                      Category:{" "}
                      <span className="text-gray-200">
                        {task.service.category}
                      </span>
                    </p>
                  </div>
                  <Link href={`/services/${task.service.id}`}>
                    <Button variant="ghost" size="sm">
                      View Service →
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          )}

          {/* Subscription */}
          {task.subscription && (
            <Card>
              <div className="p-6">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                  Subscription Coverage
                </h2>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-gray-400 text-xs uppercase">Package</p>
                    <p className="text-white mt-1">
                      {task.subscription.package?.name ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs uppercase">Start</p>
                    <p className="text-white mt-1">
                      {formatDate(task.subscription.start_date)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs uppercase">End</p>
                    <p className="text-white mt-1">
                      {formatDate(task.subscription.end_date)}
                    </p>
                  </div>
                </div>
                <div className="mt-3">
                  <Link href={`/subscriptions/${task.subscription.id}`}>
                    <Button variant="ghost" size="sm">
                      View Subscription →
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">

          {/* Timeline */}
          <Card>
            <div className="p-6">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                Timeline
              </h2>
              <dl className="space-y-3">
                <div>
                  <dt className="text-gray-400 text-xs uppercase">Created</dt>
                  <dd className="text-white text-sm mt-0.5">
                    {formatDateTime(task.created_at)}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-400 text-xs uppercase">Due Date</dt>
                  <dd className="text-white text-sm mt-0.5">
                    {formatDate(task.due_date)}
                  </dd>
                </div>
                {task.completed_at && (
                  <div>
                    <dt className="text-gray-400 text-xs uppercase">
                      Completed
                    </dt>
                    <dd className="text-green-400 text-sm mt-0.5">
                      {formatDateTime(task.completed_at)}
                    </dd>
                  </div>
                )}
                {task.updated_at && (
                  <div>
                    <dt className="text-gray-400 text-xs uppercase">
                      Last Updated
                    </dt>
                    <dd className="text-white text-sm mt-0.5">
                      {formatDateTime(task.updated_at)}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </Card>

          {/* People */}
          <Card>
            <div className="p-6">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                People
              </h2>
              <dl className="space-y-4">
                <div>
                  <dt className="text-gray-400 text-xs uppercase">
                    Assigned To
                  </dt>
                  <dd className="text-white text-sm mt-0.5">
                    {task.assigned_user ? (
                      `${task.assigned_user.full_name} (${task.assigned_user.role})`
                    ) : task.assigned_client ? (
                      `${task.assigned_client.full_name} — Client`
                    ) : (
                      <span className="text-gray-500 italic">Unassigned</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-400 text-xs uppercase">
                    Reported By
                  </dt>
                  <dd className="text-white text-sm mt-0.5">
                    {task.reported_user ? (
                      `${task.reported_user.full_name} (${task.reported_user.role})`
                    ) : task.reported_client ? (
                      `${task.reported_client.full_name} — Client`
                    ) : (
                      <span className="text-gray-500 italic">Not recorded</span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          </Card>

          {/* Cost */}
          {(task.estimated_cost !== null || task.actual_cost !== null) && (
            <Card>
              <div className="p-6">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                  Cost (EUR)
                </h2>
                <dl className="space-y-3">
                  {task.estimated_cost !== null && (
                    <div>
                      <dt className="text-gray-400 text-xs uppercase">
                        Estimated
                      </dt>
                      <dd className="text-white text-sm mt-0.5">
                        €{Number(task.estimated_cost).toFixed(2)}
                      </dd>
                    </div>
                  )}
                  {task.actual_cost !== null && (
                    <div>
                      <dt className="text-gray-400 text-xs uppercase">
                        Actual
                      </dt>
                      <dd className="text-green-400 text-sm mt-0.5">
                        €{Number(task.actual_cost).toFixed(2)}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <Card className="border border-red-900/50">
        <div className="p-6">
          <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-2">
            Danger Zone
          </h2>
          <p className="text-gray-400 text-sm mb-4">
            Permanently delete this task. This action cannot be undone.
          </p>
          <DeleteTaskButton taskId={task.id} deleteAction={deleteTask} />
        </div>
      </Card>
    </div>
  );
}

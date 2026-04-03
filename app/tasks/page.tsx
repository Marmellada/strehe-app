import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

type TaskRow = {
  id: string;
  title: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  assigned_user_id: string | null;
  property_id: string | null;
  subscription_id: string | null;
  created_at: string | null;
};

type AppUserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
};

type FilterParams = {
  status?: string;
  priority?: string;
  assigned?: string;
  due?: string;
};

function formatDate(dateString: string | null) {
  if (!dateString) return "-";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatLabel(value: string | null) {
  if (!value) return "-";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getStatusClasses(status: string | null) {
  switch (status) {
    case "open":
      return "bg-blue-50 text-blue-700 border border-blue-200";
    case "in_progress":
      return "bg-amber-50 text-amber-700 border border-amber-200";
    case "blocked":
      return "bg-red-50 text-red-700 border border-red-200";
    case "completed":
      return "bg-green-50 text-green-700 border border-green-200";
    default:
      return "bg-gray-50 text-gray-700 border border-gray-200";
  }
}

function getPriorityClasses(priority: string | null) {
  switch (priority) {
    case "urgent":
      return "bg-red-50 text-red-700 border border-red-200";
    case "high":
      return "bg-orange-50 text-orange-700 border border-orange-200";
    case "medium":
      return "bg-blue-50 text-blue-700 border border-blue-200";
    case "low":
      return "bg-gray-50 text-gray-700 border border-gray-200";
    default:
      return "bg-gray-50 text-gray-700 border border-gray-200";
  }
}

function getDueFilterCondition(due: string, query: ReturnType<typeof createClient> extends Promise<infer T> ? any : any) {
  return query;
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams?: Promise<FilterParams>;
}) {
  const params = (await searchParams) || {};

  const { authUser, appUser } = await requireRole([
    "admin",
    "office",
    "field",
    "contractor",
  ]);

  const supabase = await createClient();

  const today = new Date().toISOString().slice(0, 10);

  let query = supabase
    .from("tasks")
    .select(
      "id, title, status, priority, due_date, assigned_user_id, property_id, subscription_id, created_at"
    )
    .order("created_at", { ascending: false });

  if (appUser.role === "field" || appUser.role === "contractor") {
    query = query.eq("assigned_user_id", authUser.id);
  }

  if (params.status) {
    query = query.eq("status", params.status);
  }

  if (params.priority) {
    query = query.eq("priority", params.priority);
  }

  if (params.assigned === "me") {
    query = query.eq("assigned_user_id", authUser.id);
  }

  if (params.assigned === "unassigned") {
    query = query.is("assigned_user_id", null);
  }

  if (params.due === "overdue") {
    query = query.lt("due_date", today).neq("status", "completed");
  }

  if (params.due === "today") {
    query = query.eq("due_date", today);
  }

  if (params.due === "upcoming") {
    query = query.gt("due_date", today);
  }

  const { data: tasks, error } = await query;

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-red-500 font-bold mb-2">Tasks Error</h1>
        <pre className="text-sm bg-gray-900 text-white p-4 rounded overflow-auto">
          {JSON.stringify(error, null, 2)}
        </pre>
      </div>
    );
  }

  const typedTasks: TaskRow[] = (tasks || []) as TaskRow[];

  const assignedUserIds = Array.from(
    new Set(
      typedTasks
        .map((task) => task.assigned_user_id)
        .filter((value): value is string => Boolean(value))
    )
  );

  let assigneeMap = new Map<string, string>();

  if (assignedUserIds.length > 0) {
    const { data: assignees, error: assigneesError } = await supabase
      .from("app_users")
      .select("id, email, full_name")
      .in("id", assignedUserIds);

    if (assigneesError) {
      return (
        <div className="p-8">
          <h1 className="text-red-500 font-bold mb-2">Assignee Load Error</h1>
          <pre className="text-sm bg-gray-900 text-white p-4 rounded overflow-auto">
            {JSON.stringify(assigneesError, null, 2)}
          </pre>
        </div>
      );
    }

    assigneeMap = new Map(
      ((assignees || []) as AppUserRow[]).map((user) => [
        user.id,
        user.full_name?.trim() || user.email || "Unnamed User",
      ])
    );
  }

  const canCreate = appUser.role === "admin" || appUser.role === "office";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Tasks</h1>
          <p className="page-subtitle">Manage operational work</p>
          <p className="page-subtitle mt-1">
            Signed in as: <strong>{appUser.role}</strong>
          </p>
        </div>

        {canCreate ? (
          <Link href="/tasks/create" className="btn">
            + New Task
          </Link>
        ) : null}
      </div>

      <div className="card p-4">
        <form className="grid grid-cols-1 md:grid-cols-4 xl:grid-cols-5 gap-4">
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-300 mb-1.5">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={params.status || ""}
              className="input"
            >
              <option value="">All</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="blocked">Blocked</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div>
            <label htmlFor="priority" className="block text-sm font-medium text-gray-300 mb-1.5">
              Priority
            </label>
            <select
              id="priority"
              name="priority"
              defaultValue={params.priority || ""}
              className="input"
            >
              <option value="">All</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div>
            <label htmlFor="assigned" className="block text-sm font-medium text-gray-300 mb-1.5">
              Assigned
            </label>
            <select
              id="assigned"
              name="assigned"
              defaultValue={params.assigned || ""}
              className="input"
            >
              <option value="">All</option>
              <option value="me">My Tasks</option>
              <option value="unassigned">Unassigned</option>
            </select>
          </div>

          <div>
            <label htmlFor="due" className="block text-sm font-medium text-gray-300 mb-1.5">
              Due
            </label>
            <select
              id="due"
              name="due"
              defaultValue={params.due || ""}
              className="input"
            >
              <option value="">All</option>
              <option value="overdue">Overdue</option>
              <option value="today">Today</option>
              <option value="upcoming">Upcoming</option>
            </select>
          </div>

          <div className="flex items-end gap-3">
            <button type="submit" className="btn">
              Apply
            </button>
            <Link href="/tasks" className="btn btn-secondary">
              Reset
            </Link>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Source</th>
                <th>Assigned To</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Due Date</th>
              </tr>
            </thead>
            <tbody>
              {typedTasks.map((task) => {
                const isMyTask = task.assigned_user_id === authUser.id;
                const isAutoTask = Boolean(task.subscription_id);
                const assignedTo = task.assigned_user_id
                  ? assigneeMap.get(task.assigned_user_id) || "Unknown User"
                  : "Unassigned";

                return (
                  <tr key={task.id}>
                    <td>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/tasks/${task.id}`}>
                          {task.title || "-"}
                        </Link>

                        {isMyTask ? (
                          <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                            My Task
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200">
                        {isAutoTask ? "Subscription" : "Manual"}
                      </span>
                    </td>
                    <td>{assignedTo}</td>
                    <td>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClasses(
                          task.status
                        )}`}
                      >
                        {formatLabel(task.status)}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getPriorityClasses(
                          task.priority
                        )}`}
                      >
                        {formatLabel(task.priority)}
                      </span>
                    </td>
                    <td>{formatDate(task.due_date)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {typedTasks.length === 0 && (
            <div className="empty-state">No tasks found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
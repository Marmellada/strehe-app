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
};

type AppUserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
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

export default async function TasksPage() {
  const { authUser, appUser } = await requireRole([
    "admin",
    "office",
    "field",
    "contractor",
  ]);

  const supabase = await createClient();

  let query = supabase
    .from("tasks")
    .select("id, title, status, priority, due_date, assigned_user_id, created_at")
    .order("created_at", { ascending: false });

  if (appUser.role === "field" || appUser.role === "contractor") {
    query = query.eq("assigned_user_id", authUser.id);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Tasks</h1>
          <p className="page-subtitle">Manage operational work</p>
          <p className="page-subtitle mt-1">
            Signed in as: <strong>{appUser.role}</strong>
          </p>
        </div>

        {(appUser.role === "admin" || appUser.role === "office") ? (
          <Link href="/tasks/create" className="btn">
            + New Task
          </Link>
        ) : null}
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Assigned To</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Due Date</th>
              </tr>
            </thead>
            <tbody>
              {typedTasks.map((task) => {
                const isMyTask = task.assigned_user_id === authUser.id;
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
                    <td>{assignedTo}</td>
                    <td>{formatLabel(task.status)}</td>
                    <td>{formatLabel(task.priority)}</td>
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
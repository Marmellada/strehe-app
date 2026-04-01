import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function TasksPage() {
  const supabase = await createClient();

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("id, title, status, priority, due_date")
    .order("created_at", { ascending: false });

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
                <th>Status</th>
                <th>Priority</th>
                <th>Due Date</th>
              </tr>
            </thead>
            <tbody>
              {tasks?.map((task: any) => (
                <tr key={task.id}>
                  <td>
                    <Link href={`/tasks/${task.id}`}>
                      {task.title || "-"}
                    </Link>
                  </td>
                  <td>{task.status || "-"}</td>
                  <td>{task.priority || "-"}</td>
                  <td>{task.due_date || "-"}</td>
                </tr>
              ))}
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

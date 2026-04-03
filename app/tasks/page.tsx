import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import TasksRememberFilters from "@/components/tasks/TasksRememberFilters";

const PAGE_SIZE = 20;

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

type PropertyRow = {
  id: string;
  property_code: string | null;
  title: string | null;
};

type FilterParams = {
  status?: string;
  priority?: string;
  assigned?: string;
  due?: string;
  search?: string;
  property?: string;
  assignee_id?: string;
  source?: string;
  page?: string;
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
      return "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200";
    case "in_progress":
      return "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200";
    case "blocked":
      return "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-red-50 text-red-700 border border-red-200";
    case "completed":
      return "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-green-50 text-green-700 border border-green-200";
    default:
      return "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200";
  }
}

function getPriorityClasses(priority: string | null) {
  switch (priority) {
    case "urgent":
      return "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-red-50 text-red-700 border border-red-200";
    case "high":
      return "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200";
    case "medium":
      return "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200";
    case "low":
      return "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200";
    default:
      return "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200";
  }
}

function getSourceClasses(isAutoTask: boolean) {
  return isAutoTask
    ? "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200"
    : "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200";
}

function buildQueryString(
  params: FilterParams,
  overrides: Partial<FilterParams> = {}
) {
  const merged: FilterParams = {
    ...params,
    ...overrides,
  };

  const search = new URLSearchParams();

  const entries = Object.entries(merged) as Array<[keyof FilterParams, string | undefined]>;
  for (const [key, value] of entries) {
    if (value && value.trim() !== "") {
      search.set(key, value);
    }
  }

  const query = search.toString();
  return query ? `/tasks?${query}` : "/tasks";
}

function getKpiCardClasses(active: boolean, tone: "default" | "danger" = "default") {
  if (active && tone === "danger") {
    return "card p-4 ring-2 ring-red-500 border-red-300 bg-red-50/50";
  }

  if (active) {
    return "card p-4 ring-2 ring-blue-500 border-blue-300 bg-blue-50/40";
  }

  return "card p-4 hover:border-gray-300 transition";
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
  const canCreate = appUser.role === "admin" || appUser.role === "office";
  const canUseAdminAssigneeFilter =
    appUser.role === "admin" || appUser.role === "office";

  const currentPage = Math.max(Number(params.page || "1") || 1, 1);
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("tasks")
    .select(
      "id, title, status, priority, due_date, assigned_user_id, property_id, subscription_id, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (appUser.role === "field" || appUser.role === "contractor") {
    query = query.eq("assigned_user_id", authUser.id);
  }

  if (params.status) query = query.eq("status", params.status);
  if (params.priority) query = query.eq("priority", params.priority);

  if (params.assigned === "me") {
    query = query.eq("assigned_user_id", authUser.id);
  }

  if (params.assigned === "unassigned") {
    query = query.is("assigned_user_id", null);
  }

  if (params.property) {
    query = query.eq("property_id", params.property);
  }

  if (params.search) {
    query = query.ilike("title", `%${params.search}%`);
  }

  if (canUseAdminAssigneeFilter && params.assignee_id) {
    query = query.eq("assigned_user_id", params.assignee_id);
  }

  if (params.source === "manual") {
    query = query.is("subscription_id", null);
  }

  if (params.source === "subscription") {
    query = query.not("subscription_id", "is", null);
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

  const { data: tasks, error, count } = await query.range(from, to);

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
  const total = count || 0;
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  const assignedUserIds = Array.from(
    new Set(
      typedTasks
        .map((task) => task.assigned_user_id)
        .filter((value): value is string => Boolean(value))
    )
  );

  const propertyIds = Array.from(
    new Set(
      typedTasks
        .map((task) => task.property_id)
        .filter((value): value is string => Boolean(value))
    )
  );

  let assigneeMap = new Map<string, string>();
  let propertyMap = new Map<string, string>();

  const [assigneeResult, propertyResult, allUsersResult, allPropertiesResult] =
    await Promise.all([
      assignedUserIds.length > 0
        ? supabase
            .from("app_users")
            .select("id, email, full_name")
            .in("id", assignedUserIds)
        : Promise.resolve({ data: [], error: null }),
      propertyIds.length > 0
        ? supabase
            .from("properties")
            .select("id, property_code, title")
            .in("id", propertyIds)
        : Promise.resolve({ data: [], error: null }),
      canUseAdminAssigneeFilter
        ? supabase
            .from("app_users")
            .select("id, email, full_name")
            .eq("is_active", true)
            .order("full_name", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("properties")
        .select("id, property_code, title")
        .order("property_code", { ascending: true }),
    ]);

  if (assigneeResult.error) {
    return (
      <div className="p-8">
        <h1 className="text-red-500 font-bold mb-2">Assignee Load Error</h1>
        <pre className="text-sm bg-gray-900 text-white p-4 rounded overflow-auto">
          {JSON.stringify(assigneeResult.error, null, 2)}
        </pre>
      </div>
    );
  }

  if (propertyResult.error) {
    return (
      <div className="p-8">
        <h1 className="text-red-500 font-bold mb-2">Property Load Error</h1>
        <pre className="text-sm bg-gray-900 text-white p-4 rounded overflow-auto">
          {JSON.stringify(propertyResult.error, null, 2)}
        </pre>
      </div>
    );
  }

  if (allUsersResult.error) {
    return (
      <div className="p-8">
        <h1 className="text-red-500 font-bold mb-2">Users Load Error</h1>
        <pre className="text-sm bg-gray-900 text-white p-4 rounded overflow-auto">
          {JSON.stringify(allUsersResult.error, null, 2)}
        </pre>
      </div>
    );
  }

  if (allPropertiesResult.error) {
    return (
      <div className="p-8">
        <h1 className="text-red-500 font-bold mb-2">Properties Load Error</h1>
        <pre className="text-sm bg-gray-900 text-white p-4 rounded overflow-auto">
          {JSON.stringify(allPropertiesResult.error, null, 2)}
        </pre>
      </div>
    );
  }

  assigneeMap = new Map(
    ((assigneeResult.data || []) as AppUserRow[]).map((user) => [
      user.id,
      user.full_name?.trim() || user.email || "Unnamed User",
    ])
  );

  propertyMap = new Map(
    ((propertyResult.data || []) as PropertyRow[]).map((property) => [
      property.id,
      [property.property_code, property.title].filter(Boolean).join(" — ") ||
        "Unknown Property",
    ])
  );

  const allUsers = (allUsersResult.data || []) as AppUserRow[];
  const allProperties = (allPropertiesResult.data || []) as PropertyRow[];

  const openCount = typedTasks.filter((task) => task.status === "open").length;
  const inProgressCount = typedTasks.filter(
    (task) => task.status === "in_progress"
  ).length;
  const blockedCount = typedTasks.filter(
    (task) => task.status === "blocked"
  ).length;
  const completedCount = typedTasks.filter(
    (task) => task.status === "completed"
  ).length;
  const overdueCount = typedTasks.filter(
    (task) => task.due_date && task.due_date < today && task.status !== "completed"
  ).length;
  const unassignedCount = typedTasks.filter(
    (task) => !task.assigned_user_id
  ).length;
  const manualCount = typedTasks.filter(
    (task) => !task.subscription_id
  ).length;
  const subscriptionCount = typedTasks.filter(
    (task) => Boolean(task.subscription_id)
  ).length;

  const openHref = buildQueryString(params, {
    status: "open",
    due: undefined,
    source: undefined,
    assigned: undefined,
    assignee_id: undefined,
    page: "1",
  });

  const inProgressHref = buildQueryString(params, {
    status: "in_progress",
    due: undefined,
    source: undefined,
    assigned: undefined,
    assignee_id: undefined,
    page: "1",
  });

  const blockedHref = buildQueryString(params, {
    status: "blocked",
    due: undefined,
    source: undefined,
    assigned: undefined,
    assignee_id: undefined,
    page: "1",
  });

  const completedHref = buildQueryString(params, {
    status: "completed",
    due: undefined,
    source: undefined,
    assigned: undefined,
    assignee_id: undefined,
    page: "1",
  });

  const overdueHref = buildQueryString(params, {
    due: "overdue",
    status: undefined,
    page: "1",
  });

  const unassignedHref = buildQueryString(params, {
    assigned: "unassigned",
    assignee_id: undefined,
    page: "1",
  });

  const manualHref = buildQueryString(params, {
    source: "manual",
    page: "1",
  });

  const subscriptionHref = buildQueryString(params, {
    source: "subscription",
    page: "1",
  });

  return (
    <div className="space-y-6">
      <TasksRememberFilters />
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Tasks</h1>
          <p className="page-subtitle">
            Operations dashboard for manual and subscription work
          </p>
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

      <div className="flex flex-wrap gap-2">
        <Link href="/tasks" className="btn btn-secondary">
          All
        </Link>
        <Link href="/tasks?status=open" className="btn btn-secondary">
          Open
        </Link>
        <Link href="/tasks?due=overdue" className="btn btn-secondary">
          Overdue
        </Link>
        <Link href="/tasks?status=completed" className="btn btn-secondary">
          Completed
        </Link>
        <Link href="/tasks?source=manual" className="btn btn-secondary">
          Manual
        </Link>
        <Link href="/tasks?source=subscription" className="btn btn-secondary">
          Subscription
        </Link>
        <Link href="/tasks?assigned=me" className="btn btn-secondary">
          My Tasks
        </Link>
        <Link href="/tasks?assigned=unassigned" className="btn btn-secondary">
          Unassigned
        </Link>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Link href={openHref} className={getKpiCardClasses(params.status === "open")}>
          <div className="text-xs uppercase tracking-wide text-gray-500">Open</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">{openCount}</div>
        </Link>

        <Link
          href={inProgressHref}
          className={getKpiCardClasses(params.status === "in_progress")}
        >
          <div className="text-xs uppercase tracking-wide text-gray-500">In Progress</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">{inProgressCount}</div>
        </Link>

        <Link
          href={blockedHref}
          className={getKpiCardClasses(params.status === "blocked")}
        >
          <div className="text-xs uppercase tracking-wide text-gray-500">Blocked</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">{blockedCount}</div>
        </Link>

        <Link
          href={completedHref}
          className={getKpiCardClasses(params.status === "completed")}
        >
          <div className="text-xs uppercase tracking-wide text-gray-500">Completed</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">{completedCount}</div>
        </Link>

        <Link
          href={overdueHref}
          className={getKpiCardClasses(params.due === "overdue", "danger")}
        >
          <div className="text-xs uppercase tracking-wide text-gray-500">Overdue</div>
          <div className="mt-2 text-2xl font-semibold text-red-600">{overdueCount}</div>
        </Link>

        <Link
          href={unassignedHref}
          className={getKpiCardClasses(params.assigned === "unassigned")}
        >
          <div className="text-xs uppercase tracking-wide text-gray-500">Unassigned</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">{unassignedCount}</div>
        </Link>

        <Link
          href={manualHref}
          className={getKpiCardClasses(params.source === "manual")}
        >
          <div className="text-xs uppercase tracking-wide text-gray-500">Manual</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">{manualCount}</div>
        </Link>

        <Link
          href={subscriptionHref}
          className={getKpiCardClasses(params.source === "subscription")}
        >
          <div className="text-xs uppercase tracking-wide text-gray-500">Subscription</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">{subscriptionCount}</div>
        </Link>
      </div>

      <div className="card p-4">
        <form className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-7 gap-4">
          <div className="xl:col-span-2">
            <label
              htmlFor="search"
              className="block text-sm font-medium text-gray-300 mb-1.5"
            >
              Search
            </label>
            <input
              id="search"
              name="search"
              placeholder="Search title..."
              defaultValue={params.search || ""}
              className="input"
            />
          </div>

          <div>
            <label
              htmlFor="status"
              className="block text-sm font-medium text-gray-300 mb-1.5"
            >
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={params.status || ""}
              className="input"
            >
              <option value="">All Status</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="blocked">Blocked</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="priority"
              className="block text-sm font-medium text-gray-300 mb-1.5"
            >
              Priority
            </label>
            <select
              id="priority"
              name="priority"
              defaultValue={params.priority || ""}
              className="input"
            >
              <option value="">All Priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="due"
              className="block text-sm font-medium text-gray-300 mb-1.5"
            >
              Due
            </label>
            <select
              id="due"
              name="due"
              defaultValue={params.due || ""}
              className="input"
            >
              <option value="">All Due</option>
              <option value="overdue">Overdue</option>
              <option value="today">Today</option>
              <option value="upcoming">Upcoming</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="source"
              className="block text-sm font-medium text-gray-300 mb-1.5"
            >
              Source
            </label>
            <select
              id="source"
              name="source"
              defaultValue={params.source || ""}
              className="input"
            >
              <option value="">All Sources</option>
              <option value="manual">Manual</option>
              <option value="subscription">Subscription</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="property"
              className="block text-sm font-medium text-gray-300 mb-1.5"
            >
              Property
            </label>
            <select
              id="property"
              name="property"
              defaultValue={params.property || ""}
              className="input"
            >
              <option value="">All Properties</option>
              {allProperties.map((property) => (
                <option key={property.id} value={property.id}>
                  {[property.property_code, property.title]
                    .filter(Boolean)
                    .join(" — ")}
                </option>
              ))}
            </select>
          </div>

          {canUseAdminAssigneeFilter ? (
            <div>
              <label
                htmlFor="assignee_id"
                className="block text-sm font-medium text-gray-300 mb-1.5"
              >
                Assignee
              </label>
              <select
                id="assignee_id"
                name="assignee_id"
                defaultValue={params.assignee_id || ""}
                className="input"
              >
                <option value="">All Assignees</option>
                {allUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name?.trim() || user.email || "Unnamed User"}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label
                htmlFor="assigned"
                className="block text-sm font-medium text-gray-300 mb-1.5"
              >
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
          )}

          <input type="hidden" name="page" value="1" />

          <div className="xl:col-span-7 flex items-end gap-3">
            <button type="submit" className="btn">
              Apply Filters
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
                <th>Property</th>
                <th>Source</th>
                <th>Assigned</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {typedTasks.map((task) => {
                const isMyTask = task.assigned_user_id === authUser.id;
                const isAutoTask = Boolean(task.subscription_id);
                const isOverdue =
                  Boolean(task.due_date) &&
                  task.due_date! < today &&
                  task.status !== "completed";

                const assignedTo = task.assigned_user_id
                  ? assigneeMap.get(task.assigned_user_id) || "Unknown User"
                  : "Unassigned";

                const propertyLabel = task.property_id
                  ? propertyMap.get(task.property_id) || "Unknown Property"
                  : "-";

                return (
                  <tr key={task.id} className={isOverdue ? "bg-red-50/40" : ""}>
                    <td>
                      <div className="flex gap-2 items-center flex-wrap">
                        <Link href={`/tasks/${task.id}`}>
                          {task.title || "-"}
                        </Link>

                        {isMyTask ? (
                          <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                            My Task
                          </span>
                        ) : null}

                        {isOverdue ? (
                          <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                            Overdue
                          </span>
                        ) : null}
                      </div>
                    </td>

                    <td>{propertyLabel}</td>

                    <td>
                      <span className={getSourceClasses(isAutoTask)}>
                        {isAutoTask ? "Subscription" : "Manual"}
                      </span>
                    </td>

                    <td>{assignedTo}</td>

                    <td>
                      <span className={getStatusClasses(task.status)}>
                        {formatLabel(task.status)}
                      </span>
                    </td>

                    <td>
                      <span className={getPriorityClasses(task.priority)}>
                        {formatLabel(task.priority)}
                      </span>
                    </td>

                    <td>{formatDate(task.due_date)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {typedTasks.length === 0 ? (
            <div className="empty-state">No tasks found.</div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-gray-200 px-4 py-4">
          <div className="text-sm text-gray-500">
            Showing <strong>{total === 0 ? 0 : from + 1}</strong> to{" "}
            <strong>{Math.min(to + 1, total)}</strong> of{" "}
            <strong>{total}</strong> tasks
          </div>

          <div className="flex items-center gap-2">
            {currentPage > 1 ? (
              <Link
                href={buildQueryString(params, {
                  page: String(currentPage - 1),
                })}
                className="btn btn-secondary"
              >
                Prev
              </Link>
            ) : (
              <span className="btn btn-secondary opacity-50 pointer-events-none">
                Prev
              </span>
            )}

            <span className="text-sm text-gray-500">
              Page {currentPage} / {totalPages}
            </span>

            {currentPage < totalPages ? (
              <Link
                href={buildQueryString(params, {
                  page: String(currentPage + 1),
                })}
                className="btn btn-secondary"
              >
                Next
              </Link>
            ) : (
              <span className="btn btn-secondary opacity-50 pointer-events-none">
                Next
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
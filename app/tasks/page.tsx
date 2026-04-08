import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import TasksRememberFilters from "@/components/tasks/TasksRememberFilters";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { getStatusVariant, formatStatusLabel } from "@/lib/ui/status";

const PAGE_SIZE = 20;

type TaskRow = {
  id: string;
  title: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  assigned_user_id: string | null;
  assigned_user_name_snapshot: string | null;
  property_id: string | null;
  property_code_snapshot: string | null;
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

function getPriorityVariant(priority: string | null) {
  switch (priority) {
    case "urgent":
      return "danger";
    case "high":
      return "warning";
    case "medium":
      return "info";
    case "low":
      return "neutral";
    default:
      return "neutral";
  }
}

function getSourceVariant(isAutoTask: boolean) {
  return isAutoTask ? "info" : "neutral";
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

  const entries = Object.entries(merged) as Array<
    [keyof FilterParams, string | undefined]
  >;

  for (const [key, value] of entries) {
    if (value && value.trim() !== "") {
      search.set(key, value);
    }
  }

  const query = search.toString();
  return query ? `/tasks?${query}` : "/tasks";
}

function getKpiCardClasses(
  active: boolean,
  tone: "default" | "danger" = "default"
) {
  if (active && tone === "danger") {
    return "rounded-2xl border p-4 transition ring-2";
  }

  if (active) {
    return "rounded-2xl border border-blue-300 bg-blue-50/40 p-4 ring-2 ring-blue-500 transition";
  }

  return "rounded-2xl border bg-card p-4 transition hover:border-muted-foreground/30 hover:bg-muted/20";
}

function getSavedViewClasses(active: boolean) {
  return active ? "btn" : "btn btn-secondary";
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
      "id, title, status, priority, due_date, assigned_user_id, assigned_user_name_snapshot, property_id, property_code_snapshot, subscription_id, created_at",
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
        <h1 className="mb-2 text-lg font-semibold text-red-600">Tasks Error</h1>
        <pre className="overflow-auto rounded-xl border bg-muted p-4 text-sm text-foreground">
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
        <h1 className="mb-2 text-lg font-semibold text-red-600">
          Assignee Load Error
        </h1>
        <pre className="overflow-auto rounded-xl border bg-muted p-4 text-sm text-foreground">
          {JSON.stringify(assigneeResult.error, null, 2)}
        </pre>
      </div>
    );
  }

  if (propertyResult.error) {
    return (
      <div className="p-8">
        <h1 className="mb-2 text-lg font-semibold text-red-600">
          Property Load Error
        </h1>
        <pre className="overflow-auto rounded-xl border bg-muted p-4 text-sm text-foreground">
          {JSON.stringify(propertyResult.error, null, 2)}
        </pre>
      </div>
    );
  }

  if (allUsersResult.error) {
    return (
      <div className="p-8">
        <h1 className="mb-2 text-lg font-semibold text-red-600">
          Users Load Error
        </h1>
        <pre className="overflow-auto rounded-xl border bg-muted p-4 text-sm text-foreground">
          {JSON.stringify(allUsersResult.error, null, 2)}
        </pre>
      </div>
    );
  }

  if (allPropertiesResult.error) {
    return (
      <div className="p-8">
        <h1 className="mb-2 text-lg font-semibold text-red-600">
          Properties Load Error
        </h1>
        <pre className="overflow-auto rounded-xl border bg-muted p-4 text-sm text-foreground">
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
    (task) =>
      task.due_date && task.due_date < today && task.status !== "completed"
  ).length;
  const unassignedCount = typedTasks.filter(
    (task) => !task.assigned_user_id
  ).length;
  const manualCount = typedTasks.filter((task) => !task.subscription_id).length;
  const subscriptionCount = typedTasks.filter((task) =>
    Boolean(task.subscription_id)
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

  const operationsHref = "/tasks?status=open&due=overdue";
  const myWorkHref = "/tasks?assigned=me";
  const backlogHref = "/tasks?status=open&assigned=unassigned&source=manual";

  const operationsActive =
    params.status === "open" && params.due === "overdue";
  const myWorkActive = params.assigned === "me";
  const backlogActive =
    params.status === "open" &&
    params.assigned === "unassigned" &&
    params.source === "manual";

  return (
    <div className="space-y-6">
      <TasksRememberFilters />

      <PageHeader
        title="Tasks"
        description="Operations dashboard for manual and subscription work."
        actions={
          canCreate ? (
            <Link href="/tasks/create">
              <Button>New Task</Button>
            </Link>
          ) : null
        }
      />

      <div className="rounded-2xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        Signed in as: <span className="font-medium text-foreground">{appUser.role}</span>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Saved Views
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href={operationsHref} className={getSavedViewClasses(operationsActive)}>
            Operations
          </Link>

          <Link href={myWorkHref} className={getSavedViewClasses(myWorkActive)}>
            My Work
          </Link>

          <Link href={backlogHref} className={getSavedViewClasses(backlogActive)}>
            Backlog
          </Link>
        </div>
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

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Link
          href={openHref}
          className={getKpiCardClasses(params.status === "open")}
        >
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Open
          </div>
          <div className="mt-2 text-2xl font-semibold text-foreground">
            {openCount}
          </div>
        </Link>

        <Link
          href={inProgressHref}
          className={getKpiCardClasses(params.status === "in_progress")}
        >
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            In Progress
          </div>
          <div className="mt-2 text-2xl font-semibold text-foreground">
            {inProgressCount}
          </div>
        </Link>

        <Link
          href={blockedHref}
          className={getKpiCardClasses(params.status === "blocked")}
        >
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Blocked
          </div>
          <div className="mt-2 text-2xl font-semibold text-foreground">
            {blockedCount}
          </div>
        </Link>

        <Link
          href={completedHref}
          className={getKpiCardClasses(params.status === "completed")}
        >
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Completed
          </div>
          <div className="mt-2 text-2xl font-semibold text-foreground">
            {completedCount}
          </div>
        </Link>

        <Link
          href={overdueHref}
          className={getKpiCardClasses(params.due === "overdue", "danger")}
        >
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Overdue
          </div>
          <div className="mt-2 text-2xl font-semibold" style={{ color: "var(--brand-danger)" }}>
            {overdueCount}
          </div>
        </Link>

        <Link
          href={unassignedHref}
          className={getKpiCardClasses(params.assigned === "unassigned")}
        >
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Unassigned
          </div>
          <div className="mt-2 text-2xl font-semibold text-foreground">
            {unassignedCount}
          </div>
        </Link>

        <Link
          href={manualHref}
          className={getKpiCardClasses(params.source === "manual")}
        >
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Manual
          </div>
          <div className="mt-2 text-2xl font-semibold text-foreground">
            {manualCount}
          </div>
        </Link>

        <Link
          href={subscriptionHref}
          className={getKpiCardClasses(params.source === "subscription")}
        >
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Subscription
          </div>
          <div className="mt-2 text-2xl font-semibold text-foreground">
            {subscriptionCount}
          </div>
        </Link>
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-7">
          <div className="xl:col-span-2">
            <label
              htmlFor="search"
              className="mb-1.5"
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
              className="mb-1.5"
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
              className="mb-1.5"
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
              className="mb-1.5"
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
              className="mb-1.5"
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
              className="mb-1.5"
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
                className="mb-1.5"
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
                className="mb-1.5"
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

          <div className="flex items-end gap-3 xl:col-span-7">
            <button type="submit">
              Apply Filters
            </button>
            <Link href="/tasks">
  <Button variant="outline">Reset</Button>
</Link>
          </div>
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card">
        {typedTasks.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No tasks found"
              description="Try adjusting your filters or create a new task to get started."
              action={
                canCreate ? (
                  <Link href="/tasks/create">
                    <Button>New Task</Button>
                  </Link>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr className="border-b">
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Title
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Property
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Source
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Assigned
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Priority
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Due
                  </th>
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
                    ? task.assigned_user_name_snapshot ||
                      assigneeMap.get(task.assigned_user_id) ||
                      "Unknown User"
                    : "Unassigned";

                  const propertyLabel = task.property_code_snapshot
                    ? task.property_code_snapshot
                    : task.property_id
                    ? propertyMap.get(task.property_id) || "Unknown Property"
                    : "-";

                  return (
                    <tr
                      key={task.id}
                      className={`border-b transition-colors hover:bg-muted/30 last:border-none ${
                        isOverdue ? "bg-red-50/30" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/tasks/${task.id}`}
                            className="font-medium text-foreground hover:underline"
                          >
                            {task.title || "-"}
                          </Link>

                          {isMyTask ? (
                            <Badge variant="info">My Task</Badge>
                          ) : null}

                          {isOverdue ? (
                            <Badge variant="danger">Overdue</Badge>
                          ) : null}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-muted-foreground">
                        {propertyLabel}
                      </td>

                      <td className="px-4 py-3">
                        <Badge variant={getSourceVariant(isAutoTask)}>
                          {isAutoTask ? "Subscription" : "Manual"}
                        </Badge>
                      </td>

                      <td className="px-4 py-3 text-muted-foreground">
                        {assignedTo}
                      </td>

                      <td className="px-4 py-3">
                        <Badge variant={getStatusVariant(task.status)}>
                          {formatStatusLabel(task.status)}
                        </Badge>
                      </td>

                      <td className="px-4 py-3">
                        <Badge variant={getPriorityVariant(task.priority)}>
                          {formatLabel(task.priority)}
                        </Badge>
                      </td>

                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(task.due_date)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 border-t px-4 py-4">
          <div className="text-sm text-muted-foreground">
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
              <span className="pointer-events-none btn btn-secondary opacity-50">
                Prev
              </span>
            )}

            <span className="text-sm text-muted-foreground">
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
              <span className="pointer-events-none btn btn-secondary opacity-50">
                Next
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

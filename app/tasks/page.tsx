import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import TasksRememberFilters from "@/components/tasks/TasksRememberFilters";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
} from "@/components/ui/Table";
import { getStatusVariant, formatStatusLabel } from "@/lib/ui/status";
import { createPerfTimer } from "@/lib/perf";

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

const nativeSelectClassName =
  "flex h-10 w-full items-center justify-between rounded-md border border-[var(--select-border)] bg-[var(--select-bg)] px-3 py-2 text-sm text-[var(--select-text)] ring-offset-background focus:outline-none focus:ring-2 focus:ring-[var(--select-ring-color)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export default async function TasksPage({
  searchParams,
}: {
  searchParams?: Promise<FilterParams>;
}) {
  const perf = createPerfTimer("page.tasks");
  const params = (await searchParams) || {};
  perf.mark("resolveSearchParams");

  const { authUser, appUser } = await requireRole([
    "admin",
    "office",
    "field",
    "contractor",
  ]);
  perf.mark("requireRole");

  const supabase = await createClient();
  perf.mark("createClient");
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

  let statsQuery = supabase
    .from("tasks")
    .select(
      "id, status, priority, due_date, assigned_user_id, property_id, subscription_id, title"
    );

  if (appUser.role === "field" || appUser.role === "contractor") {
    statsQuery = statsQuery.eq("assigned_user_id", authUser.id);
  }

  if (params.priority) statsQuery = statsQuery.eq("priority", params.priority);

  if (params.assigned === "me") {
    statsQuery = statsQuery.eq("assigned_user_id", authUser.id);
  }

  if (params.assigned === "unassigned") {
    statsQuery = statsQuery.is("assigned_user_id", null);
  }

  if (params.property) {
    statsQuery = statsQuery.eq("property_id", params.property);
  }

  if (params.search) {
    statsQuery = statsQuery.ilike("title", `%${params.search}%`);
  }

  if (canUseAdminAssigneeFilter && params.assignee_id) {
    statsQuery = statsQuery.eq("assigned_user_id", params.assignee_id);
  }

  if (params.source === "manual") {
    statsQuery = statsQuery.is("subscription_id", null);
  }

  if (params.source === "subscription") {
    statsQuery = statsQuery.not("subscription_id", "is", null);
  }

  const [
    { data: tasks, error, count },
    { data: statsRows, error: statsError },
  ] = await Promise.all([query.range(from, to), statsQuery]);
  perf.mark("loadTasksAndStats");

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

  if (statsError) {
    return (
      <div className="p-8">
        <h1 className="mb-2 text-lg font-semibold text-red-600">
          Task Metrics Error
        </h1>
        <pre className="overflow-auto rounded-xl border bg-muted p-4 text-sm text-foreground">
          {JSON.stringify(statsError, null, 2)}
        </pre>
      </div>
    );
  }

  const typedTasks: TaskRow[] = (tasks || []) as TaskRow[];
  const typedTaskStats = (statsRows || []) as TaskRow[];
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
  perf.mark("loadTaskReferenceData");

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

  const openCount = typedTaskStats.filter((task) => task.status === "open").length;
  const inProgressCount = typedTaskStats.filter(
    (task) => task.status === "in_progress"
  ).length;
  const escalatedCount = typedTaskStats.filter(
    (task) => task.status === "escalated" || task.status === "blocked"
  ).length;
  const completedCount = typedTaskStats.filter(
    (task) => task.status === "completed"
  ).length;
  const overdueCount = typedTaskStats.filter(
    (task) =>
      task.due_date && task.due_date < today && task.status !== "completed"
  ).length;
  const unassignedCount = typedTaskStats.filter(
    (task) => !task.assigned_user_id
  ).length;
  const manualCount = typedTaskStats.filter((task) => !task.subscription_id).length;
  const subscriptionCount = typedTaskStats.filter((task) =>
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

  const escalatedHref = buildQueryString(params, {
    status: "escalated",
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
  const allQuickFilterActive =
    !params.status && !params.due && !params.source && !params.assigned;
  const openQuickFilterActive = params.status === "open";
  const overdueQuickFilterActive = params.due === "overdue";
  const escalatedQuickFilterActive = params.status === "escalated";
  const completedQuickFilterActive = params.status === "completed";
  const cancelledQuickFilterActive = params.status === "cancelled";
  const manualQuickFilterActive = params.source === "manual";
  const subscriptionQuickFilterActive = params.source === "subscription";
  const myTasksQuickFilterActive = params.assigned === "me";
  const unassignedQuickFilterActive = params.assigned === "unassigned";
  perf.finish({
    role: appUser.role,
    page: currentPage,
    total,
    visibleRows: typedTasks.length,
  });

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
          <Button asChild variant={operationsActive ? "default" : "secondary"} size="sm">
            <Link href={operationsHref}>Operations</Link>
          </Button>

          <Button asChild variant={myWorkActive ? "default" : "secondary"} size="sm">
            <Link href={myWorkHref}>My Work</Link>
          </Button>

          <Button asChild variant={backlogActive ? "default" : "secondary"} size="sm">
            <Link href={backlogHref}>Backlog</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant={allQuickFilterActive ? "default" : "secondary"} size="sm">
          <Link href="/tasks">All</Link>
        </Button>
        <Button asChild variant={openQuickFilterActive ? "default" : "secondary"} size="sm">
          <Link href="/tasks?status=open">Open</Link>
        </Button>
        <Button asChild variant={overdueQuickFilterActive ? "default" : "secondary"} size="sm">
          <Link href="/tasks?due=overdue">Overdue</Link>
        </Button>
        <Button asChild variant={escalatedQuickFilterActive ? "default" : "secondary"} size="sm">
          <Link href="/tasks?status=escalated">Escalated</Link>
        </Button>
        <Button asChild variant={completedQuickFilterActive ? "default" : "secondary"} size="sm">
          <Link href="/tasks?status=completed">Completed</Link>
        </Button>
        <Button asChild variant={cancelledQuickFilterActive ? "default" : "secondary"} size="sm">
          <Link href="/tasks?status=cancelled">Cancelled</Link>
        </Button>
        <Button asChild variant={manualQuickFilterActive ? "default" : "secondary"} size="sm">
          <Link href="/tasks?source=manual">Manual</Link>
        </Button>
        <Button asChild variant={subscriptionQuickFilterActive ? "default" : "secondary"} size="sm">
          <Link href="/tasks?source=subscription">Subscription</Link>
        </Button>
        <Button asChild variant={myTasksQuickFilterActive ? "default" : "secondary"} size="sm">
          <Link href="/tasks?assigned=me">My Tasks</Link>
        </Button>
        <Button asChild variant={unassignedQuickFilterActive ? "default" : "secondary"} size="sm">
          <Link href="/tasks?assigned=unassigned">Unassigned</Link>
        </Button>
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
          href={escalatedHref}
          className={getKpiCardClasses(params.status === "escalated")}
        >
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Escalated
          </div>
          <div className="mt-2 text-2xl font-semibold text-foreground">
            {escalatedCount}
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

      <Card>
        <CardContent className="pt-6">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-7">
          <div className="xl:col-span-2">
            <Label htmlFor="search" className="mb-1.5 block">
              Search
            </Label>
            <Input
              id="search"
              name="search"
              placeholder="Search title..."
              defaultValue={params.search || ""}
            />
          </div>

          <div>
            <Label htmlFor="status" className="mb-1.5 block">
              Status
            </Label>
            <select
              id="status"
              name="status"
              defaultValue={params.status || ""}
              className={nativeSelectClassName}
            >
              <option value="">All Status</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="escalated">Escalated</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <Label htmlFor="priority" className="mb-1.5 block">
              Priority
            </Label>
            <select
              id="priority"
              name="priority"
              defaultValue={params.priority || ""}
              className={nativeSelectClassName}
            >
              <option value="">All Priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div>
            <Label htmlFor="due" className="mb-1.5 block">
              Due
            </Label>
            <select
              id="due"
              name="due"
              defaultValue={params.due || ""}
              className={nativeSelectClassName}
            >
              <option value="">All Due</option>
              <option value="overdue">Overdue</option>
              <option value="today">Today</option>
              <option value="upcoming">Upcoming</option>
            </select>
          </div>

          <div>
            <Label htmlFor="source" className="mb-1.5 block">
              Source
            </Label>
            <select
              id="source"
              name="source"
              defaultValue={params.source || ""}
              className={nativeSelectClassName}
            >
              <option value="">All Sources</option>
              <option value="manual">Manual</option>
              <option value="subscription">Subscription</option>
            </select>
          </div>

          <div>
            <Label htmlFor="property" className="mb-1.5 block">
              Property
            </Label>
            <select
              id="property"
              name="property"
              defaultValue={params.property || ""}
              className={nativeSelectClassName}
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
              <Label htmlFor="assignee_id" className="mb-1.5 block">
                Assignee
              </Label>
              <select
                id="assignee_id"
                name="assignee_id"
                defaultValue={params.assignee_id || ""}
                className={nativeSelectClassName}
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
              <Label htmlFor="assigned" className="mb-1.5 block">
                Assigned
              </Label>
              <select
                id="assigned"
                name="assigned"
                defaultValue={params.assigned || ""}
                className={nativeSelectClassName}
              >
                <option value="">All</option>
                <option value="me">My Tasks</option>
                <option value="unassigned">Unassigned</option>
              </select>
            </div>
          )}

          <input type="hidden" name="page" value="1" />

          <div className="flex items-end gap-3 xl:col-span-7">
            <Button type="submit">Apply Filters</Button>
            <Button asChild variant="outline">
              <Link href="/tasks">Reset</Link>
            </Button>
          </div>
        </form>
        </CardContent>
      </Card>

      <TableShell>
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
            <Table>
              <TableHeader>
                <tr>
                  <TableHead>Title</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Due</TableHead>
                </tr>
              </TableHeader>

              <TableBody>
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
                    <TableRow
                      key={task.id}
                      className={`transition-colors hover:bg-muted/30 last:border-none ${
                        isOverdue ? "bg-red-50/30" : ""
                      }`}
                    >
                      <TableCell>
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
                      </TableCell>

                      <TableCell className="text-muted-foreground">
                        {task.property_id ? (
                          <Link
                            href={`/properties/${task.property_id}`}
                            className="hover:underline"
                          >
                            {propertyLabel}
                          </Link>
                        ) : (
                          propertyLabel
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={getSourceVariant(isAutoTask)}>
                            {isAutoTask ? "Subscription" : "Manual"}
                          </Badge>
                          {task.subscription_id ? (
                            <Link
                              href={`/subscriptions/${task.subscription_id}`}
                              className="text-xs text-muted-foreground underline"
                            >
                              Open Contract
                            </Link>
                          ) : null}
                        </div>
                      </TableCell>

                      <TableCell className="text-muted-foreground">
                        {assignedTo}
                      </TableCell>

                      <TableCell>
                        <Badge variant={getStatusVariant(task.status)}>
                          {formatStatusLabel(task.status)}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <Badge variant={getPriorityVariant(task.priority)}>
                          {formatLabel(task.priority)}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-muted-foreground">
                        {formatDate(task.due_date)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
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
              <Button asChild variant="secondary" size="sm">
                <Link
                  href={buildQueryString(params, {
                    page: String(currentPage - 1),
                  })}
                >
                  Prev
                </Link>
              </Button>
            ) : (
              <Button variant="secondary" size="sm" disabled>
                Prev
              </Button>
            )}

            <span className="text-sm text-muted-foreground">
              Page {currentPage} / {totalPages}
            </span>

            {currentPage < totalPages ? (
              <Button asChild variant="secondary" size="sm">
                <Link
                  href={buildQueryString(params, {
                    page: String(currentPage + 1),
                  })}
                >
                  Next
                </Link>
              </Button>
            ) : (
              <Button variant="secondary" size="sm" disabled>
                Next
              </Button>
            )}
          </div>
        </div>
      </TableShell>
    </div>
  );
}

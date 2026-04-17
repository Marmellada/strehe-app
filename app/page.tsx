import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { createPerfTimer } from "@/lib/perf";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  StatCard,
  StatusBadge,
} from "@/components/ui";

type TaskRow = {
  id: string;
  title: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  assigned_user_id: string | null;
  property_code_snapshot: string | null;
};

type ContractRow = {
  id: string;
  status: string | null;
  monthly_price: number | string | null;
  property_code_snapshot: string | null;
  client_name_snapshot: string | null;
};

type InvoiceRow = {
  id: string;
  status: string | null;
  invoice_number: string | null;
  total_cents: number | null;
  client_name_snapshot: string | null;
};

type ExpenseRow = {
  id: string;
  expense_date: string;
  amount_cents: number;
  description: string;
  category_name_snapshot: string | null;
  vendor_name_snapshot: string | null;
};

type ClientRow = {
  id: string;
  client_type: string | null;
  full_name: string | null;
  company_name: string | null;
  status: string | null;
};

type PropertyRow = {
  id: string;
  title: string | null;
  property_code: string | null;
  status: string | null;
};

function formatCurrencyFromCents(amountCents: number | null | undefined) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
  }).format((amountCents || 0) / 100);
}

function formatPrice(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "€0.00";
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numeric)) return "€0.00";
  return `€${numeric.toFixed(2)}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function isTaskOpen(status: string | null) {
  return (
    status === "open" ||
    status === "in_progress" ||
    status === "escalated" ||
    status === "blocked"
  );
}

function isTaskOverdue(task: TaskRow, todayIso: string) {
  if (!task.due_date) return false;
  if (!isTaskOpen(task.status)) return false;
  return task.due_date < todayIso;
}

function getTaskTone(task: TaskRow, todayIso: string) {
  if (isTaskOverdue(task, todayIso)) return "destructive";
  if (task.status === "escalated" || task.status === "blocked") return "warning";
  return "default";
}

function getTaskBadgeVariant(task: TaskRow, todayIso: string) {
  const tone = getTaskTone(task, todayIso);
  if (tone === "destructive") return "danger" as const;
  if (tone === "warning") return "warning" as const;
  return "neutral" as const;
}

function QuickList({
  title,
  description,
  actionHref,
  actionLabel,
  children,
}: {
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      </CardHeader>
      <CardContent className="grid gap-0">{children}</CardContent>
    </Card>
  );
}

function QuickRow({
  title,
  meta,
  href,
  badge,
}: {
  title: string;
  meta: string;
  href: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-[var(--table-row-border)] py-3 first:border-t-0">
      <div className="min-w-0">
        <div className="truncate font-medium text-foreground">{title}</div>
        <div className="text-sm text-muted-foreground">{meta}</div>
      </div>
      <div className="flex items-center gap-2">
        {badge}
        <Button asChild variant="ghost" size="sm">
          <Link href={href}>View</Link>
        </Button>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const perf = createPerfTimer("page.dashboard");
  const { authUser, appUser } = await requireRole([
    "admin",
    "office",
    "field",
    "contractor",
  ]);
  perf.mark("requireRole");
  const supabase = await createClient();
  perf.mark("createClient");
  const todayIso = new Date().toISOString().slice(0, 10);
  const isOpsRole = appUser.role === "admin" || appUser.role === "office";

  let taskCountQuery = supabase
    .from("tasks")
    .select("id, status, due_date, assigned_user_id", { count: "exact" });
  let recentTasksQuery = supabase
    .from("tasks")
    .select("id, title, status, priority, due_date, assigned_user_id, property_code_snapshot")
    .order("created_at", { ascending: false })
    .limit(6);

  if (!isOpsRole) {
    taskCountQuery = taskCountQuery.eq("assigned_user_id", authUser.id);
    recentTasksQuery = recentTasksQuery.eq("assigned_user_id", authUser.id);
  }

  const [
    taskCountResult,
    openTasksResult,
    escalatedTasksResult,
    overdueTasksResult,
    recentTasksResult,
    activeContractsResult,
    preparedContractsResult,
    recentContractsResult,
    issuedInvoicesResult,
    draftInvoicesResult,
    recentInvoicesResult,
    currentMonthExpensesResult,
    recentExpensesResult,
    totalClientsResult,
    totalPropertiesResult,
    vacantPropertiesResult,
    recentClientsResult,
    recentPropertiesResult,
  ] = await Promise.all([
    taskCountQuery,
    isOpsRole
      ? supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .in("status", ["open", "in_progress", "escalated", "blocked"])
      : supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("assigned_user_id", authUser.id)
          .in("status", ["open", "in_progress", "escalated", "blocked"]),
    isOpsRole
      ? supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .in("status", ["escalated", "blocked"])
      : supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("assigned_user_id", authUser.id)
          .in("status", ["escalated", "blocked"]),
    isOpsRole
      ? supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .lt("due_date", todayIso)
          .in("status", ["open", "in_progress", "escalated", "blocked"])
      : supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("assigned_user_id", authUser.id)
          .lt("due_date", todayIso)
          .in("status", ["open", "in_progress", "escalated", "blocked"]),
    recentTasksQuery,
    supabase
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "prepared"),
    supabase
      .from("subscriptions")
      .select("id, status, monthly_price, property_code_snapshot, client_name_snapshot")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("status", "issued"),
    supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("status", "draft"),
    supabase
      .from("invoices")
      .select("id, status, invoice_number, total_cents, client_name_snapshot")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("expenses")
      .select("amount_cents")
      .gte(
        "expense_date",
        new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1))
          .toISOString()
          .slice(0, 10),
      ),
    supabase
      .from("expenses")
      .select("id, expense_date, amount_cents, description, category_name_snapshot, vendor_name_snapshot")
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("clients").select("id", { count: "exact", head: true }),
    supabase.from("properties").select("id", { count: "exact", head: true }),
    supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("status", "vacant"),
    supabase
      .from("clients")
      .select("id, client_type, full_name, company_name, status")
      .order("id", { ascending: false })
      .limit(5),
    supabase
      .from("properties")
      .select("id, title, property_code, status")
      .order("id", { ascending: false })
      .limit(5),
  ]);

  const recentTasks = (recentTasksResult.data || []) as TaskRow[];
  const recentContracts = (recentContractsResult.data || []) as ContractRow[];
  const recentInvoices = (recentInvoicesResult.data || []) as InvoiceRow[];
  const recentExpenses = (recentExpensesResult.data || []) as ExpenseRow[];
  const recentClients = (recentClientsResult.data || []) as ClientRow[];
  const recentProperties = (recentPropertiesResult.data || []) as PropertyRow[];
  const currentMonthSpend = (currentMonthExpensesResult.data || []).reduce(
    (sum, expense) => sum + (expense.amount_cents || 0),
    0,
  );
  perf.mark("loadDashboardData");
  perf.finish({
    role: appUser.role,
    isOpsRole,
    recentTasks: recentTasks.length,
    recentExpenses: recentExpenses.length,
  });

  return (
    <main className="grid gap-6">
      <PageHeader
        title="Dashboard"
        description={
          isOpsRole
            ? "Day-to-day control across work, properties, contracts, billing, and expense activity."
            : "Your assigned work and the latest operational context around it."
        }
        actions={
          <>
            <Button asChild>
              <Link href={isOpsRole ? "/tasks" : "/tasks?assigned=me"}>{isOpsRole ? "Open Tasks" : "Open My Tasks"}</Link>
            </Button>
            {isOpsRole ? (
              <>
                <Button asChild variant="ghost">
                  <Link href="/tasks/create">New Task</Link>
                </Button>
                <Button asChild variant="ghost">
                  <Link href="/subscriptions/create">New Contract</Link>
                </Button>
                <Button asChild variant="ghost">
                  <Link href="/billing/new">New Invoice</Link>
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title={isOpsRole ? "Open Work" : "My Open Work"} value={openTasksResult.count ?? 0} />
        <StatCard title="Escalated Tasks" value={escalatedTasksResult.count ?? 0} />
        <StatCard title="Overdue Tasks" value={overdueTasksResult.count ?? 0} />
        <StatCard title={isOpsRole ? "Tracked Tasks" : "My Total Tasks"} value={taskCountResult.count ?? 0} />
      </section>

      {isOpsRole ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Active Contracts" value={activeContractsResult.count ?? 0} />
            <StatCard title="Prepared Contracts" value={preparedContractsResult.count ?? 0} />
            <StatCard title="Issued Invoices" value={issuedInvoicesResult.count ?? 0} />
            <StatCard title="Draft Invoices" value={draftInvoicesResult.count ?? 0} />
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Current Month Spend" value={formatCurrencyFromCents(currentMonthSpend)} />
            <StatCard title="Total Properties" value={totalPropertiesResult.count ?? 0} />
            <StatCard title="Clients" value={totalClientsResult.count ?? 0} />
            <StatCard title="Vacant Properties" value={vacantPropertiesResult.count ?? 0} />
          </section>
        </>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        <QuickList
          title={isOpsRole ? "Recent Tasks" : "My Recent Tasks"}
          description="The work queue that should drive the rest of the daily operation."
          actionHref="/tasks"
          actionLabel="View All"
        >
          {recentTasks.length === 0 ? (
            <EmptyState
              title="No tasks yet"
              description="New work items will appear here as soon as they are created or assigned."
            />
          ) : (
            <div className="grid">
              {recentTasks.map((task) => (
                <QuickRow
                  key={task.id}
                  title={task.title || "Untitled task"}
                  meta={`${task.property_code_snapshot || "No property"} • ${task.due_date ? `Due ${formatDate(task.due_date)}` : "No due date"}`}
                  href={`/tasks/${task.id}`}
                  badge={
                    <Badge variant={getTaskBadgeVariant(task, todayIso)}>
                      {task.status || "open"}
                    </Badge>
                  }
                />
              ))}
            </div>
          )}
        </QuickList>

        {isOpsRole ? (
          <QuickList
            title="Recent Expenses"
            description="Latest recorded spend so field activity, vendors, and finance stay aligned."
            actionHref="/expenses"
            actionLabel="View All"
          >
            {recentExpenses.length === 0 ? (
              <EmptyState
                title="No expenses yet"
                description="Recorded expenses will appear here once operational spend starts being logged."
              />
            ) : (
              <div className="grid">
                {recentExpenses.map((expense) => (
                  <QuickRow
                    key={expense.id}
                    title={expense.description}
                    meta={`${expense.category_name_snapshot || "Uncategorized"} • ${expense.vendor_name_snapshot || "No vendor"} • ${formatDate(expense.expense_date)}`}
                    href={`/expenses/${expense.id}`}
                    badge={<span className="text-sm font-medium">{formatCurrencyFromCents(expense.amount_cents)}</span>}
                  />
                ))}
              </div>
            )}
          </QuickList>
        ) : (
          <QuickList
            title="Property Register"
            description="A quick pulse on the estate you are working within."
            actionHref="/properties"
            actionLabel="Open Properties"
          >
            {recentProperties.length === 0 ? (
              <EmptyState
                title="No properties yet"
                description="Once the register has properties, the newest ones will appear here."
              />
            ) : (
              <div className="grid">
                {recentProperties.map((property) => (
                  <QuickRow
                    key={property.id}
                    title={property.title || "Untitled property"}
                    meta={`${property.property_code || "No code"} • ${property.status || "Unknown"}`}
                    href={`/properties/${property.id}`}
                    badge={<StatusBadge status={property.status || "active"} />}
                  />
                ))}
              </div>
            )}
          </QuickList>
        )}
      </section>

      {isOpsRole ? (
        <section className="grid gap-4 xl:grid-cols-2">
          <QuickList
            title="Recent Contracts"
            description="Prepared and active agreements that feed recurring operational work."
            actionHref="/subscriptions"
            actionLabel="View All"
          >
            {recentContracts.length === 0 ? (
              <EmptyState
                title="No contracts yet"
                description="New agreements will appear here once subscriptions are being managed."
              />
            ) : (
              <div className="grid">
                {recentContracts.map((contract) => (
                  <QuickRow
                    key={contract.id}
                    title={contract.client_name_snapshot || "Unnamed client"}
                    meta={`${contract.property_code_snapshot || "No property"} • ${formatPrice(contract.monthly_price)} / month`}
                    href={`/subscriptions/${contract.id}`}
                    badge={<StatusBadge status={contract.status || "draft"} />}
                  />
                ))}
              </div>
            )}
          </QuickList>

          <QuickList
            title="Recent Invoices"
            description="Fresh billing documents so office follow-up stays visible from the first screen."
            actionHref="/billing"
            actionLabel="View All"
          >
            {recentInvoices.length === 0 ? (
              <EmptyState
                title="No invoices yet"
                description="Issued and draft invoices will surface here once billing activity starts."
              />
            ) : (
              <div className="grid">
                {recentInvoices.map((invoice) => (
                  <QuickRow
                    key={invoice.id}
                    title={invoice.invoice_number || "Draft invoice"}
                    meta={`${invoice.client_name_snapshot || "No client"} • ${formatCurrencyFromCents(invoice.total_cents)}`}
                    href={`/billing/${invoice.id}`}
                    badge={<StatusBadge status={invoice.status || "draft"} />}
                  />
                ))}
              </div>
            )}
          </QuickList>
        </section>
      ) : null}

      {isOpsRole ? (
        <section className="grid gap-4 xl:grid-cols-2">
          <QuickList
            title="Recent Clients"
            description="Latest additions to the client register."
            actionHref="/clients"
            actionLabel="View All"
          >
            {recentClients.length === 0 ? (
              <EmptyState
                title="No clients yet"
                description="Once clients are added, the newest ones will appear here."
              />
            ) : (
              <div className="grid">
                {recentClients.map((client) => {
                  const name =
                    client.client_type === "business"
                      ? client.company_name || "Unnamed business"
                      : client.full_name || "Unnamed individual";

                  return (
                    <QuickRow
                      key={client.id}
                      title={name}
                      meta={`${client.client_type === "business" ? "Business" : "Individual"} • ${client.status || "Unknown"}`}
                      href={`/clients/${client.id}`}
                      badge={<StatusBadge status={client.status || "active"} />}
                    />
                  );
                })}
              </div>
            )}
          </QuickList>

          <QuickList
            title="Recent Properties"
            description="Latest properties added to the register."
            actionHref="/properties"
            actionLabel="View All"
          >
            {recentProperties.length === 0 ? (
              <EmptyState
                title="No properties yet"
                description="Once properties are added, the newest ones will appear here."
              />
            ) : (
              <div className="grid">
                {recentProperties.map((property) => (
                  <QuickRow
                    key={property.id}
                    title={property.title || "Untitled property"}
                    meta={`${property.property_code || "No code"} • ${property.status || "Unknown"}`}
                    href={`/properties/${property.id}`}
                    badge={<StatusBadge status={property.status || "active"} />}
                  />
                ))}
              </div>
            )}
          </QuickList>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Tasks</CardTitle>
            <CardDescription>Work queue, assignments, and reporting.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="ghost">
              <Link href="/tasks">Open Tasks</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Properties</CardTitle>
            <CardDescription>Track properties, locations, and ownership.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="ghost">
              <Link href="/properties">Open Properties</Link>
            </Button>
          </CardContent>
        </Card>

        {isOpsRole ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Billing</CardTitle>
                <CardDescription>Invoices and payment operations.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="ghost">
                  <Link href="/billing">Open Billing</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Expenses</CardTitle>
                <CardDescription>Operational spend and vendor-linked records.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="ghost">
                  <Link href="/expenses">Open Expenses</Link>
                </Button>
              </CardContent>
            </Card>
          </>
        ) : null}
      </section>
    </main>
  );
}

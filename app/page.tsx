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

function formatPrice(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";

  const num = typeof value === "number" ? value : Number(value);

  if (Number.isNaN(num)) return "-";

  return `€${num.toFixed(2)}`;
}

export default async function DashboardPage() {
  const today = new Date().toISOString().slice(0, 10);

  const [
    { count: openTasksCount },
    { count: overdueTasksCount },
    { count: activeSubscriptionsCount },
    { count: activePackagesCount },
    { data: revenueData },
    { data: recentTasks },
    { data: recentSubscriptions },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .in("status", ["open", "in_progress"]),

    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .in("status", ["open", "in_progress"])
      .lt("due_date", today),

    supabase
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),

    supabase
      .from("packages")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true),

    supabase
      .from("subscriptions")
      .select("monthly_price")
      .eq("status", "active"),

    supabase
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
        service:services!tasks_service_fk (
          id,
          name
        )
      `)
      .order("created_at", { ascending: false })
      .limit(5),

    supabase
      .from("subscriptions")
      .select(`
        id,
        start_date,
        status,
        monthly_price,
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
      `)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const monthlyRevenue =
    revenueData?.reduce((sum: number, subscription: any) => {
      const value = Number(subscription.monthly_price || 0);
      return sum + (Number.isNaN(value) ? 0 : value);
    }, 0) || 0;

  const upcomingDeadlines =
    recentTasks?.filter((task: any) => task.due_date).slice(0, 5) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Overview of operations and subscriptions</p>
      </div>

      <div className="grid grid-4 gap-4">
        <div className="card">
          <p className="field-label">Open Tasks</p>
          <p className="text-2xl font-semibold">{openTasksCount ?? 0}</p>
        </div>

        <div className="card">
          <p className="field-label">Overdue Tasks</p>
          <p className="text-2xl font-semibold">{overdueTasksCount ?? 0}</p>
        </div>

        <div className="card">
          <p className="field-label">Active Subscriptions</p>
          <p className="text-2xl font-semibold">{activeSubscriptionsCount ?? 0}</p>
        </div>

        <div className="card">
          <p className="field-label">Active Packages</p>
          <p className="text-2xl font-semibold">{activePackagesCount ?? 0}</p>
        </div>

        <div className="card">
          <p className="field-label">Monthly Revenue</p>
          <p className="text-2xl font-semibold">€{monthlyRevenue.toFixed(2)}</p>
        </div>
      </div>

      <div className="grid grid-2 gap-4">
        <div className="card space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="section-title">Recent Tasks</h2>
            <Link href="/tasks" className="text-sm underline">
              View all
            </Link>
          </div>

          {recentTasks && recentTasks.length > 0 ? (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Property</th>
                    <th>Service</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTasks.map((task: any) => {
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
                        <td>{task.service?.name || "-"}</td>
                        <td>{formatLabel(task.status)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No recent tasks.</p>
          )}
        </div>

        <div className="card space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="section-title">Recent Subscriptions</h2>
            <Link href="/subscriptions" className="text-sm underline">
              View all
            </Link>
          </div>

          {recentSubscriptions && recentSubscriptions.length > 0 ? (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Package</th>
                    <th>Status</th>
                    <th>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSubscriptions.map((subscription: any) => {
                    const clientName =
                      subscription.client?.company_name ||
                      subscription.client?.full_name ||
                      "-";

                    return (
                      <tr key={subscription.id}>
                        <td>
                          <Link href={`/subscriptions/${subscription.id}`}>
                            {clientName}
                          </Link>
                        </td>
                        <td>{subscription.package?.name || "-"}</td>
                        <td>{formatLabel(subscription.status)}</td>
                        <td>{formatPrice(subscription.monthly_price)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No recent subscriptions.</p>
          )}
        </div>
      </div>

      <div className="grid grid-2 gap-4">
        <div className="card space-y-4">
          <h2 className="section-title">Quick Links</h2>

          <div className="flex flex-wrap gap-2">
            <Link href="/tasks/create" className="btn">
              New Task
            </Link>
            <Link href="/subscriptions/create" className="btn">
              New Subscription
            </Link>
            <Link href="/services/create" className="btn">
              New Service
            </Link>
            <Link href="/packages/create" className="btn">
              New Package
            </Link>
            <Link href="/properties/create" className="btn">
              New Property
            </Link>
            <Link href="/clients/create" className="btn">
              New Client
            </Link>
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="section-title">Upcoming Deadlines</h2>

          {upcomingDeadlines.length > 0 ? (
            <div className="space-y-2">
              {upcomingDeadlines.map((task: any) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-4"
                >
                  <Link href={`/tasks/${task.id}`}>{task.title || "-"}</Link>
                  <span>{formatDate(task.due_date)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p>No deadlines yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
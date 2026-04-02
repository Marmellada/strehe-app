import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

function formatLabel(value: string | null | undefined) {
  if (!value) return "-";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (l: string) => l.toUpperCase());
}

function formatPrice(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";

  const num = typeof value === "number" ? value : Number(value);

  if (Number.isNaN(num)) return "-";

  return `€${num.toFixed(2)}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function SubscriptionsPage() {
  const supabase = await createClient();
  
  const { data: subscriptions, error } = await supabase
    .from("subscriptions")
    .select(`
      id,
      start_date,
      end_date,
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
    .order("created_at", { ascending: false });

  if (error) {
    return <div>Error loading subscriptions</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Subscriptions</h1>
          <p className="page-subtitle">Manage active package assignments</p>
        </div>

        <Link href="/subscriptions/create" className="btn btn-primary">
          + New Subscription
        </Link>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Property</th>
                <th>Package</th>
                <th>Status</th>
                <th>Monthly Price</th>
                <th>Start Date</th>
                <th>End Date</th>
              </tr>
            </thead>

            <tbody>
              {subscriptions?.map((subscription: any) => {
                const clientName =
                  subscription.client?.company_name ||
                  subscription.client?.full_name ||
                  "-";

                const propertyLabel =
                  subscription.property?.property_code
                    ? `${subscription.property.property_code} - ${subscription.property?.title || ""}`
                    : subscription.property?.title || "-";

                return (
                  <tr key={subscription.id}>
                    <td>
                      <Link href={`/subscriptions/${subscription.id}`}>
                        {clientName}
                      </Link>
                    </td>

                    <td>{propertyLabel}</td>

                    <td>{subscription.package?.name || "-"}</td>

                    <td>{formatLabel(subscription.status)}</td>

                    <td>{formatPrice(subscription.monthly_price)}</td>

                    <td>{formatDate(subscription.start_date)}</td>

                    <td>{formatDate(subscription.end_date)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {subscriptions?.length === 0 && (
            <div className="empty-state">No subscriptions found.</div>
          )}
        </div>
      </div>
    </div>
  );
}

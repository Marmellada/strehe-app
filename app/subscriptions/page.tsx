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

function formatPeriod(
  startDate: string | null | undefined,
  endDate: string | null | undefined
) {
  const start = formatDate(startDate);
  const end = formatDate(endDate);

  if (start === "-" && end === "-") return "-";
  if (start !== "-" && end === "-") return `${start} → Open`;
  if (start === "-" && end !== "-") return `Until ${end}`;

  return `${start} → ${end}`;
}

function getStatusBadgeClass(status: string | null | undefined) {
  switch ((status || "").toLowerCase()) {
    case "active":
      return "badge-success";
    case "paused":
      return "badge-warning";
    case "cancelled":
      return "badge-danger";
    default:
      return "badge-outline";
  }
}

type ContractRow = {
  id: string;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  monthly_price: number | string | null;
  client:
    | {
        id: string;
        full_name: string | null;
        company_name: string | null;
      }
    | {
        id: string;
        full_name: string | null;
        company_name: string | null;
      }[]
    | null;
  property:
    | {
        id: string;
        title: string | null;
        property_code: string | null;
      }
    | {
        id: string;
        title: string | null;
        property_code: string | null;
      }[]
    | null;
  package:
    | {
        id: string;
        name: string | null;
      }
    | {
        id: string;
        name: string | null;
      }[]
    | null;
};

function getSingleRelation<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] || null;
  return value;
}

export default async function SubscriptionsPage() {
  const supabase = await createClient();

  const { data: contracts, error } = await supabase
    .from("subscriptions")
    .select(
      `
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
    `
    )
    .order("created_at", { ascending: false });

  if (error) {
    return <div className="card">Error loading contracts: {error.message}</div>;
  }

  const rows = (contracts || []) as ContractRow[];

  const summary = rows.reduce(
    (acc, contract) => {
      const status = (contract.status || "").toLowerCase();
      const monthlyPrice = Number(contract.monthly_price || 0);

      acc.total += 1;

      if (status === "active") acc.active += 1;
      else if (status === "paused") acc.paused += 1;
      else if (status === "cancelled") acc.cancelled += 1;
      else acc.other += 1;

      if (!Number.isNaN(monthlyPrice) && status === "active") {
        acc.monthlyRevenue += monthlyPrice;
      }

      return acc;
    },
    {
      total: 0,
      active: 0,
      paused: 0,
      cancelled: 0,
      other: 0,
      monthlyRevenue: 0,
    }
  );

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Contracts</h1>
          <p className="page-subtitle">
            Manage service agreements for properties and owners
          </p>
        </div>

        <Link href="/subscriptions/create" className="btn btn-primary">
          + New Contract
        </Link>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="card">
          <span className="field-label">Total Contracts</span>
          <span className="field-value">{summary.total}</span>
        </div>

        <div className="card">
          <span className="field-label">Active</span>
          <span className="field-value">{summary.active}</span>
        </div>

        <div className="card">
          <span className="field-label">Paused</span>
          <span className="field-value">{summary.paused}</span>
        </div>

        <div className="card">
          <span className="field-label">Cancelled</span>
          <span className="field-value">{summary.cancelled}</span>
        </div>

        <div className="card">
          <span className="field-label">Monthly Revenue</span>
          <span className="field-value">
            {formatPrice(summary.monthlyRevenue)}
          </span>
        </div>
      </section>

      <section className="card">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="section-title !mb-0">Contracts List</h2>
            <p className="page-subtitle mt-1">
              {rows.length} contract{rows.length === 1 ? "" : "s"} found
            </p>
          </div>
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Property</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Price</th>
                <th>Period</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((contract) => {
                const client = getSingleRelation(contract.client);
                const property = getSingleRelation(contract.property);
                const plan = getSingleRelation(contract.package);

                const clientName =
                  client?.company_name || client?.full_name || "-";

                const propertyLabel = property?.property_code
                  ? `${property.property_code} - ${property.title || ""}`
                  : property?.title || "-";

                return (
                  <tr key={contract.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{clientName}</div>
                    </td>

                    <td>{propertyLabel}</td>

                    <td>
                      <span style={{ fontWeight: 600 }}>
                        {plan?.name || "-"}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`badge ${getStatusBadgeClass(
                          contract.status
                        )}`}
                      >
                        {formatLabel(contract.status)}
                      </span>
                    </td>

                    <td>
                      {formatPrice(contract.monthly_price)}
                      {contract.monthly_price !== null &&
                      contract.monthly_price !== undefined &&
                      contract.monthly_price !== ""
                        ? " / mo"
                        : ""}
                    </td>

                    <td>
                      {formatPeriod(contract.start_date, contract.end_date)}
                    </td>

                    <td>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <Link
                          href={`/subscriptions/${contract.id}`}
                          className="btn btn-ghost"
                        >
                          Open
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {rows.length === 0 && (
            <div className="empty-state">No contracts found.</div>
          )}
        </div>
      </section>
    </main>
  );
}
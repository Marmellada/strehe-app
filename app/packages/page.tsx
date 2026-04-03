import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<{
  search?: string;
  status?: string;
}>;

type ServiceRelation =
  | {
      id: string;
      name: string | null;
      category: string | null;
      base_price: number | string | null;
      is_active: boolean | null;
    }
  | {
      id: string;
      name: string | null;
      category: string | null;
      base_price: number | string | null;
      is_active: boolean | null;
    }[]
  | null;

type PackageServiceRow = {
  id: string;
  included_quantity: number | null;
  services: ServiceRelation;
};

type PackageRow = {
  id: string;
  name: string | null;
  description: string | null;
  monthly_price: number | string | null;
  is_active: boolean | null;
  created_at: string | null;
  package_services: PackageServiceRow[] | null;
};

type SubscriptionRow = {
  id: string;
  package_id: string | null;
  status: string | null;
};

function getSingleRelation<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] || null;
  return value;
}

function formatPrice(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";

  const num = typeof value === "number" ? value : Number(value);

  if (Number.isNaN(num)) return "—";

  return `€${num.toFixed(2)}`;
}

function formatLabel(value: string | null | undefined) {
  if (!value) return "—";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getIncludedServicesLabel(packageServices: PackageServiceRow[] | null) {
  if (!packageServices || packageServices.length === 0) {
    return "No services assigned";
  }

  return packageServices
    .map((row) => {
      const service = getSingleRelation(row.services);
      const qty = Number(row.included_quantity || 0);
      const qtyLabel = qty > 0 ? `${qty}x` : "—";
      return `${qtyLabel} ${service?.name || "Unnamed service"}`;
    })
    .join(" · ");
}

function buildPackagesPageHref({
  search,
  status,
}: {
  search?: string;
  status?: string;
}) {
  const params = new URLSearchParams();

  if (search) params.set("search", search);
  if (status) params.set("status", status);

  const query = params.toString();
  return query ? `/packages?${query}` : "/packages";
}

export default async function PackagesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const params = await searchParams;

  const search = params.search || "";
  const status = params.status || "";

  const [{ data: packagesData, error }, { data: subscriptionsData }] =
    await Promise.all([
      (async () => {
        let query = supabase
          .from("packages")
          .select(
            `
            id,
            name,
            description,
            monthly_price,
            is_active,
            created_at,
            package_services (
              id,
              included_quantity,
              services (
                id,
                name,
                category,
                base_price,
                is_active
              )
            )
          `
          )
          .order("created_at", { ascending: false });

        if (status === "active") {
          query = query.eq("is_active", true);
        } else if (status === "inactive") {
          query = query.eq("is_active", false);
        }

        if (search) {
          query = query.or(
            `name.ilike.%${search}%,description.ilike.%${search}%`
          );
        }

        return await query;
      })(),

      supabase.from("subscriptions").select("id, package_id, status"),
    ]);

  if (error) {
    return <div className="card">Error loading packages: {error.message}</div>;
  }

  const packages = (packagesData || []) as PackageRow[];
  const subscriptions = (subscriptionsData || []) as SubscriptionRow[];

  const activeContractsByPackageId = new Map<string, number>();

  for (const subscription of subscriptions) {
    if (!subscription.package_id) continue;

    const currentStatus = (subscription.status || "").toLowerCase();
    const isActiveLike =
      currentStatus === "active" || currentStatus === "paused";

    if (!isActiveLike) continue;

    activeContractsByPackageId.set(
      subscription.package_id,
      (activeContractsByPackageId.get(subscription.package_id) || 0) + 1
    );
  }

  const totals = packages.reduce(
    (acc, pkg) => {
      const packageServices = pkg.package_services || [];

      acc.total += 1;

      if (pkg.is_active) {
        acc.active += 1;
      } else {
        acc.inactive += 1;
      }

      acc.serviceLinks += packageServices.length;
      acc.activeContracts += activeContractsByPackageId.get(pkg.id) || 0;

      return acc;
    },
    {
      total: 0,
      active: 0,
      inactive: 0,
      serviceLinks: 0,
      activeContracts: 0,
    }
  );

  const quickFilters = [
    { label: "All", value: "", count: totals.total },
    { label: "Active", value: "active", count: totals.active },
    { label: "Inactive", value: "inactive", count: totals.inactive },
  ];

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Packages</h1>
          <p className="page-subtitle mt-2">
            Manage contractual service bundles used in contracts.
          </p>
        </div>

        <Link href="/packages/create" className="btn btn-primary">
          + New Package
        </Link>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="card">
          <span className="field-label">Total Packages</span>
          <span className="field-value">{totals.total}</span>
        </div>

        <div className="card">
          <span className="field-label">Active Packages</span>
          <span className="field-value">{totals.active}</span>
        </div>

        <div className="card">
          <span className="field-label">Inactive Packages</span>
          <span className="field-value">{totals.inactive}</span>
        </div>

        <div className="card">
          <span className="field-label">Active Contracts</span>
          <span className="field-value">{totals.activeContracts}</span>
        </div>
      </section>

      <section className="card">
        <div className="mb-4">
          <h2 className="section-title !mb-0">Quick Filters</h2>
          <p className="page-subtitle mt-1">
            Filter packages by commercial status.
          </p>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {quickFilters.map((item) => {
            const active = status === item.value;

            return (
              <Link
                key={item.label}
                href={buildPackagesPageHref({
                  search,
                  status: item.value,
                })}
                className={active ? "btn btn-primary" : "btn btn-ghost"}
              >
                {item.label} ({item.count})
              </Link>
            );
          })}
        </div>
      </section>

      <section className="card">
        <div className="mb-4">
          <h2 className="section-title !mb-0">Filters</h2>
          <p className="page-subtitle mt-1">
            Search packages by name or description.
          </p>
        </div>

        <form
          method="get"
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "minmax(240px, 2fr) minmax(180px, 1fr) auto",
            alignItems: "end",
          }}
        >
          <label className="field">
            Search
            <input
              type="text"
              name="search"
              defaultValue={search}
              className="input"
              placeholder="Search package name or description"
            />
          </label>

          <label className="field">
            Status
            <select name="status" defaultValue={status} className="input">
              <option value="">All statuses</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>
          </label>

          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" className="btn btn-primary">
              Apply
            </button>
            <Link href="/packages" className="btn btn-ghost">
              Clear
            </Link>
          </div>
        </form>
      </section>

      <section className="card" style={{ padding: 0, overflow: "hidden" }}>
        {packages.length === 0 ? (
          <div style={{ padding: 24 }}>
            <h3 style={{ marginTop: 0 }}>No packages found</h3>
            <p style={{ opacity: 0.75 }}>
              Create your first contractual package to use it in contracts.
            </p>
            <Link href="/packages/create" className="btn btn-primary">
              + New Package
            </Link>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Package</th>
                  <th>Monthly Price</th>
                  <th>Status</th>
                  <th>Included Services</th>
                  <th>Active Contracts</th>
                </tr>
              </thead>

              <tbody>
                {packages.map((pkg) => {
                  const packageServices = pkg.package_services || [];
                  const activeContracts =
                    activeContractsByPackageId.get(pkg.id) || 0;

                  return (
                    <tr key={pkg.id}>
                      <td>
                        <div style={{ display: "grid", gap: 4 }}>
                          <Link href={`/packages/${pkg.id}`}>
                            {pkg.name || "Untitled package"}
                          </Link>
                          <span style={{ fontSize: 13, opacity: 0.75 }}>
                            {pkg.description || "No description"}
                          </span>
                        </div>
                      </td>

                      <td>{formatPrice(pkg.monthly_price)}</td>

                      <td>
                        <span
                          className={pkg.is_active ? "badge-success" : "badge-outline"}
                        >
                          {pkg.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>

                      <td>
                        <div style={{ display: "grid", gap: 4 }}>
                          <strong>{packageServices.length}</strong>
                          <span style={{ fontSize: 13, opacity: 0.75 }}>
                            {getIncludedServicesLabel(packageServices)}
                          </span>
                        </div>
                      </td>

                      <td>{activeContracts}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="mb-4">
          <h2 className="section-title !mb-0">V1 Package Meaning</h2>
          <p className="page-subtitle mt-1">
            Packages are commercial bundles used in contracts, while services
            remain reusable catalog items for both contracts and billing.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          <div className="card">
            <div className="field-label">Package</div>
            <div className="field-value">Contract bundle</div>
            <p style={{ marginTop: 8, opacity: 0.75 }}>
              Example: Basic, Standard, Premium
            </p>
          </div>

          <div className="card">
            <div className="field-label">Service</div>
            <div className="field-value">Catalog item</div>
            <p style={{ marginTop: 8, opacity: 0.75 }}>
              Used inside packages and later on invoices.
            </p>
          </div>

          <div className="card">
            <div className="field-label">Contract</div>
            <div className="field-value">Property assignment</div>
            <p style={{ marginTop: 8, opacity: 0.75 }}>
              One property enrolled in one package.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
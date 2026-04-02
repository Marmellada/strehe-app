import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<{
  status?: string;
  property_id?: string;
  search?: string;
}>;

type RelatedProperty =
  | {
      id: string;
      title: string | null;
      property_code: string | null;
      address_line_1: string | null;
    }
  | {
      id: string;
      title: string | null;
      property_code: string | null;
      address_line_1: string | null;
    }[]
  | null;

type RecipientUser =
  | { full_name: string | null }
  | { full_name: string | null }[]
  | null;

type PackageRow = {
  id: string;
  tracking_code: string | null;
  description: string | null;
  status: string | null;
  carrier: string | null;
  recipient_name: string | null;
  recipient_user: RecipientUser;
  storage_location: string | null;
  received_at: string | null;
  picked_up_at: string | null;
  property_id: string | null;
  properties: RelatedProperty;
};

type PropertyOption = {
  id: string;
  title: string | null;
  property_code: string | null;
};

type StatusCountRow = {
  id: string;
  status: string | null;
};

function getSingleRelation<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] || null;
  return value;
}

function formatDate(value: string | null) {
  if (!value) return "-";

  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getStatusBadgeClass(status: string | null) {
  switch (status) {
    case "pending":
      return "badge-warning";
    case "received":
      return "badge-success";
    case "picked_up":
      return "badge-outline";
    case "returned":
      return "badge-danger";
    default:
      return "badge-outline";
  }
}

function buildPackagesPageHref({
  status,
  property_id,
  search,
}: {
  status?: string;
  property_id?: string;
  search?: string;
}) {
  const params = new URLSearchParams();

  if (status) params.set("status", status);
  if (property_id) params.set("property_id", property_id);
  if (search) params.set("search", search);

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

  const status = params.status || "";
  const property_id = params.property_id || "";
  const search = params.search || "";

  const [
    { data: properties },
    { data: allPackages },
    { data: filteredPackages, error },
  ] = await Promise.all([
    supabase
      .from("properties")
      .select("id, title, property_code")
      .order("title"),

    supabase.from("packages").select("id, status"),

    (async () => {
      let query = supabase
        .from("packages")
        .select(
          `
            id,
            tracking_code,
            description,
            status,
            carrier,
            recipient_name,
            storage_location,
            received_at,
            picked_up_at,
            property_id,
            properties (
              id,
              title,
              property_code,
              address_line_1
            ),
            recipient_user:users!packages_recipient_user_fk (
              full_name
            )
          `
        )
        .order("received_at", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }

      if (property_id) {
        query = query.eq("property_id", property_id);
      }

      if (search) {
        query = query.or(
          [
            `tracking_code.ilike.%${search}%`,
            `description.ilike.%${search}%`,
            `carrier.ilike.%${search}%`,
            `recipient_name.ilike.%${search}%`,
            `storage_location.ilike.%${search}%`,
          ].join(",")
        );
      }

      return await query;
    })(),
  ]);

  if (error) {
    return <div className="card">Error loading packages: {error.message}</div>;
  }

  const propertyOptions = (properties || []) as PropertyOption[];
  const packages = (filteredPackages || []) as PackageRow[];
  const allPackageRows = (allPackages || []) as StatusCountRow[];

  const counts = allPackageRows.reduce(
    (acc, row) => {
      const currentStatus = row.status || "unknown";

      acc.total += 1;

      if (currentStatus === "pending") acc.pending += 1;
      else if (currentStatus === "received") acc.received += 1;
      else if (currentStatus === "picked_up") acc.picked_up += 1;
      else if (currentStatus === "returned") acc.returned += 1;
      else acc.other += 1;

      return acc;
    },
    {
      total: 0,
      pending: 0,
      received: 0,
      picked_up: 0,
      returned: 0,
      other: 0,
    }
  );

  const statusLinks = [
    { label: "All", value: "", count: counts.total },
    { label: "Pending", value: "pending", count: counts.pending },
    { label: "Received", value: "received", count: counts.received },
    { label: "Picked Up", value: "picked_up", count: counts.picked_up },
    { label: "Returned", value: "returned", count: counts.returned },
  ];

  return (
    <main className="space-y-6">
      <div>
        <h1 className="page-title">Packages</h1>
        <p className="page-subtitle mt-2">
          Track package deliveries and pickups across all properties.
        </p>
      </div>

      {/* ── Status summary cards ── */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="card">
          <span className="field-label">All Packages</span>
          <span className="field-value">{counts.total}</span>
        </div>

        <div className="card">
          <span className="field-label">Pending</span>
          <span className="field-value">{counts.pending}</span>
        </div>

        <div className="card">
          <span className="field-label">Received</span>
          <span className="field-value">{counts.received}</span>
        </div>

        <div className="card">
          <span className="field-label">Picked Up</span>
          <span className="field-value">{counts.picked_up}</span>
        </div>

        <div className="card">
          <span className="field-label">Returned</span>
          <span className="field-value">{counts.returned}</span>
        </div>
      </section>

      {/* ── Quick status filters ── */}
      <section className="card">
        <div className="mb-4">
          <h2 className="section-title !mb-0">Quick Status Filters</h2>
          <p className="page-subtitle mt-1">
            Jump between delivery lifecycle states.
          </p>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {statusLinks.map((item) => {
            const active = status === item.value;

            return (
              <Link
                key={item.label}
                href={buildPackagesPageHref({
                  status: item.value,
                  property_id,
                  search,
                })}
                className={active ? "btn btn-primary" : "btn btn-ghost"}
              >
                {item.label} ({item.count})
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Filters form ── */}
      <section className="card">
        <div className="mb-4">
          <h2 className="section-title !mb-0">Filters</h2>
          <p className="page-subtitle mt-1">
            Narrow the list by property, status, or keyword.
          </p>
        </div>

        <form
          method="get"
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            alignItems: "end",
          }}
        >
          <label className="field">
            Status
            <select name="status" defaultValue={status} className="input">
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="received">Received</option>
              <option value="picked_up">Picked Up</option>
              <option value="returned">Returned</option>
            </select>
          </label>

          <label className="field">
            Property
            <select
              name="property_id"
              defaultValue={property_id}
              className="input"
            >
              <option value="">All properties</option>
              {propertyOptions.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.title || "Untitled Property"}
                  {property.property_code
                    ? ` (${property.property_code})`
                    : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            Search
            <input
              name="search"
              className="input"
              defaultValue={search}
              placeholder="Tracking, description, carrier..."
            />
          </label>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button type="submit" className="btn btn-primary">
              Apply Filters
            </button>

            <Link href="/packages" className="btn btn-ghost">
              Reset
            </Link>
          </div>
        </form>
      </section>

      {/* ── Packages list ── */}
      <section className="card">
        <div className="mb-4">
          <h2 className="section-title !mb-0">Packages List</h2>
          <p className="page-subtitle mt-1">
            {packages.length} package{packages.length === 1 ? "" : "s"} found.
          </p>
        </div>

        {packages.length === 0 ? (
          <p className="field-value-muted">
            No packages found for the current filters.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {packages.map((pkg) => {
              const property = getSingleRelation(pkg.properties);
              const recipientUser = getSingleRelation(pkg.recipient_user);

              const recipientDisplay =
                recipientUser?.full_name ??
                pkg.recipient_name ??
                "Unknown recipient";

              return (
                <div
                  key={pkg.id}
                  className="related-item"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) auto",
                    gap: 20,
                    alignItems: "start",
                    padding: 20,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        flexWrap: "wrap",
                        marginBottom: 10,
                      }}
                    >
                      <div
                        className="related-item-title"
                        style={{ margin: 0 }}
                      >
                        {pkg.description || "Package"}
                      </div>

                      <span
                        className={`badge ${getStatusBadgeClass(pkg.status)}`}
                      >
                        {pkg.status || "Unknown"}
                      </span>

                      {pkg.carrier ? (
                        <span className="badge badge-outline">
                          {pkg.carrier}
                        </span>
                      ) : null}
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gap: 8,
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(220px, 1fr))",
                      }}
                    >
                      <div>
                        <div className="field-label">Tracking Code</div>
                        <div className="field-value">
                          {pkg.tracking_code || "-"}
                        </div>
                      </div>

                      <div>
                        <div className="field-label">Recipient</div>
                        <div className="field-value">{recipientDisplay}</div>
                      </div>

                      <div>
                        <div className="field-label">Storage</div>
                        <div className="field-value">
                          {pkg.storage_location || "-"}
                        </div>
                      </div>

                      <div>
                        <div className="field-label">Received At</div>
                        <div className="field-value">
                          {formatDate(pkg.received_at)}
                        </div>
                      </div>

                      <div>
                        <div className="field-label">Picked Up At</div>
                        <div className="field-value">
                          {formatDate(pkg.picked_up_at)}
                        </div>
                      </div>

                      <div>
                        <div className="field-label">Property</div>
                        <div className="field-value">
                          {property?.title || "-"}
                          {property?.property_code
                            ? ` (${property.property_code})`
                            : ""}
                        </div>
                      </div>

                      <div>
                        <div className="field-label">Address</div>
                        <div className="field-value">
                          {property?.address_line_1 || "-"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap",
                      justifyContent: "flex-end",
                      alignItems: "flex-start",
                    }}
                  >
                    <Link
                      href={`/packages/${pkg.id}`}
                      className="btn btn-ghost"
                    >
                      Open
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

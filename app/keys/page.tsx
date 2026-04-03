import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

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

type HolderUser =
  | { full_name: string | null }
  | { full_name: string | null }[]
  | null;

type KeyRow = {
  id: string;
  key_code: string | null;
  name: string | null;
  key_type: string | null;
  status: string | null;
  holder_name: string | null;
  holder_user: HolderUser;
  storage_location: string | null;
  last_checked_out_at: string | null;
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
    case "available":
      return "badge-success";
    case "assigned":
      return "badge-warning";
    case "lost":
      return "badge-danger";
    case "damaged":
      return "badge-warning";
    case "retired":
      return "badge-outline";
    default:
      return "badge-outline";
  }
}

function buildKeysPageHref({
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
  return query ? `/keys?${query}` : "/keys";
}

export default async function KeysPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { appUser } = await requireRole(["admin", "office", "field"]);

  const supabase = await createClient();
  const params = await searchParams;

  const status = params.status || "";
  const property_id = params.property_id || "";
  const search = params.search || "";

  const [
    { data: properties },
    { data: allKeys },
    { data: filteredKeys, error },
  ] = await Promise.all([
    supabase
      .from("properties")
      .select("id, title, property_code")
      .order("title"),

    supabase.from("keys").select("id, status"),

    (async () => {
      let query = supabase
        .from("keys")
        .select(
          `
            id,
            key_code,
            name,
            key_type,
            status,
            holder_name,
            storage_location,
            last_checked_out_at,
            property_id,
            properties (
              id,
              title,
              property_code,
              address_line_1
            ),
            holder_user:users!keys_holder_user_fk (
              full_name
            )
          `
        )
        .order("created_at", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }

      if (property_id) {
        query = query.eq("property_id", property_id);
      }

      if (search) {
        query = query.or(
          [
            `name.ilike.%${search}%`,
            `key_code.ilike.%${search}%`,
            `key_type.ilike.%${search}%`,
            `holder_name.ilike.%${search}%`,
            `storage_location.ilike.%${search}%`,
          ].join(",")
        );
      }

      return await query;
    })(),
  ]);

  if (error) {
    return <div className="card">Error loading keys: {error.message}</div>;
  }

  const propertyOptions = (properties || []) as PropertyOption[];
  const keys = (filteredKeys || []) as KeyRow[];
  const allKeyRows = (allKeys || []) as StatusCountRow[];

  const counts = allKeyRows.reduce(
    (acc, row) => {
      const currentStatus = row.status || "unknown";

      acc.total += 1;

      if (currentStatus === "available") acc.available += 1;
      else if (currentStatus === "assigned") acc.assigned += 1;
      else if (currentStatus === "lost") acc.lost += 1;
      else if (currentStatus === "damaged") acc.damaged += 1;
      else if (currentStatus === "retired") acc.retired += 1;
      else acc.other += 1;

      return acc;
    },
    {
      total: 0,
      available: 0,
      assigned: 0,
      lost: 0,
      damaged: 0,
      retired: 0,
      other: 0,
    }
  );

  const statusLinks = [
    { label: "All", value: "", count: counts.total },
    { label: "Available", value: "available", count: counts.available },
    { label: "Assigned", value: "assigned", count: counts.assigned },
    { label: "Lost", value: "lost", count: counts.lost },
    { label: "Damaged", value: "damaged", count: counts.damaged },
    { label: "Retired", value: "retired", count: counts.retired },
  ];

  return (
    <main className="space-y-6">
      <div>
        <h1 className="page-title">Keys</h1>
        <p className="page-subtitle mt-2">
          Operational overview of all keys across properties.
        </p>
        <p className="page-subtitle mt-1">
          Signed in as: <strong>{appUser.role}</strong>
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <div className="card">
          <span className="field-label">All Keys</span>
          <span className="field-value">{counts.total}</span>
        </div>

        <div className="card">
          <span className="field-label">Available</span>
          <span className="field-value">{counts.available}</span>
        </div>

        <div className="card">
          <span className="field-label">Assigned</span>
          <span className="field-value">{counts.assigned}</span>
        </div>

        <div className="card">
          <span className="field-label">Lost</span>
          <span className="field-value">{counts.lost}</span>
        </div>

        <div className="card">
          <span className="field-label">Damaged</span>
          <span className="field-value">{counts.damaged}</span>
        </div>

        <div className="card">
          <span className="field-label">Retired</span>
          <span className="field-value">{counts.retired}</span>
        </div>
      </section>

      <section className="card">
        <div className="mb-4">
          <h2 className="section-title !mb-0">Quick Status Filters</h2>
          <p className="page-subtitle mt-1">
            Jump between lifecycle states quickly.
          </p>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {statusLinks.map((item) => {
            const active = status === item.value;

            return (
              <Link
                key={item.label}
                href={buildKeysPageHref({
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
              <option value="available">Available</option>
              <option value="assigned">Assigned</option>
              <option value="lost">Lost</option>
              <option value="damaged">Damaged</option>
              <option value="retired">Retired</option>
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
              placeholder="Name, code, holder, storage..."
            />
          </label>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button type="submit" className="btn btn-primary">
              Apply Filters
            </button>

            <Link href="/keys" className="btn btn-ghost">
              Reset
            </Link>
          </div>
        </form>
      </section>

      <section className="card">
        <div className="mb-4">
          <h2 className="section-title !mb-0">Keys List</h2>
          <p className="page-subtitle mt-1">
            {keys.length} key{keys.length === 1 ? "" : "s"} found.
          </p>
        </div>

        {keys.length === 0 ? (
          <p className="field-value-muted">
            No keys found for the current filters.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {keys.map((key) => {
              const property = getSingleRelation(key.properties);
              const holderUser = getSingleRelation(key.holder_user);

              const holderDisplay =
                holderUser?.full_name ?? key.holder_name ?? "In storage";

              return (
                <div
                  key={key.id}
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
                        {key.name || "Unnamed Key"}
                      </div>

                      <span
                        className={`badge ${getStatusBadgeClass(key.status)}`}
                      >
                        {key.status || "Unknown"}
                      </span>

                      {key.key_type ? (
                        <span className="badge badge-outline">
                          {key.key_type}
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
                        <div className="field-label">Tag</div>
                        <div className="field-value">
                          {key.key_code || "-"}
                        </div>
                      </div>

                      <div>
                        <div className="field-label">Holder</div>
                        <div className="field-value">{holderDisplay}</div>
                      </div>

                      <div>
                        <div className="field-label">Storage</div>
                        <div className="field-value">
                          {key.storage_location || "-"}
                        </div>
                      </div>

                      <div>
                        <div className="field-label">Last Checked Out</div>
                        <div className="field-value">
                          {formatDate(key.last_checked_out_at)}
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
                    <Link href={`/keys/${key.id}`} className="btn btn-ghost">
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
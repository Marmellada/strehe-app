import Link from "next/link";
import { supabase } from "@/lib/supabase";

type RelatedName = { name: string | null } | { name: string | null }[] | null;

type PropertyRow = {
  id: string;
  property_code: string | null;
  title: string | null;
  address_line_1: string | null;
  property_type: string | null;
  status: string | null;
  municipalities: RelatedName;
  locations: RelatedName;
};

type Municipality = {
  id: string;
  name: string;
};

function getRelatedName(value: RelatedName) {
  if (!value) return "";
  if (Array.isArray(value)) return value[0]?.name || "";
  return value.name || "";
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{
    municipality_id?: string;
    status?: string;
    search?: string;
  }>;
}) {
  const params = await searchParams;

  const municipalityId = params.municipality_id || "";
  const status = params.status || "";
  const search = params.search || "";

  let propertiesQuery = supabase.from("properties").select(`
      id,
      property_code,
      title,
      address_line_1,
      property_type,
      status,
      municipalities(name),
      locations(name)
    `);

  if (municipalityId) {
    propertiesQuery = propertiesQuery.eq("municipality_id", municipalityId);
  }

  if (status) {
    propertiesQuery = propertiesQuery.eq("status", status);
  }

  if (search) {
    propertiesQuery = propertiesQuery.or(
      `title.ilike.%${search}%,property_code.ilike.%${search}%,address_line_1.ilike.%${search}%`
    );
  }

  const [
    propertiesResult,
    municipalitiesResult,
    totalPropertiesResult,
    activePropertiesResult,
    vacantPropertiesResult,
    inactivePropertiesResult,
  ] = await Promise.all([
    propertiesQuery.order("id", { ascending: false }),
    supabase.from("municipalities").select("id, name").order("name"),
    supabase.from("properties").select("*", { count: "exact", head: true }),
    supabase
      .from("properties")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("properties")
      .select("*", { count: "exact", head: true })
      .eq("status", "vacant"),
    supabase
      .from("properties")
      .select("*", { count: "exact", head: true })
      .eq("status", "inactive"),
  ]);

  if (propertiesResult.error) {
    return (
      <div className="card">
        Error loading properties: {propertiesResult.error.message}
      </div>
    );
  }

  if (municipalitiesResult.error) {
    return (
      <div className="card">
        Error loading municipalities: {municipalitiesResult.error.message}
      </div>
    );
  }

  const properties = (propertiesResult.data || []) as PropertyRow[];
  const municipalities = (municipalitiesResult.data || []) as Municipality[];

  return (
    <main style={{ display: "grid", gap: 20 }}>
      <section
        className="row"
        style={{ justifyContent: "space-between", alignItems: "center" }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 28 }}>Properties</h1>
          <p style={{ margin: "6px 0 0", opacity: 0.75 }}>
            Manage all registered properties
          </p>
        </div>

        <Link href="/properties/new" className="btn btn-primary">
          + New Property
        </Link>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        <div className="card">
          <div style={{ fontSize: 13, opacity: 0.7 }}>Total Properties</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>
            {totalPropertiesResult.count ?? 0}
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: 13, opacity: 0.7 }}>Active</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>
            {activePropertiesResult.count ?? 0}
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: 13, opacity: 0.7 }}>Vacant</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>
            {vacantPropertiesResult.count ?? 0}
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: 13, opacity: 0.7 }}>Inactive</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>
            {inactivePropertiesResult.count ?? 0}
          </div>
        </div>
      </section>

      <section className="card">
        <form
          method="GET"
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr auto",
            gap: 12,
            alignItems: "end",
          }}
        >
          <label className="field">
            Search
            <input
              name="search"
              placeholder="Search title, code, or address..."
              defaultValue={search}
              className="input"
            />
          </label>

          <label className="field">
            Municipality
            <select
              name="municipality_id"
              defaultValue={municipalityId}
              className="input"
            >
              <option value="">All municipalities</option>
              {municipalities.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            Status
            <select name="status" defaultValue={status} className="input">
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="vacant">Vacant</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>

          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" className="btn btn-primary">
              Apply
            </button>

            <Link href="/properties" className="btn btn-ghost">
              Clear
            </Link>
          </div>
        </form>
      </section>

      <section className="card" style={{ padding: 0, overflow: "hidden" }}>
        {properties.length === 0 ? (
          <div style={{ padding: 24 }}>
            <h3 style={{ marginTop: 0 }}>No properties found</h3>
            <p style={{ opacity: 0.75 }}>
              Try changing the filters or create your first property.
            </p>
            <Link href="/properties/new" className="btn btn-primary">
              + New Property
            </Link>
          </div>
        ) : (
          <div>
            {properties.map((property, index) => {
              const municipalityName = getRelatedName(property.municipalities);
              const locationName = getRelatedName(property.locations);
              const locationLine = [locationName, municipalityName]
                .filter(Boolean)
                .join(", ");

              return (
                <div
                  key={property.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.7fr 1fr auto",
                    gap: 12,
                    padding: 16,
                    borderTop: index === 0 ? "none" : "1px solid var(--border)",
                    alignItems: "center",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 16,
                        marginBottom: 4,
                      }}
                    >
                      {property.title || "Untitled property"}
                    </div>

                    <div style={{ fontSize: 13, opacity: 0.75 }}>
                      {property.property_code || "No code"}
                      {property.address_line_1 ? ` • ${property.address_line_1}` : ""}
                    </div>

                    {locationLine ? (
                      <div style={{ fontSize: 13, opacity: 0.65, marginTop: 4 }}>
                        {locationLine}
                      </div>
                    ) : null}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        fontSize: 12,
                        border: "1px solid var(--border)",
                        background: "var(--panel)",
                      }}
                    >
                      {property.property_type || "Property"}
                    </span>

                    <span
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        fontSize: 12,
                        border: "1px solid var(--border)",
                        background:
                          property.status === "active"
                            ? "rgba(34,197,94,0.12)"
                            : property.status === "vacant"
                              ? "rgba(245,158,11,0.12)"
                              : "rgba(239,68,68,0.12)",
                      }}
                    >
                      {property.status || "Unknown"}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: 8, justifyContent: "end" }}>
                    <Link
                      href={`/properties/${property.id}`}
                      className="btn btn-ghost"
                    >
                      View
                    </Link>

                    <Link
                      href={`/properties/${property.id}/edit`}
                      className="btn btn-primary"
                    >
                      Edit
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
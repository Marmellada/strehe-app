import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type RelatedName = { name: string | null } | { name: string | null }[] | null;

type ClientRow = {
  id: string;
  client_type: string | null;
  full_name: string | null;
  company_name: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  status: string | null;
  municipalities: RelatedName;
  locations: RelatedName;
};

function getClientDisplayName(client: ClientRow) {
  if (client.client_type === "business") {
    return client.company_name || "Unnamed business";
  }

  return client.full_name || "Unnamed individual";
}

function getRelatedName(value: RelatedName) {
  if (!value) return "";
  if (Array.isArray(value)) return value[0]?.name || "";
  return value.name || "";
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    client_type?: string;
    status?: string;
  }>;
}) {
  const supabase = await createClient();
  const params = await searchParams;

  const search = params.search || "";
  const clientType = params.client_type || "";
  const status = params.status || "";

  let clientsQuery = supabase.from("clients").select(`
      id,
      client_type,
      full_name,
      company_name,
      contact_person,
      phone,
      email,
      status,
      municipalities(name),
      locations(name)
    `);

  if (clientType) {
    clientsQuery = clientsQuery.eq("client_type", clientType);
  }

  if (status) {
    clientsQuery = clientsQuery.eq("status", status);
  }

  if (search) {
    clientsQuery = clientsQuery.or(
      `full_name.ilike.%${search}%,company_name.ilike.%${search}%,contact_person.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`
    );
  }

  const [
    clientsResult,
    totalClientsResult,
    activeClientsResult,
    individualClientsResult,
    businessClientsResult,
  ] = await Promise.all([
    clientsQuery.order("id", { ascending: false }),
    supabase.from("clients").select("*", { count: "exact", head: true }),
    supabase
      .from("clients")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("clients")
      .select("*", { count: "exact", head: true })
      .eq("client_type", "individual"),
    supabase
      .from("clients")
      .select("*", { count: "exact", head: true })
      .eq("client_type", "business"),
  ]);

  if (clientsResult.error) {
    return (
      <div className="card">
        Error loading clients: {clientsResult.error.message}
      </div>
    );
  }

  const clients = (clientsResult.data || []) as ClientRow[];

  return (
    <main style={{ display: "grid", gap: 20 }}>
      <section
        className="row"
        style={{ justifyContent: "space-between", alignItems: "center" }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 28 }}>Clients</h1>
          <p style={{ margin: "6px 0 0", opacity: 0.75 }}>
            Manage individuals and business clients
          </p>
        </div>

        <Link href="/clients/new" className="btn btn-primary">
          + New Client
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
          <div style={{ fontSize: 13, opacity: 0.7 }}>Total Clients</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>
            {totalClientsResult.count ?? 0}
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: 13, opacity: 0.7 }}>Active</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>
            {activeClientsResult.count ?? 0}
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: 13, opacity: 0.7 }}>Individuals</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>
            {individualClientsResult.count ?? 0}
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: 13, opacity: 0.7 }}>Businesses</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>
            {businessClientsResult.count ?? 0}
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
              type="text"
              name="search"
              className="input"
              defaultValue={search}
              placeholder="Search by name, company, phone, email..."
            />
          </label>

          <label className="field">
            Type
            <select
              name="client_type"
              className="input"
              defaultValue={clientType}
            >
              <option value="">All</option>
              <option value="individual">Individual</option>
              <option value="business">Business</option>
            </select>
          </label>

          <label className="field">
            Status
            <select name="status" className="input" defaultValue={status}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>

          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" className="btn btn-primary">
              Apply
            </button>
            <Link href="/clients" className="btn btn-ghost">
              Clear
            </Link>
          </div>
        </form>
      </section>

      <section className="card" style={{ padding: 0, overflow: "hidden" }}>
        {clients.length === 0 ? (
          <div style={{ padding: 24 }}>
            <h3 style={{ marginTop: 0 }}>No clients found</h3>
            <p style={{ opacity: 0.75 }}>
              Try changing the filters or create your first client.
            </p>
            <Link href="/clients/new" className="btn btn-primary">
              + New Client
            </Link>
          </div>
        ) : (
          <div>
            {clients.map((client, index) => {
              const displayName = getClientDisplayName(client);
              const locationName = getRelatedName(client.locations);
              const municipalityName = getRelatedName(client.municipalities);
              const locationLine = [locationName, municipalityName]
                .filter(Boolean)
                .join(", ");

              return (
                <div
                  key={client.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.6fr 1fr auto",
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
                      {displayName}
                    </div>

                    <div style={{ fontSize: 13, opacity: 0.75 }}>
                      {client.contact_person && client.client_type === "business"
                        ? `Contact: ${client.contact_person}`
                        : ""}
                      {client.contact_person &&
                      client.client_type === "business" &&
                      (client.phone || client.email)
                        ? " • "
                        : ""}
                      {client.phone || ""}
                      {client.phone && client.email ? " • " : ""}
                      {client.email || ""}
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
                      {client.client_type === "business"
                        ? "Business"
                        : "Individual"}
                    </span>

                    <span
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        fontSize: 12,
                        border: "1px solid var(--border)",
                        background:
                          client.status === "active"
                            ? "rgba(34,197,94,0.12)"
                            : "rgba(239,68,68,0.12)",
                      }}
                    >
                      {client.status === "active" ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: 8, justifyContent: "end" }}>
                    <Link href={`/clients/${client.id}`} className="btn btn-ghost">
                      View
                    </Link>
                    <Link
                      href={`/clients/${client.id}/edit`}
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

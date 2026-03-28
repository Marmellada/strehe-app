import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default async function DashboardPage() {
  const [
    totalClientsResult,
    activeClientsResult,
    totalPropertiesResult,
    activePropertiesResult,
    vacantPropertiesResult,
    recentClientsResult,
    recentPropertiesResult,
  ] = await Promise.all([
    supabase.from("clients").select("*", { count: "exact", head: true }),
    supabase
      .from("clients")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
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

  const recentClients = recentClientsResult.data || [];
  const recentProperties = recentPropertiesResult.data || [];

  return (
    <main style={{ display: "grid", gap: 20 }}>
      <section
        className="row"
        style={{ justifyContent: "space-between", alignItems: "center" }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 30 }}>Dashboard</h1>
          <p style={{ margin: "6px 0 0", opacity: 0.75 }}>
            Quick overview of clients and properties
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/clients/new" className="btn btn-primary">
            + New Client
          </Link>
          <Link href="/properties/new" className="btn btn-ghost">
            + New Property
          </Link>
        </div>
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
          <div style={{ fontSize: 13, opacity: 0.7 }}>Active Clients</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>
            {activeClientsResult.count ?? 0}
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: 13, opacity: 0.7 }}>Total Properties</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>
            {totalPropertiesResult.count ?? 0}
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: 13, opacity: 0.7 }}>Active Properties</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>
            {activePropertiesResult.count ?? 0}
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: 13, opacity: 0.7 }}>Vacant Properties</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>
            {vacantPropertiesResult.count ?? 0}
          </div>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        <div className="card" style={{ display: "grid", gap: 14 }}>
          <div
            className="row"
            style={{ justifyContent: "space-between", alignItems: "center" }}
          >
            <h3 style={{ margin: 0 }}>Recent Clients</h3>
            <Link href="/clients" className="btn btn-ghost">
              View All
            </Link>
          </div>

          {recentClients.length === 0 ? (
            <p style={{ margin: 0, opacity: 0.75 }}>No clients yet.</p>
          ) : (
            <div style={{ display: "grid" }}>
              {recentClients.map((client, index) => {
                const name =
                  client.client_type === "business"
                    ? client.company_name || "Unnamed business"
                    : client.full_name || "Unnamed individual";

                return (
                  <div
                    key={client.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 12,
                      padding: "12px 0",
                      borderTop:
                        index === 0 ? "none" : "1px solid var(--border)",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{name}</div>
                      <div style={{ fontSize: 13, opacity: 0.7 }}>
                        {client.client_type === "business"
                          ? "Business"
                          : "Individual"}{" "}
                        • {client.status || "Unknown"}
                      </div>
                    </div>

                    <Link
                      href={`/clients/${client.id}`}
                      className="btn btn-ghost"
                    >
                      View
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card" style={{ display: "grid", gap: 14 }}>
          <div
            className="row"
            style={{ justifyContent: "space-between", alignItems: "center" }}
          >
            <h3 style={{ margin: 0 }}>Recent Properties</h3>
            <Link href="/properties" className="btn btn-ghost">
              View All
            </Link>
          </div>

          {recentProperties.length === 0 ? (
            <p style={{ margin: 0, opacity: 0.75 }}>No properties yet.</p>
          ) : (
            <div style={{ display: "grid" }}>
              {recentProperties.map((property, index) => (
                <div
                  key={property.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 12,
                    padding: "12px 0",
                    borderTop:
                      index === 0 ? "none" : "1px solid var(--border)",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {property.title || "Untitled property"}
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.7 }}>
                      {property.property_code || "No code"} •{" "}
                      {property.status || "Unknown"}
                    </div>
                  </div>

                  <Link
                    href={`/properties/${property.id}`}
                    className="btn btn-ghost"
                  >
                    View
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <Link
          href="/clients"
          className="card"
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>Clients</h3>
          <p style={{ margin: 0, opacity: 0.75 }}>
            View, search, edit, and manage all clients.
          </p>
        </Link>

        <Link
          href="/properties"
          className="card"
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>Properties</h3>
          <p style={{ margin: 0, opacity: 0.75 }}>
            Track properties, locations, and ownership details.
          </p>
        </Link>
      </section>
    </main>
  );
}
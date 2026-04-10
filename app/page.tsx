import Link from "next/link";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  StatCard,
} from "@/components/ui";
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
    <main className="grid gap-6">
      <PageHeader
        title="Dashboard"
        description="Quick overview of clients and properties."
        actions={
          <>
            <Button asChild>
              <Link href="/clients/new">New Client</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/properties/new">New Property</Link>
            </Button>
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Total Clients" value={totalClientsResult.count ?? 0} />
        <StatCard title="Active Clients" value={activeClientsResult.count ?? 0} />
        <StatCard title="Total Properties" value={totalPropertiesResult.count ?? 0} />
        <StatCard title="Active Properties" value={activePropertiesResult.count ?? 0} />
        <StatCard title="Vacant Properties" value={vacantPropertiesResult.count ?? 0} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Recent Clients</CardTitle>
              <CardDescription>Latest additions to the client register.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/clients">View All</Link>
            </Button>
          </CardHeader>

          <CardContent className="grid gap-0">
            {recentClients.length === 0 ? (
              <EmptyState
                title="No clients yet"
                description="Once clients are added, the newest ones will appear here."
              />
            ) : (
              <div className="grid">
                {recentClients.map((client, index) => {
                const name =
                  client.client_type === "business"
                    ? client.company_name || "Unnamed business"
                    : client.full_name || "Unnamed individual";

                return (
                  <div
                    key={client.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3"
                    style={{
                      borderTop: index === 0 ? "none" : "1px solid var(--table-row-border)",
                    }}
                  >
                    <div>
                      <div className="font-medium text-foreground">{name}</div>
                      <div className="text-sm text-muted-foreground">
                        {client.client_type === "business"
                          ? "Business"
                          : "Individual"}{" "}
                        • {client.status || "Unknown"}
                      </div>
                    </div>

                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/clients/${client.id}`}>View</Link>
                    </Button>
                  </div>
                );
              })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Recent Properties</CardTitle>
              <CardDescription>Latest properties added to the register.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/properties">View All</Link>
            </Button>
          </CardHeader>

          <CardContent className="grid gap-0">
            {recentProperties.length === 0 ? (
              <EmptyState
                title="No properties yet"
                description="Once properties are added, the newest ones will appear here."
              />
            ) : (
              <div className="grid">
                {recentProperties.map((property, index) => (
                <div
                  key={property.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3"
                  style={{
                    borderTop: index === 0 ? "none" : "1px solid var(--table-row-border)",
                  }}
                >
                  <div>
                    <div className="font-medium text-foreground">
                      {property.title || "Untitled property"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {property.property_code || "No code"} •{" "}
                      {property.status || "Unknown"}
                    </div>
                  </div>

                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/properties/${property.id}`}>View</Link>
                  </Button>
                </div>
              ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Clients</CardTitle>
            <CardDescription>
              View, search, edit, and manage all clients.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="ghost">
              <Link href="/clients">Open Clients</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Properties</CardTitle>
            <CardDescription>
              Track properties, locations, and ownership details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="ghost">
              <Link href="/properties">Open Properties</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

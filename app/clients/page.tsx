import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardContent } from "@/components/ui/Card";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatCard } from "@/components/ui/StatCard";

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

function getClientName(c: ClientRow) {
  return c.client_type === "business"
    ? c.company_name || "Unnamed business"
    : c.full_name || "Unnamed client";
}

function getSingle(value: RelatedName) {
  if (!value) return "";
  if (Array.isArray(value)) return value[0]?.name || "";
  return value.name || "";
}

export default async function ClientsPage() {
  await requireRole(["admin", "office"]);

  const supabase = await createClient();

  const [
    { data: clients },
    { count: total },
    { count: active },
    { count: individuals },
    { count: businesses },
  ] = await Promise.all([
    supabase
      .from("clients")
      .select(
        `
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
      `
      )
      .order("id", { ascending: false }),

    supabase.from("clients").select("*", { count: "exact", head: true }),
    supabase.from("clients").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("clients").select("*", { count: "exact", head: true }).eq("client_type", "individual"),
    supabase.from("clients").select("*", { count: "exact", head: true }).eq("client_type", "business"),
  ]);

  const rows = clients || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Manage individuals and business clients"
        actions={
          <Button asChild>
            <Link href="/clients/new">New Client</Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total" value={total || 0} />
        <StatCard title="Active" value={active || 0} />
        <StatCard title="Individuals" value={individuals || 0} />
        <StatCard title="Businesses" value={businesses || 0} />
      </div>

      <SectionCard title="Clients">
        {rows.length === 0 ? (
         <EmptyState
  title="No clients"
  description="Create your first client to start managing owners, businesses, and related records."
  action={
    <Button asChild>
      <Link href="/clients/new">Create Client</Link>
    </Button>
  }
/>
        ) : (
          <div className="space-y-2">
            {rows.map((c) => {
              const location = [getSingle(c.locations), getSingle(c.municipalities)]
                .filter(Boolean)
                .join(", ");

              return (
                <Card key={c.id}>
                  <CardContent className="flex justify-between items-center">
                    <div>
                      <Link href={`/clients/${c.id}`}>
                        <p className="font-medium">{getClientName(c)}</p>
                      </Link>

                      <p className="text-xs text-muted-foreground">
                        {c.phone || ""} {c.phone && c.email ? "•" : ""} {c.email || ""}
                      </p>

                      {location && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {location}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="neutral">
                        {c.client_type === "business" ? "Business" : "Individual"}
                      </Badge>

                      <Badge variant={c.status === "active" ? "success" : "neutral"}>
                        {c.status || "unknown"}
                      </Badge>

                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/clients/${c.id}`}>Open</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

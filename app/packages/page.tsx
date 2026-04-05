import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatCard } from "@/components/ui/StatCard";
import { SectionCard } from "@/components/ui/SectionCard";

function getSingleRelation<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] || null;
  return value;
}

function formatPrice(value: number | string | null | undefined) {
  if (!value) return "—";
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return "—";
  return `€${num.toFixed(2)}`;
}

export default async function PackagesPage() {
  const supabase = await createClient();

  const [{ data: packages }, { data: subscriptions }] = await Promise.all([
    supabase
      .from("packages")
      .select(
        `
        id,
        name,
        description,
        monthly_price,
        is_active,
        package_services (
          id,
          included_quantity,
          services ( id, name )
        )
      `
      )
      .order("created_at", { ascending: false }),

    supabase.from("subscriptions").select("package_id, status"),
  ]);

  const activeMap = new Map<string, number>();

  for (const s of subscriptions || []) {
    if (!s.package_id) continue;
    if (!["active", "paused"].includes((s.status || "").toLowerCase()))
      continue;

    activeMap.set(
      s.package_id,
      (activeMap.get(s.package_id) || 0) + 1
    );
  }

  const totals = {
    total: packages?.length || 0,
    active: packages?.filter((p) => p.is_active).length || 0,
    inactive: packages?.filter((p) => !p.is_active).length || 0,
    contracts: [...activeMap.values()].reduce((a, b) => a + b, 0),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Packages"
        description="Contractual bundles used in subscriptions"
        actions={
          <Button asChild>
            <Link href="/packages/create">New Package</Link>
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total" value={totals.total} />
        <StatCard title="Active" value={totals.active} />
        <StatCard title="Inactive" value={totals.inactive} />
        <StatCard title="Active Contracts" value={totals.contracts} />
      </div>

      {/* List */}
      <SectionCard title="Packages">
        {!packages || packages.length === 0 ? (
          <EmptyState
            title="No packages"
            action={
              <Button asChild>
                <Link href="/packages/create">Create Package</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {packages.map((pkg) => {
              const services = pkg.package_services || [];

              return (
                <Card key={pkg.id}>
                  <CardContent className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">
                        <Link href={`/packages/${pkg.id}`}>
                          {pkg.name}
                        </Link>
                      </p>

                      <p className="text-sm text-muted-foreground">
                        {pkg.description || "No description"}
                      </p>

                      <p className="text-xs mt-1 text-muted-foreground">
                        {services.length} services
                      </p>
                    </div>

                    <div className="text-right space-y-1">
                      <p>{formatPrice(pkg.monthly_price)}</p>

                      <Badge
                        variant={pkg.is_active ? "default" : "outline"}
                      >
                        {pkg.is_active ? "Active" : "Inactive"}
                      </Badge>

                      <p className="text-xs text-muted-foreground">
                        {activeMap.get(pkg.id) || 0} contracts
                      </p>
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
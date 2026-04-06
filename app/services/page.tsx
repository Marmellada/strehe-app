import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardContent } from "@/components/ui/Card";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatCard } from "@/components/ui/StatCard";

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

export default async function ServicesPage() {
  const supabase = await createClient();

  const { data: services, error } = await supabase
    .from("services")
    .select(
      `
      id,
      name,
      category,
      base_price,
      default_priority,
      is_active
    `
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const rows = services || [];

  const totals = rows.reduce(
    (acc, service) => {
      acc.total += 1;

      if (service.is_active) {
        acc.active += 1;
      } else {
        acc.inactive += 1;
      }

      const price = Number(service.base_price || 0);
      if (!Number.isNaN(price)) {
        acc.totalBasePrice += price;
      }

      return acc;
    },
    {
      total: 0,
      active: 0,
      inactive: 0,
      totalBasePrice: 0,
    }
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Services"
        description="Manage your reusable service catalog"
        actions={
          <Button asChild>
            <Link href="/services/create">New Service</Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Services" value={totals.total} />
        <StatCard title="Active" value={totals.active} />
        <StatCard title="Inactive" value={totals.inactive} />
        <StatCard title="Total Base Price" value={formatPrice(totals.totalBasePrice)} />
      </div>

      <SectionCard
        title="Services List"
        description="Reusable catalog items for packages now and billing later."
      >
        {rows.length === 0 ? (
          <EmptyState
            title="No services found"
            description="Create your first service to start building packages."
            action={
              <Button asChild>
                <Link href="/services/create">New Service</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {rows.map((service) => (
              <Card key={service.id}>
                <CardContent className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <Link
                      href={`/services/${service.id}`}
                      className="font-medium hover:underline"
                    >
                      {service.name || "-"}
                    </Link>

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span>{formatLabel(service.category)}</span>
                      <span>•</span>
                      <span>{formatLabel(service.default_priority)} priority</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium">
                      {formatPrice(service.base_price)}
                    </div>

                    <Badge variant={service.is_active ? "success" : "neutral"}>
  {service.is_active ? "Active" : "Inactive"}
</Badge>

                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/services/${service.id}`}>Open</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatCard } from "@/components/ui/StatCard";
import { SectionCard } from "@/components/ui/SectionCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
} from "@/components/ui/Table";

function formatPrice(value: number | string | null | undefined) {
  if (!value) return "—";
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return "—";
  return `€${num.toFixed(2)}`;
}

function formatServiceCount(value: number) {
  return `${value} service${value === 1 ? "" : "s"}`;
}

export default async function PackagesPage() {
  await requireRole(["admin", "office"]);

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

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total" value={totals.total} />
        <StatCard title="Active" value={totals.active} />
        <StatCard title="Inactive" value={totals.inactive} />
        <StatCard title="Active Contracts" value={totals.contracts} />
      </div>

      <SectionCard
        title="Packages"
        description="Subscription-ready service bundles with monthly pricing."
        contentClassName="p-0"
      >
        {!packages || packages.length === 0 ? (
          <EmptyState
            title="No packages"
            description="Create your first package to start assigning services to properties."
            action={
              <Button asChild>
                <Link href="/packages/create">Create Package</Link>
              </Button>
            }
          />
        ) : (
          <TableShell className="rounded-none border-x-0 border-b-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Package</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Included Services</TableHead>
                  <TableHead>Monthly Price</TableHead>
                  <TableHead>Contracts</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
            {packages.map((pkg) => {
              const services = pkg.package_services || [];

              return (
                <TableRow key={pkg.id}>
                  <TableCell className="font-medium">
                    <Link href={`/packages/${pkg.id}`} className="hover:underline">
                      {pkg.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {pkg.description || "No description"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatServiceCount(services.length)}
                  </TableCell>
                  <TableCell>{formatPrice(pkg.monthly_price)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {activeMap.get(pkg.id) || 0}
                  </TableCell>
                  <TableCell>
                    <Badge variant={pkg.is_active ? "success" : "neutral"}>
                      {pkg.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/packages/${pkg.id}`}>
                        Open
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
              </TableBody>
            </Table>
          </TableShell>
        )}
      </SectionCard>
    </div>
  );
}

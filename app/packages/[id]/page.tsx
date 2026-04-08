import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { DetailField } from "@/components/ui/DetailField";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatCard } from "@/components/ui/StatCard";

type PackagePageProps = {
  params: Promise<{ id: string }>;
};

function formatPrice(value: number | string | null | undefined) {
  if (!value) return "—";
  const num = Number(value);
  if (Number.isNaN(num)) return "—";
  return `€${num.toFixed(2)}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB");
}

export default async function PackageDetailPage({ params }: PackagePageProps) {
  await requireRole(["admin", "office"]);

  const supabase = await createClient();
  const { id } = await params;

  const { data: pkg, error } = await supabase
    .from("packages")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !pkg) return notFound();

  return (
    <div className="space-y-6">

      {/* BACK BUTTON */}
      <Button asChild variant="ghost">
        <Link href="/packages">← Back</Link>
      </Button>

      <PageHeader
        title={pkg.name || "Package"}
        description={pkg.description || "Package details"}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/packages/${pkg.id}/edit`}>Edit</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Price" value={formatPrice(pkg.monthly_price)} />
        <StatCard
          title="Status"
          value={
            <Badge variant={pkg.is_active ? "success" : "neutral"}>
              {pkg.is_active ? "Active" : "Inactive"}
            </Badge>
          }
        />
      </div>

      <SectionCard title="Details">
        <DetailField label="Name" value={pkg.name} />
        <DetailField label="Price" value={formatPrice(pkg.monthly_price)} />
        <DetailField label="Created" value={formatDate(pkg.created_at)} />
      </SectionCard>

      <SectionCard title="Contracts">
        <EmptyState
          title="No contracts"
          description="No contracts are currently linked to this package."
        />
      </SectionCard>
    </div>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { DetailField } from "@/components/ui/DetailField";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatCard } from "@/components/ui/StatCard";
import { requireRole } from "@/lib/auth/require-role";
import DeactivateServiceButton from "./DeactivateServiceButton";

async function deleteService(formData: FormData) {
  "use server";

  await requireRole(["admin", "office"]);
  const supabase = await createClient();
  const id = String(formData.get("id") || "").trim();

  if (!id) throw new Error("Missing service id.");

  const { error } = await supabase
    .from("services")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  redirect("/services");
}

function formatLabel(value: string | null | undefined) {
  if (!value) return "-";
  return value.replaceAll("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatPrice(value: number | string | null | undefined) {
  if (!value) return "-";
  const num = Number(value);
  if (Number.isNaN(num)) return "-";
  return `€${num.toFixed(2)}`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-GB");
}

type Props = {
  params: Promise<{ id: string }>;
};

export default async function Page({ params }: Props) {
  await requireRole(["admin", "office"]);

  const supabase = await createClient();
  const { id } = await params;

  const { data: service, error } = await supabase
    .from("services")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !service) return notFound();

  return (
    <div className="space-y-6">
      {/* Back button FIX */}
      <div>
        <Button asChild variant="ghost">
          <Link href="/services">← Back to services</Link>
        </Button>
      </div>

      <PageHeader
        title={service.name || "Untitled Service"}
        description={formatLabel(service.category)}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/services/${service.id}/edit`}>Edit</Link>
            </Button>

            <form action={deleteService}>
              <input type="hidden" name="id" value={service.id} />
              <DeactivateServiceButton />
            </form>
          </>
        }
      />

      <Card size="sm">
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Services define reusable pricing and task defaults.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Category" value={formatLabel(service.category)} />
        <StatCard title="Base Price" value={formatPrice(service.base_price)} />
        <StatCard title="Priority" value={formatLabel(service.default_priority)} />
        <StatCard
          title="Status"
          value={
            <Badge variant={service.is_active ? "success" : "neutral"}>
  {service.is_active ? "Active" : "Inactive"}
</Badge>
          }
        />
      </div>

      <SectionCard
        title="Details"
        contentClassName="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        <DetailField label="Name" value={service.name} />
        <DetailField label="Category" value={formatLabel(service.category)} />
        <DetailField label="Price" value={formatPrice(service.base_price)} />
        <DetailField label="Status" value={service.is_active ? "Active" : "Inactive"} />
      </SectionCard>

      <SectionCard title="Description">
        <div className="text-sm">
          {service.description || "No description"}
        </div>
      </SectionCard>

      <SectionCard
        title="System"
        contentClassName="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        <DetailField label="Created" value={formatDateTime(service.created_at)} />
        <DetailField label="Updated" value={formatDateTime(service.updated_at)} />
      </SectionCard>
    </div>
  );
}

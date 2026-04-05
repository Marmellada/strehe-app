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

async function deleteService(formData: FormData) {
  "use server";

  const supabase = await createClient();
  const id = String(formData.get("id") || "").trim();

  if (!id) {
    throw new Error("Missing service id.");
  }

  const { error } = await supabase.from("services").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  redirect("/services");
}

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

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";

  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type ServicePageProps = {
  params: Promise<{ id: string }>;
};

export default async function ServiceDetailPage({
  params,
}: ServicePageProps) {
  const supabase = await createClient();
  const { id } = await params;

  const { data: service, error } = await supabase
    .from("services")
    .select(
      `
      id,
      name,
      description,
      category,
      base_price,
      default_priority,
      default_title,
      default_description,
      is_active,
      created_at,
      updated_at
    `
    )
    .eq("id", id)
    .single();

  if (error || !service) {
    return notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={service.name || "Untitled Service"}
        description={formatLabel(service.category)}
        backHref="/services"
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/services/${service.id}/edit`}>Edit Service</Link>
            </Button>

            <form action={deleteService}>
              <input type="hidden" name="id" value={service.id} />
              <Button type="submit" variant="destructive">
                Delete Service
              </Button>
            </form>
          </>
        }
      />

      <Card size="sm">
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Services are reusable catalog items. They define pricing and default
            task behavior, and can be used in packages now and in billing later.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Category" value={formatLabel(service.category)} />
        <StatCard title="Base Price" value={formatPrice(service.base_price)} />
        <StatCard
          title="Default Priority"
          value={formatLabel(service.default_priority)}
        />
        <StatCard
          title="Status"
          value={
            <Badge variant={service.is_active ? "default" : "outline"}>
              {service.is_active ? "Active" : "Inactive"}
            </Badge>
          }
        />
      </div>

      <SectionCard
        title="Service Details"
        contentClassName="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        <DetailField label="Name" value={service.name || "-"} />
        <DetailField label="Category" value={formatLabel(service.category)} />
        <DetailField label="Base Price" value={formatPrice(service.base_price)} />
        <DetailField
          label="Default Priority"
          value={formatLabel(service.default_priority)}
        />
        <DetailField
          label="Status"
          value={service.is_active ? "Active" : "Inactive"}
        />
      </SectionCard>

      <SectionCard
        title="Task Template"
        description="These defaults are used when recurring or manual task records are created from this service."
        contentClassName="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        <DetailField
          label="Default Task Title"
          value={service.default_title || "No default title set."}
          className="md:col-span-2"
        />
        <DetailField
          label="Default Task Description"
          value={service.default_description || "No default description set."}
          className="md:col-span-2"
        />
        <DetailField
          label="Default Priority"
          value={formatLabel(service.default_priority)}
        />
      </SectionCard>

      <SectionCard title="Description">
        <div className="text-sm">
          {service.description || "No description provided."}
        </div>
      </SectionCard>

      <SectionCard
        title="System Info"
        contentClassName="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        <DetailField
          label="Created At"
          value={formatDateTime(service.created_at)}
        />
        <DetailField
          label="Updated At"
          value={formatDateTime(service.updated_at)}
        />
      </SectionCard>
    </div>
  );
}
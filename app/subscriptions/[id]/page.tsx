import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardContent } from "@/components/ui/Card";
import { DetailField } from "@/components/ui/DetailField";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatCard } from "@/components/ui/StatCard";

type SubscriptionPageProps = {
  params: Promise<{ id: string }>;
};

type ClientRelation =
  | {
      id: string;
      full_name: string | null;
      company_name: string | null;
    }
  | {
      id: string;
      full_name: string | null;
      company_name: string | null;
    }[]
  | null;

type PropertyRelation =
  | {
      id: string;
      title: string | null;
      property_code: string | null;
      address_line_1: string | null;
    }
  | {
      id: string;
      title: string | null;
      property_code: string | null;
      address_line_1: string | null;
    }[]
  | null;

type PackageRelation =
  | {
      id: string;
      name: string | null;
      monthly_price: number | string | null;
      description: string | null;
    }
  | {
      id: string;
      name: string | null;
      monthly_price: number | string | null;
      description: string | null;
    }[]
  | null;

type ServiceRelation =
  | {
      id: string;
      name: string | null;
      category: string | null;
      base_price: number | string | null;
      default_priority: string | null;
      default_title: string | null;
      is_active: boolean | null;
    }
  | {
      id: string;
      name: string | null;
      category: string | null;
      base_price: number | string | null;
      default_priority: string | null;
      default_title: string | null;
      is_active: boolean | null;
    }[]
  | null;

type PackageServiceRow = {
  id: string;
  package_id: string;
  service_id: string;
  included_quantity: number | null;
  service: ServiceRelation;
};

type SubscriptionRow = {
  id: string;
  client_id: string;
  property_id: string;
  package_id: string;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  monthly_price: number | string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  client: ClientRelation;
  property: PropertyRelation;
  package: PackageRelation;
};

function getSingleRelation<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] || null;
  return value;
}

function formatLabel(value: string | null | undefined) {
  if (!value) return "-";
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char: string) => char.toUpperCase());
}

function formatPrice(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return "-";
  return `€${num.toFixed(2)}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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

function getBadgeVariant(status: string | null | undefined) {
  switch ((status || "").toLowerCase()) {
    case "active":
      return "success" as const;
    case "paused":
      return "info" as const;
    case "cancelled":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

async function deleteSubscription(formData: FormData) {
  "use server";

  const supabase = await createClient();
  const id = String(formData.get("id") || "").trim();

  if (!id) {
    throw new Error("Missing contract id.");
  }

  const { error } = await supabase.from("subscriptions").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  redirect("/subscriptions");
}

export default async function SubscriptionDetailPage({
  params,
}: SubscriptionPageProps) {
  const supabase = await createClient();
  const { id } = await params;

  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      `
      id,
      client_id,
      property_id,
      package_id,
      start_date,
      end_date,
      status,
      monthly_price,
      notes,
      created_at,
      updated_at,
      client:clients!subscriptions_client_fk (
        id,
        full_name,
        company_name
      ),
      property:properties!subscriptions_property_fk (
        id,
        title,
        property_code,
        address_line_1
      ),
      package:packages!subscriptions_package_fk (
        id,
        name,
        monthly_price,
        description
      )
    `
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return notFound();
  }

  const subscription = data as SubscriptionRow;
  const client = getSingleRelation(subscription.client);
  const property = getSingleRelation(subscription.property);
  const pkg = getSingleRelation(subscription.package);

  const { data: includedServices, error: servicesError } = await supabase
    .from("package_services")
    .select(
      `
      id,
      package_id,
      service_id,
      included_quantity,
      service:services!package_services_service_fk (
        id,
        name,
        category,
        base_price,
        default_priority,
        default_title,
        is_active
      )
    `
    )
    .eq("package_id", subscription.package_id)
    .order("created_at", { ascending: true });

  if (servicesError) {
    throw new Error(servicesError.message);
  }

  const serviceRows = (includedServices || []) as PackageServiceRow[];

  const clientName = client?.company_name || client?.full_name || "-";
  const propertyLabel = property?.property_code
    ? `${property.property_code} - ${property.title || ""}`
    : property?.title || "-";

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost">
          <Link href="/subscriptions">← Back</Link>
        </Button>
      </div>

      <PageHeader
        title="Contract"
        description={clientName}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/subscriptions/${subscription.id}/edit`}>
                Edit Contract
              </Link>
            </Button>

            <Button asChild variant="outline">
              <Link
                href={`/subscriptions/${subscription.id}/pdf`}
                target="_blank"
              >
                Open PDF
              </Link>
            </Button>

            <Button asChild>
              <Link
                href={`/subscriptions/${subscription.id}/pdf?download=1`}
                target="_blank"
              >
                Download PDF
              </Link>
            </Button>

            <form action={deleteSubscription}>
              <input type="hidden" name="id" value={subscription.id} />
              <Button type="submit" variant="destructive">
                Delete Contract
              </Button>
            </form>
          </>
        }
      />

      <Card size="sm">
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This contract is the source record for scheduled recurring work.
            Tasks are not created at contract creation time. The scheduled
            generator reads this contract later together with package services.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Status"
          value={
            <Badge variant={getBadgeVariant(subscription.status)}>
              {formatLabel(subscription.status)}
            </Badge>
          }
        />
        <StatCard
          title="Contract Price"
          value={formatPrice(subscription.monthly_price)}
        />
        <StatCard
          title="Package Price"
          value={formatPrice(pkg?.monthly_price)}
        />
        <StatCard
          title="Start Date"
          value={formatDate(subscription.start_date)}
        />
        <StatCard title="Included Services" value={serviceRows.length} />
      </div>

      <SectionCard
        title="Contract Details"
        contentClassName="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        <DetailField label="Client" value={clientName} />
        <DetailField label="Property" value={propertyLabel} />
        <DetailField label="Package" value={pkg?.name || "-"} />
        <DetailField label="Status" value={formatLabel(subscription.status)} />
        <DetailField
          label="Monthly Price"
          value={formatPrice(subscription.monthly_price)}
        />
        <DetailField
          label="Package Default Price"
          value={formatPrice(pkg?.monthly_price)}
        />
        <DetailField
          label="Start Date"
          value={formatDate(subscription.start_date)}
        />
        <DetailField
          label="End Date"
          value={formatDate(subscription.end_date)}
        />
      </SectionCard>

      <SectionCard
        title="Property Details"
        contentClassName="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        <DetailField
          label="Property Code"
          value={property?.property_code || "-"}
        />
        <DetailField label="Title" value={property?.title || "-"} />
        <DetailField
          label="Address"
          value={property?.address_line_1 || "-"}
          className="md:col-span-2"
        />
      </SectionCard>

      <SectionCard
        title="Package Details"
        contentClassName="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        <DetailField label="Package Name" value={pkg?.name || "-"} />
        <DetailField
          label="Package Price"
          value={formatPrice(pkg?.monthly_price)}
        />
        <DetailField
          label="Package Description"
          value={pkg?.description || "No description provided."}
          className="md:col-span-2"
        />
      </SectionCard>

      <SectionCard
        title="Included Services"
        description="These package services are what the scheduled generator reads for future recurring work."
      >
        {serviceRows.length === 0 ? (
          <EmptyState
            title="No services linked"
            description="This package does not have any included services yet."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="px-2 py-3 font-medium text-muted-foreground">
                    Service
                  </th>
                  <th className="px-2 py-3 font-medium text-muted-foreground">
                    Category
                  </th>
                  <th className="px-2 py-3 font-medium text-muted-foreground">
                    Qty / Month
                  </th>
                  <th className="px-2 py-3 font-medium text-muted-foreground">
                    Base Price
                  </th>
                  <th className="px-2 py-3 font-medium text-muted-foreground">
                    Default Task Title
                  </th>
                  <th className="px-2 py-3 font-medium text-muted-foreground">
                    Default Priority
                  </th>
                  <th className="px-2 py-3 font-medium text-muted-foreground">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {serviceRows.map((row) => {
                  const service = getSingleRelation(row.service);

                  return (
                    <tr key={row.id} className="border-b last:border-b-0">
                      <td className="px-2 py-4">{service?.name || "-"}</td>
                      <td className="px-2 py-4">
                        {formatLabel(service?.category)}
                      </td>
                      <td className="px-2 py-4">{row.included_quantity ?? "-"}</td>
                      <td className="px-2 py-4">
                        {formatPrice(service?.base_price)}
                      </td>
                      <td className="px-2 py-4">
                        {service?.default_title || "-"}
                      </td>
                      <td className="px-2 py-4">
                        {formatLabel(service?.default_priority)}
                      </td>
                      <td className="px-2 py-4">
                        <Badge
                          variant={service?.is_active ? "success" : "neutral"}
                        >
                          {service?.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Notes">
        <div className="text-sm">
          {subscription.notes || "No notes provided."}
        </div>
      </SectionCard>

      <SectionCard
        title="System Info"
        contentClassName="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        <DetailField
          label="Created At"
          value={formatDateTime(subscription.created_at)}
        />
        <DetailField
          label="Updated At"
          value={formatDateTime(subscription.updated_at)}
        />
      </SectionCard>
    </div>
  );
}
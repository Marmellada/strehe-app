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

type PackagePageProps = {
  params: Promise<{ id: string }>;
};

type ServiceRelation =
  | {
      id: string;
      name: string | null;
      category: string | null;
      base_price: number | string | null;
      is_active: boolean | null;
    }
  | {
      id: string;
      name: string | null;
      category: string | null;
      base_price: number | string | null;
      is_active: boolean | null;
    }[]
  | null;

type IncludedServiceRow = {
  id: string;
  package_id: string;
  service_id: string;
  included_quantity: number | null;
  service: ServiceRelation;
};

type ContractRow = {
  id: string;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  monthly_price: number | string | null;
  property:
    | {
        id: string;
        title: string | null;
        property_code: string | null;
      }
    | {
        id: string;
        title: string | null;
        property_code: string | null;
      }[]
    | null;
  client:
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
};

function getSingleRelation<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] || null;
  return value;
}

function formatLabel(value: string | null | undefined) {
  if (!value) return "—";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (l: string) => l.toUpperCase());
}

function formatPrice(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";

  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return "—";

  return `€${num.toFixed(2)}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getBadgeVariant(status: string | null | undefined) {
  switch ((status || "").toLowerCase()) {
    case "active":
      return "default" as const;
    case "paused":
      return "secondary" as const;
    case "cancelled":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

async function deletePackage(formData: FormData) {
  "use server";

  const supabase = await createClient();

  const id = String(formData.get("id") || "").trim();

  if (!id) {
    throw new Error("Missing package id.");
  }

  const { count, error: countError } = await supabase
    .from("subscriptions")
    .select("*", { count: "exact", head: true })
    .eq("package_id", id)
    .in("status", ["active", "paused"]);

  if (countError) {
    throw new Error(countError.message);
  }

  if ((count || 0) > 0) {
    throw new Error(
      "This package has active or paused contracts and cannot be deleted."
    );
  }

  const { error: linkDeleteError } = await supabase
    .from("package_services")
    .delete()
    .eq("package_id", id);

  if (linkDeleteError) {
    throw new Error(linkDeleteError.message);
  }

  const { error } = await supabase.from("packages").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  redirect("/packages");
}

async function addPackageService(formData: FormData) {
  "use server";

  const supabase = await createClient();

  const package_id = String(formData.get("package_id") || "").trim();
  const service_id = String(formData.get("service_id") || "").trim();
  const included_quantity_raw = String(
    formData.get("included_quantity") || "1"
  ).trim();

  if (!package_id || !service_id) {
    throw new Error("Package and service are required.");
  }

  const included_quantity = Number(included_quantity_raw);

  if (
    Number.isNaN(included_quantity) ||
    !Number.isInteger(included_quantity) ||
    included_quantity <= 0
  ) {
    throw new Error("Included quantity must be a whole number greater than 0.");
  }

  const { data: existingRow, error: existingError } = await supabase
    .from("package_services")
    .select("id, included_quantity")
    .eq("package_id", package_id)
    .eq("service_id", service_id)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existingRow) {
    const { error: updateError } = await supabase
      .from("package_services")
      .update({
        included_quantity:
          Number(existingRow.included_quantity || 0) + included_quantity,
      })
      .eq("id", existingRow.id);

    if (updateError) {
      throw new Error(updateError.message);
    }
  } else {
    const { error: insertError } = await supabase.from("package_services").insert({
      package_id,
      service_id,
      included_quantity,
    });

    if (insertError) {
      throw new Error(insertError.message);
    }
  }

  redirect(`/packages/${package_id}`);
}

async function removePackageService(formData: FormData) {
  "use server";

  const supabase = await createClient();

  const id = String(formData.get("id") || "").trim();
  const package_id = String(formData.get("package_id") || "").trim();

  if (!id || !package_id) {
    throw new Error("Missing package service id.");
  }

  const { error } = await supabase.from("package_services").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/packages/${package_id}`);
}

export default async function PackageDetailPage({
  params,
}: PackagePageProps) {
  const supabase = await createClient();
  const { id } = await params;

  const [
    { data: pkg, error },
    { data: includedServices, error: includedServicesError },
    { data: availableServices, error: availableServicesError },
    { data: subscriptions, error: subscriptionsError },
  ] = await Promise.all([
    supabase
      .from("packages")
      .select(
        `
        id,
        name,
        description,
        monthly_price,
        is_active,
        created_at,
        updated_at
      `
      )
      .eq("id", id)
      .single(),

    supabase
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
          is_active
        )
      `
      )
      .eq("package_id", id)
      .order("created_at", { ascending: true }),

    supabase
      .from("services")
      .select(
        `
        id,
        name,
        category,
        base_price,
        is_active
      `
      )
      .eq("is_active", true)
      .order("name", { ascending: true }),

    supabase
      .from("subscriptions")
      .select(
        `
        id,
        status,
        start_date,
        end_date,
        monthly_price,
        property:properties!subscriptions_property_fk (
          id,
          title,
          property_code
        ),
        client:clients!subscriptions_client_fk (
          id,
          full_name,
          company_name
        )
      `
      )
      .eq("package_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (error || !pkg) {
    return notFound();
  }

  if (includedServicesError) {
    throw new Error(includedServicesError.message);
  }

  if (availableServicesError) {
    throw new Error(availableServicesError.message);
  }

  if (subscriptionsError) {
    throw new Error(subscriptionsError.message);
  }

  const serviceRows = (includedServices || []) as IncludedServiceRow[];
  const serviceOptions = (availableServices || []) as any[];
  const contractRows = (subscriptions || []) as ContractRow[];

  const activeContracts = contractRows.filter((row) => {
    const status = (row.status || "").toLowerCase();
    return status === "active" || status === "paused";
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={pkg.name || "Untitled Package"}
        description={pkg.is_active ? "Active package" : "Inactive package"}
        backHref="/packages"
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/packages/${pkg.id}/edit`}>Edit Package</Link>
            </Button>

            <form action={deletePackage}>
              <input type="hidden" name="id" value={pkg.id} />
              <Button type="submit" variant="destructive">
                Delete Package
              </Button>
            </form>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Monthly Price" value={formatPrice(pkg.monthly_price)} />
        <StatCard
          title="Status"
          value={
            <Badge variant={pkg.is_active ? "default" : "outline"}>
              {pkg.is_active ? "Active" : "Inactive"}
            </Badge>
          }
        />
        <StatCard title="Included Services" value={serviceRows.length} />
        <StatCard title="Active Contracts" value={activeContracts.length} />
      </div>

      <SectionCard
        title="Package Details"
        contentClassName="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        <DetailField label="Name" value={pkg.name || "—"} />
        <DetailField label="Monthly Price" value={formatPrice(pkg.monthly_price)} />
        <DetailField label="Created" value={formatDate(pkg.created_at)} />
        <DetailField label="Updated" value={formatDate(pkg.updated_at)} />
        <DetailField
          label="Description"
          value={pkg.description || "No description provided."}
          className="md:col-span-2"
        />
      </SectionCard>

      <SectionCard
        title="Included Services"
        description="These are the service quantities included in this contractual package."
      >
        <form action={addPackageService} className="space-y-4">
          <input type="hidden" name="package_id" value={pkg.id} />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="service_id" className="text-sm font-medium">
                Service
              </label>
              <select
                id="service_id"
                name="service_id"
                defaultValue=""
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  Select service
                </option>
                {serviceOptions.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} ({formatLabel(service.category)})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="included_quantity" className="text-sm font-medium">
                Included Quantity
              </label>
              <input
                id="included_quantity"
                name="included_quantity"
                type="number"
                min="1"
                step="1"
                defaultValue="1"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <Button type="submit">Add Service</Button>
        </form>

        <div className="mt-6">
          {serviceRows.length === 0 ? (
            <EmptyState
              title="No services added"
              description="Add the first service to define what is included in this package."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="px-2 py-3 font-medium text-muted-foreground">Service</th>
                    <th className="px-2 py-3 font-medium text-muted-foreground">Category</th>
                    <th className="px-2 py-3 font-medium text-muted-foreground">Base Price</th>
                    <th className="px-2 py-3 font-medium text-muted-foreground">Included Qty</th>
                    <th className="px-2 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="px-2 py-3 font-medium text-muted-foreground"></th>
                  </tr>
                </thead>

                <tbody>
                  {serviceRows.map((row) => {
                    const service = getSingleRelation(row.service);

                    return (
                      <tr key={row.id} className="border-b last:border-b-0">
                        <td className="px-2 py-4">
                          <Link
                            href={`/services/${service?.id}`}
                            className="font-medium hover:underline"
                          >
                            {service?.name || "Unnamed service"}
                          </Link>
                        </td>
                        <td className="px-2 py-4">{formatLabel(service?.category)}</td>
                        <td className="px-2 py-4">{formatPrice(service?.base_price)}</td>
                        <td className="px-2 py-4">{row.included_quantity ?? "—"}</td>
                        <td className="px-2 py-4">
                          <Badge variant={service?.is_active ? "default" : "outline"}>
                            {service?.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="px-2 py-4">
                          <form action={removePackageService}>
                            <input type="hidden" name="id" value={row.id} />
                            <input type="hidden" name="package_id" value={pkg.id} />
                            <Button type="submit" variant="ghost" size="sm">
                              Remove
                            </Button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Contracts Using This Package"
        description="Shows which properties are currently or historically linked to this package."
      >
        {contractRows.length === 0 ? (
          <EmptyState
            title="No contracts found"
            description="This package has not been used in any contract yet."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="px-2 py-3 font-medium text-muted-foreground">Client</th>
                  <th className="px-2 py-3 font-medium text-muted-foreground">Property</th>
                  <th className="px-2 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="px-2 py-3 font-medium text-muted-foreground">Monthly Price</th>
                  <th className="px-2 py-3 font-medium text-muted-foreground">Period</th>
                  <th className="px-2 py-3 font-medium text-muted-foreground"></th>
                </tr>
              </thead>

              <tbody>
                {contractRows.map((row) => {
                  const client = getSingleRelation(row.client);
                  const property = getSingleRelation(row.property);

                  const clientName =
                    client?.company_name || client?.full_name || "—";

                  const propertyName = property?.property_code
                    ? `${property.property_code} - ${property.title || ""}`
                    : property?.title || "—";

                  return (
                    <tr key={row.id} className="border-b last:border-b-0">
                      <td className="px-2 py-4">{clientName}</td>
                      <td className="px-2 py-4">{propertyName}</td>
                      <td className="px-2 py-4">
                        <Badge variant={getBadgeVariant(row.status)}>
                          {formatLabel(row.status)}
                        </Badge>
                      </td>
                      <td className="px-2 py-4">{formatPrice(row.monthly_price)}</td>
                      <td className="px-2 py-4">
                        {formatDate(row.start_date)} — {formatDate(row.end_date)}
                      </td>
                      <td className="px-2 py-4">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/subscriptions/${row.id}`}>Open</Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
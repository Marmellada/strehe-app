import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";

import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardContent } from "@/components/ui/Card";
import { DetailField } from "@/components/ui/DetailField";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  TableShell,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/Table";
import { requireRole } from "@/lib/auth/require-role";
import { formatStatusLabel } from "@/lib/ui/status";
import CancelContractButton from "./CancelContractButton";

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
  client_name_snapshot: string | null;
  property_code_snapshot: string | null;
  package_name_snapshot: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  monthly_price: number | string | null;
  notes: string | null;
  physical_contract_confirmed_at: string | null;
  physical_contract_confirmed_by_user_id: string | null;
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

async function deleteSubscription(formData: FormData) {
  "use server";

  await requireRole(["admin"]);
  const supabase = await createClient();
  const id = String(formData.get("id") || "").trim();

  if (!id) {
    throw new Error("Missing contract id.");
  }

  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  redirect("/subscriptions");
}

async function confirmPhysicalContract(formData: FormData) {
  "use server";

  const { authUser } = await requireRole(["admin"]);
  const supabase = await createClient();
  const id = String(formData.get("id") || "").trim();

  if (!id) {
    throw new Error("Missing contract id.");
  }

  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: "active",
      physical_contract_confirmed_at: new Date().toISOString(),
      physical_contract_confirmed_by_user_id: authUser.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/subscriptions/${id}`);
}

export default async function SubscriptionDetailPage({
  params,
}: SubscriptionPageProps) {
  await requireRole(["admin"]);

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
      client_name_snapshot,
      property_code_snapshot,
      package_name_snapshot,
      start_date,
      end_date,
      status,
      monthly_price,
      notes,
      physical_contract_confirmed_at,
      physical_contract_confirmed_by_user_id,
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

  const clientName =
    subscription.client_name_snapshot ||
    client?.company_name ||
    client?.full_name ||
    "-";
  const propertyLabel = subscription.property_code_snapshot
    ? subscription.property_code_snapshot
    : property?.property_code
    ? `${property.property_code} - ${property.title || ""}`
    : property?.title || "-";
  const packageName =
    subscription.package_name_snapshot ||
    pkg?.name ||
    "-";
  const canConfirmPhysicalContract =
    subscription.status === "draft" || subscription.status === "prepared";

  let physicalContractConfirmedBy = "-";

  if (subscription.physical_contract_confirmed_by_user_id) {
    const { data: confirmer } = await supabase
      .from("app_users")
      .select("full_name, email")
      .eq("id", subscription.physical_contract_confirmed_by_user_id)
      .maybeSingle();

    physicalContractConfirmedBy =
      confirmer?.full_name?.trim() || confirmer?.email || "-";
  }

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
              <CancelContractButton />
            </form>

            {canConfirmPhysicalContract ? (
              <form action={confirmPhysicalContract}>
                <input type="hidden" name="id" value={subscription.id} />
                <Button type="submit">Confirm Signed & Filed</Button>
              </form>
            ) : null}
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

      {canConfirmPhysicalContract ? (
        <Alert>
          <AlertTitle>Awaiting paper confirmation</AlertTitle>
          <AlertDescription>
            This contract stays in draft or prepared until someone confirms the physical signed copy was filed.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard
          title="Status"
          value={
            <StatusBadge status={subscription.status} />
          }
        />
        <StatCard
          title="Paper Filed"
          value={
            subscription.physical_contract_confirmed_at
              ? formatDate(subscription.physical_contract_confirmed_at)
              : "Pending"
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
        <DetailField label="Package" value={packageName} />
        <DetailField
          label="Status"
          value={formatStatusLabel(subscription.status)}
        />
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
        <DetailField
          label="Paper Contract Confirmed"
          value={
            subscription.physical_contract_confirmed_at
              ? formatDateTime(subscription.physical_contract_confirmed_at)
              : "Not yet confirmed"
          }
        />
        <DetailField
          label="Confirmed By"
          value={physicalContractConfirmedBy}
        />
      </SectionCard>

      <SectionCard
        title="Property Details"
        contentClassName="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        <DetailField
          label="Property Code"
          value={subscription.property_code_snapshot || property?.property_code || "-"}
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
        <DetailField label="Package Name" value={packageName} />
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
          <TableShell>
            <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Qty / Month</TableHead>
                  <TableHead>Base Price</TableHead>
                  <TableHead>Default Task Title</TableHead>
                  <TableHead>Default Priority</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {serviceRows.map((row) => {
                  const service = getSingleRelation(row.service);

                  return (
                    <TableRow key={row.id}>
                      <TableCell>{service?.name || "-"}</TableCell>
                      <TableCell>
                        {formatStatusLabel(service?.category)}
                      </TableCell>
                      <TableCell>{row.included_quantity ?? "-"}</TableCell>
                      <TableCell>
                        {formatPrice(service?.base_price)}
                      </TableCell>
                      <TableCell>
                        {service?.default_title || "-"}
                      </TableCell>
                      <TableCell>
                        {formatStatusLabel(service?.default_priority)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          status={service?.is_active ? "active" : "inactive"}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableShell>
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

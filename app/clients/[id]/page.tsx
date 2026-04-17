import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import { DetailField } from "@/components/ui/DetailField";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { formatStatusLabel, getStatusVariant } from "@/lib/ui/status";
import { requireRole } from "@/lib/auth/require-role";
import DeleteClientButton from "./DeleteClientButton";

type OwnedPropertyRow = {
  id: string;
  property_code: string | null;
  title: string | null;
  status: string | null;
  address_line_1: string | null;
};

type ContractRow = {
  id: string;
  status: string | null;
  property_id: string | null;
  packages:
    | { name: string | null }
    | { name: string | null }[]
    | null;
  properties:
    | { title: string | null; property_code: string | null }
    | { title: string | null; property_code: string | null }[]
    | null;
};

type TaskRow = {
  id: string;
  title: string | null;
  status: string | null;
  property_id: string | null;
  properties:
    | { title: string | null; property_code: string | null }
    | { title: string | null; property_code: string | null }[]
    | null;
};

type InvoiceRow = {
  id: string;
  invoice_number: string | null;
  status: string | null;
  total_cents: number | null;
  property_id: string | null;
  property_label_snapshot: string | null;
};

async function deleteClient(id: string) {
  "use server";

  await requireRole(["admin", "office"]);
  const supabase = await createClient();

  const { error } = await supabase
    .from("clients")
    .update({
      status: "inactive",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  redirect("/clients");
}

function getSingle<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] || null;
  return value;
}

function formatMoneyFromCents(value: number | null | undefined) {
  return `€${((value || 0) / 100).toFixed(2)}`;
}

function isOpenTaskStatus(status: string | null | undefined) {
  const normalized = (status || "").toLowerCase();
  return !["completed", "done", "cancelled"].includes(normalized);
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["admin", "office"]);

  const supabase = await createClient();
  const { id } = await params;

  const [{ data: rawClient }, { data: ownedProperties }] = await Promise.all([
    supabase
      .from("clients")
      .select(
        `
        *,
        municipality:municipalities(name),
        location:locations(name)
      `
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("properties")
      .select("id, property_code, title, status, address_line_1")
      .eq("owner_client_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!rawClient) return notFound();

  const client = rawClient;
  const properties = (ownedProperties || []) as OwnedPropertyRow[];
  const propertyIds = properties.map((property) => property.id);

  const [contractsResult, tasksResult, allTasksResult, invoicesResult] = propertyIds.length
    ? await Promise.all([
        supabase
          .from("subscriptions")
          .select(
            `
            id,
            status,
            property_id,
            packages(name),
            properties(title, property_code)
          `
          )
          .in("property_id", propertyIds)
          .order("start_date", { ascending: false }),
        supabase
          .from("tasks")
          .select(
            `
            id,
            title,
            status,
            property_id,
            properties(title, property_code)
          `
          )
          .in("property_id", propertyIds)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("tasks")
          .select("id, status")
          .in("property_id", propertyIds),
        supabase
          .from("invoices")
          .select(
            `
            id,
            invoice_number,
            status,
            total_cents,
            property_id,
            property_label_snapshot
          `
          )
          .eq("client_id", id)
          .order("created_at", { ascending: false })
          .limit(5),
      ])
    : [
        { data: [] as ContractRow[] },
        { data: [] as TaskRow[] },
        { data: [] as Array<{ id: string; status: string | null }> },
        { data: [] as InvoiceRow[] },
      ];

  const municipality = getSingle(client.municipality);
  const location = getSingle(client.location);
  const contracts = (contractsResult.data || []) as ContractRow[];
  const tasks = (tasksResult.data || []) as TaskRow[];
  const allTasks = (allTasksResult.data || []) as Array<{
    id: string;
    status: string | null;
  }>;
  const invoices = (invoicesResult.data || []) as InvoiceRow[];
  const activeContractsCount = contracts.filter(
    (contract) => (contract.status || "").toLowerCase() === "active"
  ).length;
  const openTasksCount = allTasks.filter((task) =>
    isOpenTaskStatus(task.status)
  ).length;
  const draftInvoicesCount = invoices.filter(
    (invoice) => (invoice.status || "").toLowerCase() === "draft"
  ).length;
  const issuedInvoicesCount = invoices.filter(
    (invoice) => (invoice.status || "").toLowerCase() === "issued"
  ).length;

  const name =
    client.client_type === "business"
      ? client.company_name
      : client.full_name;

  const deleteAction = deleteClient.bind(null, id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={name || "Client"}
        description={formatStatusLabel(client.client_type)}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/clients">Back</Link>
            </Button>

            <Button asChild variant="outline">
              <Link href={`/clients/${id}/edit`}>Edit</Link>
            </Button>

            <form action={deleteAction}>
              <DeleteClientButton />
            </form>
          </>
        }
      />

      <Card size="sm">
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Clients represent owners or individuals connected to properties and
            contracts.
          </p>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card size="sm"><CardContent><DetailField label="Owned Properties" value={properties.length} /></CardContent></Card>
        <Card size="sm"><CardContent><DetailField label="Active Contracts" value={activeContractsCount} /></CardContent></Card>
        <Card size="sm"><CardContent><DetailField label="Recent Open Tasks" value={openTasksCount} /></CardContent></Card>
        <Card size="sm"><CardContent><DetailField label="Status" value={formatStatusLabel(client.status)} /></CardContent></Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Properties</CardTitle>
              <CardDescription>
                Estate and ownership context for this client.
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/properties/new?owner_client_id=${id}`}>New Property</Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4">
            <DetailField label="Owned Properties" value={properties.length} />
            <DetailField
              label="Active Properties"
              value={
                properties.filter(
                  (property) => (property.status || "").toLowerCase() === "active"
                ).length
              }
            />
            <DetailField
              label="Next Step"
              value={
                properties.length > 0
                  ? "Review linked properties"
                  : "Add the first property"
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Contracts</CardTitle>
              <CardDescription>
                Service agreements tied to this client&apos;s properties.
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/subscriptions">View All</Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4">
            <DetailField label="Total Contracts" value={contracts.length} />
            <DetailField label="Active Contracts" value={activeContractsCount} />
            <DetailField
              label="Next Step"
              value={
                activeContractsCount > 0
                  ? "Keep active agreements on track"
                  : "Prepare the next contract"
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Billing</CardTitle>
              <CardDescription>
                Invoice activity for this client record.
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/billing">View All</Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4">
            <DetailField label="Recent Invoices" value={invoices.length} />
            <DetailField label="Draft Invoices" value={draftInvoicesCount} />
            <DetailField label="Issued Invoices" value={issuedInvoicesCount} />
          </CardContent>
        </Card>
      </section>

      <SectionCard
        title="Contact"
        contentClassName="grid gap-4 md:grid-cols-2"
      >
        <DetailField label="Phone" value={client.phone || "-"} />
        <DetailField label="Email" value={client.email || "-"} />
        <DetailField label="Municipality" value={municipality?.name || "-"} />
        <DetailField label="Location" value={location?.name || "-"} />
      </SectionCard>

      <SectionCard
        title="Address"
        contentClassName="grid gap-4 md:grid-cols-2"
      >
        <DetailField label="Address 1" value={client.address_line_1 || "-"} />
        <DetailField label="Address 2" value={client.address_line_2 || "-"} />
        <DetailField label="Country" value={client.country || "-"} />
      </SectionCard>

      <SectionCard title="Notes">
        <div className="text-sm text-muted-foreground">{client.notes || "-"}</div>
      </SectionCard>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            Owned Properties
          </h2>
          <Button asChild size="sm">
            <Link href={`/properties/new?owner_client_id=${id}`}>New Property</Link>
          </Button>
        </div>

        <SectionCard title="Owned Properties">
          {properties.length === 0 ? (
            <Card size="sm">
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  No properties are linked to this client yet.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {properties.map((property) => (
                <div
                  key={property.id}
                  className="flex items-center justify-between gap-4 rounded-xl border p-4"
                >
                  <div>
                    <div className="font-medium text-foreground">
                      {property.title || "Untitled Property"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {property.property_code || "No code"}
                      {property.address_line_1 ? ` • ${property.address_line_1}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={getStatusVariant(property.status)}>
                      {formatStatusLabel(property.status)}
                    </Badge>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/properties/${property.id}`}>Open</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <SectionCard title="Contracts">
          {contracts.length === 0 ? (
            <Card size="sm">
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  No contracts are linked to this client&apos;s properties yet.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {contracts.map((contract) => {
                const plan = getSingle(contract.packages)?.name || "Unnamed Plan";
                const property =
                  getSingle(contract.properties)?.title ||
                  getSingle(contract.properties)?.property_code ||
                  "Property";

                return (
                  <div
                    key={contract.id}
                    className="flex items-center justify-between gap-4 rounded-xl border p-4"
                  >
                    <div>
                      <div className="font-medium text-foreground">{plan}</div>
                      <div className="text-sm text-muted-foreground">{property}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={getStatusVariant(contract.status)}>
                        {formatStatusLabel(contract.status)}
                      </Badge>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/subscriptions/${contract.id}`}>Open</Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Recent Tasks">
          {tasks.length === 0 ? (
            <Card size="sm">
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  No recent tasks are linked to this client&apos;s properties.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {tasks.map((task) => {
                const property =
                  getSingle(task.properties)?.title ||
                  getSingle(task.properties)?.property_code ||
                  "Property";

                return (
                  <div
                    key={task.id}
                    className="flex items-center justify-between gap-4 rounded-xl border p-4"
                  >
                    <div>
                      <div className="font-medium text-foreground">
                        {task.title || "Untitled Task"}
                      </div>
                      <div className="text-sm text-muted-foreground">{property}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={getStatusVariant(task.status)}>
                        {formatStatusLabel(task.status)}
                      </Badge>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/tasks/${task.id}`}>Open</Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Recent Invoices">
        {invoices.length === 0 ? (
          <Card size="sm">
            <CardContent>
              <p className="text-sm text-muted-foreground">
                No invoices are linked to this client yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between gap-4 rounded-xl border p-4"
              >
                <div>
                  <div className="font-medium text-foreground">
                    {invoice.invoice_number || "Draft invoice"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {invoice.property_label_snapshot || "Client-level billing"} •{" "}
                    {formatMoneyFromCents(invoice.total_cents)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={getStatusVariant(invoice.status)}>
                    {formatStatusLabel(invoice.status)}
                  </Badge>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/billing/${invoice.id}`}>Open</Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Meta" contentClassName="flex flex-wrap gap-2">
        <Badge variant="neutral">
          {formatStatusLabel(client.client_type)}
        </Badge>

        <Badge variant={getStatusVariant(client.status)}>
          {formatStatusLabel(client.status)}
        </Badge>
      </SectionCard>
    </div>
  );
}

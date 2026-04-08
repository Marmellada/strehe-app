import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import { DetailField } from "@/components/ui/DetailField";
import { Card, CardContent } from "@/components/ui/Card";
import { formatStatusLabel, getStatusVariant } from "@/lib/ui/status";
import { requireRole } from "@/lib/auth/require-role";
import DeleteClientButton from "./DeleteClientButton";

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

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["admin", "office"]);

  const supabase = await createClient();
  const { id } = await params;

  const { data: rawClient } = await supabase
    .from("clients")
    .select(
      `
      *,
      municipality:municipalities(name),
      location:locations(name)
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (!rawClient) return notFound();

  const client = rawClient;

  const municipality = getSingle(client.municipality);
  const location = getSingle(client.location);

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

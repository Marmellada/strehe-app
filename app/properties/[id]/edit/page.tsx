import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DetailField,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import PropertyEditForm from "./PropertyEditForm";

async function updateProperty(formData: FormData) {
  "use server";

  await requireRole(["admin", "office"]);
  const supabase = await createClient();

  const id = String(formData.get("id") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const owner_client_id = String(formData.get("owner_client_id") || "").trim();
  const municipality_id = String(formData.get("municipality_id") || "").trim();
  const location_id = String(formData.get("location_id") || "").trim();
  const address_line_1 = String(formData.get("address_line_1") || "").trim();
  const address_line_2 = String(formData.get("address_line_2") || "").trim();
  const country = String(formData.get("country") || "").trim();
  const property_type = String(formData.get("property_type") || "").trim();
  const status = String(formData.get("status") || "").trim();

  if (!id || !title || !owner_client_id || !municipality_id || !location_id) {
    throw new Error("Missing required fields.");
  }

  const { data: selectedLocation, error: locationError } = await supabase
    .from("locations")
    .select("id, name, municipality_id")
    .eq("id", location_id)
    .single();

  if (locationError || !selectedLocation) {
    throw new Error("Invalid location selected.");
  }

  if (selectedLocation.municipality_id !== municipality_id) {
    throw new Error("Selected location does not belong to the municipality.");
  }

  const { error } = await supabase
    .from("properties")
    .update({
      title,
      owner_client_id,
      municipality_id,
      location_id,
      location_text: selectedLocation.name,
      city: selectedLocation.name,
      address_line_1: address_line_1 || null,
      address_line_2: address_line_2 || null,
      country: country || "Kosovo",
      property_type: property_type || null,
      status: status || "active",
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/properties/${id}`);
}

type PropertyRecord = {
  id: string;
  property_code: string | null;
  title: string | null;
  owner_client_id: string | null;
  municipality_id: string | null;
  location_id: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  country: string | null;
  property_type: string | null;
  status: string | null;
};

type ClientOption = {
  id: string;
  full_name: string | null;
  company_name: string | null;
  client_type?: string | null;
  status?: string | null;
};

type Municipality = {
  id: string;
  name: string;
};

type LocationOption = {
  id: string;
  name: string;
  type: "neighborhood" | "village" | "other";
  municipality_id: string;
};

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["admin", "office"]);

  const supabase = await createClient();
  const { id } = await params;

  const [propertyResult, clientsResult, municipalitiesResult, locationsResult] =
    await Promise.all([
      supabase
        .from("properties")
        .select(
          `
          id,
          property_code,
          title,
          owner_client_id,
          municipality_id,
          location_id,
          address_line_1,
          address_line_2,
          country,
          property_type,
          status
        `
        )
        .eq("id", id)
        .single(),
      supabase
        .from("clients")
        .select("id, full_name, company_name, client_type, status")
        .order("created_at", { ascending: false }),
      supabase
        .from("municipalities")
        .select("id, name")
        .order("name", { ascending: true }),
      supabase
        .from("locations")
        .select("id, name, type, municipality_id")
        .order("name", { ascending: true }),
    ]);

  if (propertyResult.error || !propertyResult.data) {
    return notFound();
  }

  const loadError =
    clientsResult.error || municipalitiesResult.error || locationsResult.error;

  const property = propertyResult.data as PropertyRecord;
  const clients = (clientsResult.data || []) as ClientOption[];
  const municipalities = (municipalitiesResult.data || []) as Municipality[];
  const locations = (locationsResult.data || []) as LocationOption[];

  const activeClients = clients.filter((client) => client.status !== "inactive");
  const inactiveClients = clients.filter((client) => client.status === "inactive");

  const currentOwner =
    activeClients.find((client) => client.id === property.owner_client_id) ||
    inactiveClients.find((client) => client.id === property.owner_client_id);

  const currentOwnerName =
    currentOwner?.company_name ||
    currentOwner?.full_name ||
    "No owner assigned";

  return (
    <main className="grid gap-6">
      <PageHeader
        title="Edit Property"
        description={`Update property details for ${property.property_code || property.title || property.id}.`}
        actions={
          <Button asChild variant="ghost">
            <Link href={`/properties/${property.id}`}>Back to Property</Link>
          </Button>
        }
      />

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardContent className="pt-6">
          {loadError ? (
            <EmptyState
              title="Failed to load form data"
              description={loadError.message}
            />
          ) : (
            <PropertyEditForm
              property={property}
              clients={activeClients}
              municipalities={municipalities}
              locations={locations}
              updateProperty={updateProperty}
            />
          )}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Current Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <DetailField label="Property Code" value={property.property_code || "-"} />
              <DetailField label="Title" value={property.title || "-"} />
              <DetailField label="Current Owner" value={currentOwnerName} />
              <DetailField label="Status" value={property.status || "-"} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Editing Tips</CardTitle>
              <CardDescription>Keep related records aligned while updating the property.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm text-muted-foreground">
              <div><strong className="text-foreground">1. Change owner carefully.</strong> Reassigning the owner changes the relationship shown on both the property and client pages.</div>
              <div><strong className="text-foreground">2. Keep municipality and location aligned.</strong> The location must belong to the selected municipality.</div>
              <div><strong className="text-foreground">3. Update status when needed.</strong> Use Active, Vacant, or Inactive to reflect the current state of the property.</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button asChild>
                <Link href={`/properties/${property.id}`}>View Property</Link>
              </Button>

              {property.owner_client_id ? (
                <Button asChild variant="ghost">
                  <Link href={`/clients/${property.owner_client_id}`}>View Current Owner</Link>
                </Button>
              ) : null}

              <Button asChild variant="ghost">
                <Link href="/properties">Back to Property List</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}

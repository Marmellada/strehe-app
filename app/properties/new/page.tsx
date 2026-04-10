import Link from "next/link";
import { redirect } from "next/navigation";
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
import PropertyForm from "./PropertyForm";

async function createProperty(formData: FormData) {
  "use server";

  await requireRole(["admin", "office"]);
  const supabase = await createClient();

  const title = String(formData.get("title") || "").trim();
  const owner_client_id = String(formData.get("owner_client_id") || "").trim();
  const municipality_id = String(formData.get("municipality_id") || "").trim();
  const location_id = String(formData.get("location_id") || "").trim();
  const address_line_1 = String(formData.get("address_line_1") || "").trim();
  const address_line_2 = String(formData.get("address_line_2") || "").trim();
  const country = String(formData.get("country") || "").trim();
  const property_type = String(formData.get("property_type") || "").trim();
  const status = String(formData.get("status") || "").trim();

  if (!title || !owner_client_id || !municipality_id || !location_id) {
    throw new Error("Title, owner, municipality, and location are required.");
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

  const { error } = await supabase.from("properties").insert({
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
  });

  if (error) {
    throw new Error(error.message);
  }

  redirect("/properties");
}

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

export default async function NewPropertyPage({
  searchParams,
}: {
  searchParams: Promise<{ owner_client_id?: string }>;
}) {
  await requireRole(["admin", "office"]);

  const supabase = await createClient();
  const params = await searchParams;
  const preselectedOwnerId = params.owner_client_id || "";

  const [clientsResult, municipalitiesResult, locationsResult] =
    await Promise.all([
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

  const loadError =
    clientsResult.error || municipalitiesResult.error || locationsResult.error;

  const clients = (clientsResult.data || []) as ClientOption[];
  const municipalities = (municipalitiesResult.data || []) as Municipality[];
  const locations = (locationsResult.data || []) as LocationOption[];

  const activeClients = clients.filter((client) => client.status !== "inactive");
  const inactiveClients = clients.filter((client) => client.status === "inactive");

  return (
    <main className="grid gap-6">
      <PageHeader
        title="New Property"
        description="Create a property and assign it to a client owner."
        actions={
          <Button asChild variant="ghost">
            <Link href="/properties">Back to Properties</Link>
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
            <PropertyForm
              clients={activeClients}
              municipalities={municipalities}
              locations={locations}
              createProperty={createProperty}
              preselectedOwnerId={preselectedOwnerId}
            />
          )}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Creation Tips</CardTitle>
              <CardDescription>Small things that keep property records clean.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm text-muted-foreground">
              <div><strong className="text-foreground">1. Select the owner first.</strong> Every property should be connected to a client so ownership is clear from the start.</div>
              <div><strong className="text-foreground">2. Match municipality and location.</strong> The selected location must belong to the chosen municipality.</div>
              <div><strong className="text-foreground">3. Keep the title easy to recognize.</strong> Example: Apartment in Prishtina Center or House in Peja.</div>
              <div><strong className="text-foreground">4. Start with Active.</strong> You can change the status later if the property becomes vacant or inactive.</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Client Summary</CardTitle>
              <CardDescription>Available supporting records for this property.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <DetailField label="Available Clients" value={activeClients.length} />
              <DetailField label="Inactive Clients" value={inactiveClients.length} />
              <DetailField label="Municipalities" value={municipalities.length} />
              <DetailField label="Locations" value={locations.length} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button asChild variant="ghost">
                <Link href="/clients/new">Add New Client First</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/clients">View Clients</Link>
              </Button>
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

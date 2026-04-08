import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
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
    <main style={{ display: "grid", gap: 20 }}>
      <section
        className="row"
        style={{ justifyContent: "space-between", alignItems: "center" }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 28 }}>Edit Property</h1>
          <p style={{ margin: "6px 0 0", opacity: 0.75 }}>
            Update property details for{" "}
            {property.property_code || property.title || property.id}
          </p>
        </div>

        <Link href={`/properties/${property.id}`} className="btn btn-ghost">
          Back to Property
        </Link>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 0.8fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        <div className="card">
          {loadError ? (
            <p style={{ color: "crimson", margin: 0 }}>
              Failed to load form data: {loadError.message}
            </p>
          ) : (
            <PropertyEditForm
              property={property}
              clients={activeClients}
              municipalities={municipalities}
              locations={locations}
              updateProperty={updateProperty}
            />
          )}
        </div>

        <div className="card" style={{ display: "grid", gap: 16 }}>
          <div>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Current Summary</h3>

            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <div style={{ fontSize: 13, opacity: 0.7 }}>Property Code</div>
                <div style={{ marginTop: 4, fontWeight: 600 }}>
                  {property.property_code || "-"}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 13, opacity: 0.7 }}>Title</div>
                <div style={{ marginTop: 4, fontWeight: 600 }}>
                  {property.title || "-"}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 13, opacity: 0.7 }}>Current Owner</div>
                <div style={{ marginTop: 4, fontWeight: 600 }}>
                  {currentOwnerName}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 13, opacity: 0.7 }}>Status</div>
                <div style={{ marginTop: 4, fontWeight: 600 }}>
                  {property.status || "-"}
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Editing Tips</h3>

            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  1. Change owner carefully
                </div>
                <div style={{ fontSize: 14, opacity: 0.75 }}>
                  Reassigning the owner changes the relationship shown on both
                  the property and client pages.
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  2. Keep municipality and location aligned
                </div>
                <div style={{ fontSize: 14, opacity: 0.75 }}>
                  The location must belong to the selected municipality.
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  3. Update status when needed
                </div>
                <div style={{ fontSize: 14, opacity: 0.75 }}>
                  Use Active, Vacant, or Inactive to reflect the current state
                  of the property.
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Quick Actions</h3>

            <div style={{ display: "grid", gap: 8 }}>
              <Link href={`/properties/${property.id}`} className="btn btn-primary">
                View Property
              </Link>

              {property.owner_client_id ? (
                <Link
                  href={`/clients/${property.owner_client_id}`}
                  className="btn btn-ghost"
                >
                  View Current Owner
                </Link>
              ) : null}

              <Link href="/properties" className="btn btn-ghost">
                Back to Property List
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

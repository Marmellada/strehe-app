import Link from "next/link";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PropertyForm from "./PropertyForm";

async function createProperty(formData: FormData) {
  "use server";

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
    <main style={{ display: "grid", gap: 20 }}>
      <section
        className="row"
        style={{ justifyContent: "space-between", alignItems: "center" }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 28 }}>New Property</h1>
          <p style={{ margin: "6px 0 0", opacity: 0.75 }}>
            Create a property and assign it to a client owner
          </p>
        </div>

        <Link href="/properties" className="btn btn-ghost">
          Back to Properties
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
            <PropertyForm
              clients={activeClients}
              municipalities={municipalities}
              locations={locations}
              createProperty={createProperty}
              preselectedOwnerId={preselectedOwnerId}
            />
          )}
        </div>

        <div className="card" style={{ display: "grid", gap: 16 }}>
          <div>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Creation Tips</h3>

            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  1. Select the owner first
                </div>
                <div style={{ fontSize: 14, opacity: 0.75 }}>
                  Every property should be connected to a client so ownership is
                  clear from the start.
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  2. Choose the correct municipality and location
                </div>
                <div style={{ fontSize: 14, opacity: 0.75 }}>
                  The selected location must belong to the chosen municipality.
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  3. Keep the title easy to recognize
                </div>
                <div style={{ fontSize: 14, opacity: 0.75 }}>
                  Example: “Apartment in Prishtina Center” or “House in Peja”.
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  4. Use Active as the default status
                </div>
                <div style={{ fontSize: 14, opacity: 0.75 }}>
                  You can change the status later if the property becomes vacant
                  or inactive.
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Client Summary</h3>

            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <div style={{ fontSize: 13, opacity: 0.7 }}>Available Clients</div>
                <div style={{ marginTop: 4, fontWeight: 600 }}>
                  {activeClients.length}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 13, opacity: 0.7 }}>Inactive Clients</div>
                <div style={{ marginTop: 4, fontWeight: 600 }}>
                  {inactiveClients.length}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 13, opacity: 0.7 }}>Municipalities</div>
                <div style={{ marginTop: 4, fontWeight: 600 }}>
                  {municipalities.length}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 13, opacity: 0.7 }}>Locations</div>
                <div style={{ marginTop: 4, fontWeight: 600 }}>
                  {locations.length}
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Quick Actions</h3>

            <div style={{ display: "grid", gap: 8 }}>
              <Link href="/clients/new" className="btn btn-ghost">
                + Add New Client First
              </Link>

              <Link href="/clients" className="btn btn-ghost">
                View Clients
              </Link>

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
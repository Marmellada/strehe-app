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
    status: status || null,
  });

  if (error) {
    throw new Error(error.message);
  }

  redirect("/properties");
}

export default async function NewPropertyPage() {
  const [{ data: clients, error: clientsError }, { data: municipalities, error: municipalitiesError }, { data: locations, error: locationsError }] =
    await Promise.all([
      supabase
        .from("clients")
        .select("id, full_name, company_name")
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

  const loadError = clientsError || municipalitiesError || locationsError;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title">New Property</h1>
          <p className="page-subtitle">Create a new property record.</p>
        </div>

        <Link href="/properties" className="btn btn-ghost">
          Back
        </Link>
      </div>

      <div className="card">
        {loadError ? (
          <p className="text-red-600">
            Failed to load form data: {loadError.message}
          </p>
        ) : (
          <PropertyForm
            clients={clients || []}
            municipalities={municipalities || []}
            locations={locations || []}
            createProperty={createProperty}
          />
        )}
      </div>
    </div>
  );
}
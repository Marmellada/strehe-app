import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PropertyEditForm from "./PropertyEditForm";

async function updateProperty(formData: FormData) {
  "use server";

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
      status: status || null,
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/properties/${id}`);
}

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [
    { data: property, error: propertyError },
    { data: clients, error: clientsError },
    { data: municipalities, error: municipalitiesError },
    { data: locations, error: locationsError },
  ] = await Promise.all([
    supabase
      .from("properties")
      .select(`
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
      `)
      .eq("id", id)
      .single(),
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

  if (propertyError || !property) {
    return notFound();
  }

  const loadError = clientsError || municipalitiesError || locationsError;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Edit Property</h1>
          <p className="page-subtitle">
            Update property details for {property.property_code || property.id}
          </p>
        </div>

        <Link href={`/properties/${property.id}`} className="btn btn-ghost">
          Back
        </Link>
      </div>

      <div className="card">
        {loadError ? (
          <p className="text-red-600">
            Failed to load form data: {loadError.message}
          </p>
        ) : (
          <PropertyEditForm
            property={property}
            clients={clients || []}
            municipalities={municipalities || []}
            locations={locations || []}
            updateProperty={updateProperty}
          />
        )}
      </div>
    </div>
  );
}
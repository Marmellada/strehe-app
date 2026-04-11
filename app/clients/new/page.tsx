import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NewClientForm from "./NewClientForm";
import { requireRole } from "@/lib/auth/require-role";

async function createClientAction(formData: FormData) {
  "use server";

  await requireRole(["admin", "office"]);
  const supabase = await createClient();
  const municipalityId = String(formData.get("municipality_id") || "").trim();
  const locationId = String(formData.get("location_id") || "").trim();

  if (locationId) {
    if (!municipalityId) {
      throw new Error("Select a municipality before choosing a location.");
    }

    const { data: selectedLocation, error: locationError } = await supabase
      .from("locations")
      .select("id, municipality_id")
      .eq("id", locationId)
      .single();

    if (locationError || !selectedLocation) {
      throw new Error("Invalid location selected.");
    }

    if (selectedLocation.municipality_id !== municipalityId) {
      throw new Error("Selected location does not belong to the municipality.");
    }
  }

  const payload = {
    client_type: String(formData.get("client_type") || ""),
    full_name: String(formData.get("full_name") || "") || null,
    company_name: String(formData.get("company_name") || "") || null,
    contact_person: String(formData.get("contact_person") || "") || null,
    phone: String(formData.get("phone") || "") || null,
    email: String(formData.get("email") || "") || null,
    address_line_1: String(formData.get("address_line_1") || "") || null,
    address_line_2: String(formData.get("address_line_2") || "") || null,
    country: String(formData.get("country") || "") || null,
    municipality_id: municipalityId || null,
    location_id: locationId || null,
    notes: String(formData.get("notes") || "") || null,
    status: String(formData.get("status") || "active"),
  };

  const { error } = await supabase.from("clients").insert([payload]);

  if (error) {
    throw new Error(error.message);
  }

  // ✅ IMPORTANT: no return, just redirect
  redirect("/clients");
}

export default async function NewClientPage() {
  await requireRole(["admin", "office"]);

  const supabase = await createClient();

  const [
    { data: municipalities },
    { data: locations },
  ] = await Promise.all([
    supabase.from("municipalities").select("id, name").order("name"),
    supabase
      .from("locations")
      .select("id, name, type, municipality_id")
      .order("name"),
  ]);

  return (
    <NewClientForm
      municipalities={municipalities || []}
      locations={locations || []}
      action={createClientAction}
    />
  );
}

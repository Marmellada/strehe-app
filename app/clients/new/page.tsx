import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import NewClientForm from "./NewClientForm";

async function createClient(formData: FormData) {
  "use server";

  const client_type = String(formData.get("client_type") || "");
  const full_name = String(formData.get("full_name") || "");
  const company_name = String(formData.get("company_name") || "");
  const contact_person = String(formData.get("contact_person") || "");
  const phone = String(formData.get("phone") || "");
  const email = String(formData.get("email") || "");
  const address_line_1 = String(formData.get("address_line_1") || "");
  const address_line_2 = String(formData.get("address_line_2") || "");
  const country = String(formData.get("country") || "");
  const notes = String(formData.get("notes") || "");
  const status = String(formData.get("status") || "active");

  const municipality_id =
    String(formData.get("municipality_id") || "") || null;
  const location_id = String(formData.get("location_id") || "") || null;

  const payload = {
    client_type,
    full_name: full_name || null,
    company_name: company_name || null,
    contact_person: contact_person || null,
    phone: phone || null,
    email: email || null,
    address_line_1: address_line_1 || null,
    address_line_2: address_line_2 || null,
    country: country || null,
    municipality_id,
    location_id,
    notes: notes || null,
    status,
  };

  const { error } = await supabase.from("clients").insert([payload]);

  if (error) {
    throw new Error(error.message);
  }

  redirect("/clients");
}

export default async function NewClientPage() {
  const [
    { data: municipalities, error: municipalitiesError },
    { data: locations, error: locationsError },
  ] = await Promise.all([
    supabase.from("municipalities").select("id, name").order("name"),
    supabase
      .from("locations")
      .select("id, name, type, municipality_id")
      .order("name"),
  ]);

  if (municipalitiesError) {
    return (
      <div className="card">
        Error loading municipalities: {municipalitiesError.message}
      </div>
    );
  }

  if (locationsError) {
    return (
      <div className="card">
        Error loading locations: {locationsError.message}
      </div>
    );
  }

  return (
    <NewClientForm
      municipalities={municipalities || []}
      locations={locations || []}
      action={createClient}
    />
  );
}
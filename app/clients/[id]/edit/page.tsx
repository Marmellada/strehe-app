import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import NewClientForm from "../../new/NewClientForm";

async function updateClientAction(id: string, formData: FormData) {
  "use server";

  const supabase = await createClient();

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
    municipality_id: String(formData.get("municipality_id") || "") || null,
    location_id: String(formData.get("location_id") || "") || null,
    notes: String(formData.get("notes") || "") || null,
    status: String(formData.get("status") || "active"),
  };

  const { error } = await supabase
    .from("clients")
    .update(payload)
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/clients/${id}`);
}

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { id } = await params;

  const [
    { data: client },
    { data: municipalities },
    { data: locations },
  ] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).maybeSingle(),
    supabase.from("municipalities").select("id, name").order("name"),
    supabase
      .from("locations")
      .select("id, name, type, municipality_id")
      .order("name"),
  ]);

  if (!client) return notFound();

  const action = updateClientAction.bind(null, id);

  return (
    <NewClientForm
      municipalities={municipalities || []}
      locations={locations || []}
      action={action}
      initialData={client}
      isEdit
      clientId={id}
    />
  );
}
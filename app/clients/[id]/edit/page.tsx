import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import NewClientForm from "../../new/NewClientForm";

async function updateClient(id: string, formData: FormData) {
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

  const { error } = await supabase
    .from("clients")
    .update(payload)
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/clients/${id}`);
}

type Municipality = {
  id: string;
  name: string;
};

type Location = {
  id: string;
  name: string;
  type: string | null;
  municipality_id: string | null;
};

type ClientRecord = {
  id: string;
  client_type: string | null;
  full_name: string | null;
  company_name: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  country: string | null;
  municipality_id: string | null;
  location_id: string | null;
  notes: string | null;
  status: string | null;
};

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [clientResult, municipalitiesResult, locationsResult] =
    await Promise.all([
      supabase.from("clients").select("*").eq("id", id).maybeSingle(),
      supabase.from("municipalities").select("id, name").order("name"),
      supabase
        .from("locations")
        .select("id, name, type, municipality_id")
        .order("name"),
    ]);

  if (clientResult.error) {
    return (
      <div className="card">
        Error loading client: {clientResult.error.message}
      </div>
    );
  }

  if (municipalitiesResult.error) {
    return (
      <div className="card">
        Error loading municipalities: {municipalitiesResult.error.message}
      </div>
    );
  }

  if (locationsResult.error) {
    return (
      <div className="card">
        Error loading locations: {locationsResult.error.message}
      </div>
    );
  }

  const client = clientResult.data as ClientRecord | null;
  const municipalities = (municipalitiesResult.data || []) as Municipality[];
  const locations = (locationsResult.data || []) as Location[];

  if (!client) {
    return <div className="card">Client not found</div>;
  }

  const updateClientWithId = updateClient.bind(null, id);

  return (
    <NewClientForm
      municipalities={municipalities}
      locations={locations}
      action={updateClientWithId}
      initialData={client}
      isEdit
      clientId={id}
    />
  );
}
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { redirect } from "next/navigation";
import ClientLocationFields from "../../ClientLocationFields";
import ClientTypeFields from "../../ClientTypeFields";

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

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [
    { data: client, error: clientError },
    { data: municipalities, error: municipalitiesError },
    { data: locations, error: locationsError },
  ] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).maybeSingle(),
    supabase.from("municipalities").select("id, name").order("name"),
    supabase
      .from("locations")
      .select("id, name, type, municipality_id")
      .order("name"),
  ]);

  if (clientError) {
    return <div className="card">Error loading client: {clientError.message}</div>;
  }

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

  if (!client) {
    return <div className="card">Client not found</div>;
  }

  const updateClientWithId = updateClient.bind(null, id);

  return (
    <main>
      <div className="row" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Edit Client</h2>

        <Link href={`/clients/${id}`} className="btn btn-ghost">
          Cancel
        </Link>
      </div>

      <form
        action={updateClientWithId}
        className="card"
        style={{ display: "grid", gap: 12, maxWidth: 740 }}
      >
        <div className="grid-2">
          <ClientTypeFields
            defaultClientType={client.client_type}
            defaultFullName={client.full_name || ""}
            defaultCompanyName={client.company_name || ""}
            defaultContactPerson={client.contact_person || ""}
          />
        </div>

        <label className="field">
          Status
          <select
            name="status"
            className="input"
            defaultValue={client.status}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>

        <div className="grid-2">
          <label className="field">
            Phone
            <input
              name="phone"
              className="input"
              defaultValue={client.phone || ""}
            />
          </label>

          <label className="field">
            Email
            <input
              name="email"
              type="email"
              className="input"
              defaultValue={client.email || ""}
            />
          </label>
        </div>

        <label className="field">
          Address Line 1
          <input
            name="address_line_1"
            className="input"
            defaultValue={client.address_line_1 || ""}
          />
        </label>

        <label className="field">
          Address Line 2
          <input
            name="address_line_2"
            className="input"
            defaultValue={client.address_line_2 || ""}
            placeholder="Apartment, floor, unit, landmark..."
          />
        </label>

        <ClientLocationFields
          municipalities={municipalities || []}
          locations={locations || []}
          defaultMunicipalityId={client.municipality_id || ""}
          defaultLocationId={client.location_id || ""}
        />

        <label className="field">
          Country
          <input
            name="country"
            className="input"
            defaultValue={client.country || "Kosovo"}
          />
        </label>

        <label className="field">
          Notes
          <textarea
            name="notes"
            className="input"
            rows={4}
            defaultValue={client.notes || ""}
            placeholder="Internal notes..."
          />
        </label>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Link href={`/clients/${id}`} className="btn btn-ghost">
            Cancel
          </Link>

          <button type="submit" className="btn btn-primary">
            Update Client
          </button>
        </div>
      </form>
    </main>
  );
}
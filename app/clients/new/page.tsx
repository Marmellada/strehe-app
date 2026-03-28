import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { redirect } from "next/navigation";
import ClientLocationFields from "../ClientLocationFields";

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
    <main>
      <div className="row" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Add Client</h2>

        <Link href="/clients" className="btn btn-ghost">
          Cancel
        </Link>
      </div>

      <form
        action={createClient}
        className="card"
        style={{ display: "grid", gap: 12, maxWidth: 740 }}
      >
        <div className="grid-2">
          <label className="field">
            Client Type
            <select name="client_type" className="input" defaultValue="individual" required>
              <option value="individual">Individual</option>
              <option value="business">Business</option>
            </select>
          </label>

          <label className="field">
            Status
            <select name="status" className="input" defaultValue="active">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>

        <label className="field">
          Full Name
          <input
            name="full_name"
            className="input"
            placeholder="For individuals"
          />
        </label>

        <label className="field">
          Company Name
          <input
            name="company_name"
            className="input"
            placeholder="For businesses"
          />
        </label>

        <label className="field">
          Contact Person
          <input
            name="contact_person"
            className="input"
            placeholder="For businesses"
          />
        </label>

        <div className="grid-2">
          <label className="field">
            Phone
            <input name="phone" className="input" />
          </label>

          <label className="field">
            Email
            <input name="email" type="email" className="input" />
          </label>
        </div>

        <label className="field">
          Address Line 1
          <input name="address_line_1" className="input" />
        </label>

        <label className="field">
          Address Line 2
          <input
            name="address_line_2"
            className="input"
            placeholder="Apartment, floor, unit, landmark..."
          />
        </label>

        <ClientLocationFields
          municipalities={municipalities || []}
          locations={locations || []}
        />

        <label className="field">
          Country
          <input name="country" className="input" defaultValue="Kosovo" />
        </label>

        <label className="field">
          Notes
          <textarea
            name="notes"
            className="input"
            rows={4}
            placeholder="Internal notes..."
          />
        </label>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Link href="/clients" className="btn btn-ghost">
            Cancel
          </Link>

          <button type="submit" className="btn btn-primary">
            Save Client
          </button>
        </div>
      </form>
    </main>
  );
}
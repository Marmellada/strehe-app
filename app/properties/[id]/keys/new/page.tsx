import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";

async function createKey(propertyId: string, formData: FormData) {
  "use server";

  const name = String(formData.get("name") || "").trim();
  const key_type = String(formData.get("key_type") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const storage_location = String(formData.get("storage_location") || "").trim();

  const payload = {
    property_id: propertyId,
    name,
    key_type: key_type || null,
    description: description || null,
    storage_location: storage_location || null,
    status: "available",
    holder_name: null,
    last_checked_out_at: null,
  };

  const { data, error } = await supabase
    .from("keys")
    .insert([payload])
    .select("id, key_code")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await supabase.from("key_logs").insert([
    {
      key_id: data.id,
      action: "created",
      user_name: "system",
      notes: `Key registered in storage with code ${data.key_code}`,
      from_status: null,
      to_status: "available",
    },
  ]);

  redirect(`/properties/${propertyId}/keys`);
}

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function NewPropertyKeyPage({ params }: PageProps) {
  const { id } = await params;

  const { data: property, error } = await supabase
    .from("properties")
    .select("id, title, property_code, address_line_1")
    .eq("id", id)
    .maybeSingle();

  if (error || !property) {
    return notFound();
  }

  const createKeyWithPropertyId = createKey.bind(null, id);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="page-title">Add Key</h1>
        <p className="page-subtitle mt-2">
          {property.title || "Untitled Property"} • {property.property_code || "-"}
        </p>
      </div>

      <div className="top-actions">
        <Link href={`/properties/${id}/keys`} className="btn btn-ghost">
          ← Back to Keys
        </Link>
      </div>

      <form
        action={createKeyWithPropertyId}
        className="card"
        style={{ display: "grid", gap: 16, maxWidth: 860 }}
      >
        <div
          className="card"
          style={{
            padding: 14,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <div className="section-title" style={{ marginBottom: 8 }}>
            Key code will be generated automatically
          </div>
          <p className="page-subtitle" style={{ margin: 0 }}>
            The backend will assign the next available key tag when you save.
          </p>
        </div>

        <div className="grid-2">
          <label className="field">
            Key Type
            <input
              name="key_type"
              className="input"
              placeholder="e.g. Main door / Bundle"
            />
          </label>

          <label className="field">
            Storage Location
            <input
              name="storage_location"
              className="input"
              placeholder="e.g. Office Safe / Box A / Slot 03"
            />
          </label>
        </div>

        <label className="field">
          Key Name
          <input
            name="name"
            className="input"
            placeholder="e.g. Main Door Key Set"
            required
          />
        </label>

        <label className="field">
          Description
          <textarea
            name="description"
            className="input"
            rows={4}
            placeholder="Notes about this key or bundle..."
          />
        </label>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Link href={`/properties/${id}/keys`} className="btn btn-ghost">
            Cancel
          </Link>

          <button type="submit" className="btn btn-primary">
            Save Key
          </button>
        </div>
      </form>
    </main>
  );
}
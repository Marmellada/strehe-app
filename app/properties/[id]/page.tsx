import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import DeletePropertyButton from "./DeletePropertyButton";

async function deleteProperty(formData: FormData) {
  "use server";

  const id = String(formData.get("id") || "").trim();

  if (!id) {
    throw new Error("Missing property id.");
  }

  const { error } = await supabase.from("properties").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  redirect("/properties");
}

type PropertyPageProps = {
  params: Promise<{ id: string }>;
};

export default async function PropertyDetailPage({
  params,
}: PropertyPageProps) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("properties")
    .select(
      `
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
        status,
        municipalities (
          id,
          name
        ),
        locations (
          id,
          name,
          type
        ),
        clients (
          id,
          full_name,
          company_name
        )
      `
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return notFound();
  }

  const property: any = data;

  const owner =
    property.clients?.company_name ||
    property.clients?.full_name ||
    "No owner assigned";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title">
            {property.title || "Untitled Property"}
          </h1>
          <p className="page-subtitle">{property.property_code || "-"}</p>
        </div>

        <div className="flex gap-2">
          <Link href={`/properties/${property.id}/edit`} className="btn">
            Edit Property
          </Link>

          <form action={deleteProperty}>
            <input type="hidden" name="id" value={property.id} />
            <DeletePropertyButton />
          </form>
        </div>
      </div>

      <div className="card">
        <div className="grid grid-2 gap-4">
          <div>
            <p className="field-label">Property Code</p>
            <p>{property.property_code || "-"}</p>
          </div>

          <div>
            <p className="field-label">Title</p>
            <p>{property.title || "-"}</p>
          </div>

          <div>
            <p className="field-label">Owner</p>
            <p>{owner}</p>
          </div>

          <div>
            <p className="field-label">Property Type</p>
            <p>{property.property_type || "-"}</p>
          </div>

          <div>
            <p className="field-label">Status</p>
            <p>{property.status || "-"}</p>
          </div>

          <div>
            <p className="field-label">Country</p>
            <p>{property.country || "-"}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title mb-4">Location</h2>

        <div className="grid grid-2 gap-4">
          <div>
            <p className="field-label">Municipality</p>
            <p>{property.municipalities?.name || "-"}</p>
          </div>

          <div>
            <p className="field-label">Neighborhood / Village</p>
            <p>{property.locations?.name || "-"}</p>
          </div>

          <div>
            <p className="field-label">Location Type</p>
            <p>{property.locations?.type || "-"}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title mb-4">Address</h2>

        <div className="grid grid-2 gap-4">
          <div>
            <p className="field-label">Address Line 1</p>
            <p>{property.address_line_1 || "-"}</p>
          </div>

          <div>
            <p className="field-label">Address Line 2</p>
            <p>{property.address_line_2 || "-"}</p>
          </div>
        </div>
      </div>

      <div>
        <Link href="/properties" className="text-sm underline">
          ← Back to properties
        </Link>
      </div>
    </div>
  );
}
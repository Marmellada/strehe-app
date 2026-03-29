import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import DeletePropertyButton from "./DeletePropertyButton";

async function deleteProperty(id: string) {
  "use server";

  const { error } = await supabase.from("properties").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  redirect("/properties");
}

type RelatedMunicipality =
  | { id: string; name: string }
  | { id: string; name: string }[]
  | null;

type RelatedLocation =
  | { id: string; name: string; type: string | null }
  | { id: string; name: string; type: string | null }[]
  | null;

type RelatedClient =
  | { id: string; full_name: string | null; company_name: string | null }
  | { id: string; full_name: string | null; company_name: string | null }[]
  | null;

type PropertyRecord = {
  id: string;
  property_code: string | null;
  title: string | null;
  owner_client_id: string | null;
  municipality_id: string | null;
  location_id: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  country: string | null;
  property_type: string | null;
  status: string | null;
  municipalities: RelatedMunicipality;
  locations: RelatedLocation;
  clients: RelatedClient;
};

function getSingleRelation<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] || null;
  return value;
}

type PropertyPageProps = {
  params: Promise<{ id: string }>;
};

export default async function PropertyDetailPage({
  params,
}: PropertyPageProps) {
  const { id } = await params;

  const [{ data, error }, { count: keysCount }] = await Promise.all([
    supabase
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
          municipalities ( id, name ),
          locations ( id, name, type ),
          clients ( id, full_name, company_name )
        `
      )
      .eq("id", id)
      .single(),
    supabase
      .from("keys")
      .select("*", { count: "exact", head: true })
      .eq("property_id", id),
  ]);

  if (error || !data) {
    return notFound();
  }

  const property = data as PropertyRecord;
  const municipality = getSingleRelation(property.municipalities);
  const location = getSingleRelation(property.locations);
  const ownerClient = getSingleRelation(property.clients);

  const owner =
    ownerClient?.company_name ||
    ownerClient?.full_name ||
    "No owner assigned";

  const deletePropertyWithId = deleteProperty.bind(null, id);

  return (
    <main className="space-y-6">
      <div className="status-row">
        <span className="badge badge-outline">
          {property.property_type || "Property"}
        </span>
        <span
          className={`badge ${
            property.status === "active"
              ? "badge-success"
              : property.status === "vacant"
              ? "badge-warning"
              : "badge-outline"
          }`}
        >
          {property.status || "Unknown"}
        </span>
      </div>

      <div>
        <h1 className="page-title">{property.title || "Untitled Property"}</h1>
        <p className="page-subtitle mt-2">
          {property.property_code || "No property code"}
        </p>
      </div>

      <div className="top-actions">
        <Link href="/properties" className="btn btn-ghost">
          ← Back to Properties
        </Link>

        <Link href={`/properties/${id}/edit`} className="btn btn-primary">
          Edit Property
        </Link>

        <Link href={`/properties/${id}/keys`} className="btn btn-ghost">
          Manage Keys {typeof keysCount === "number" ? `(${keysCount})` : ""}
        </Link>

        <form action={deletePropertyWithId}>
          <DeletePropertyButton />
        </form>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="card">
          <span className="field-label">Owner</span>
          <span className="field-value">{owner}</span>
        </div>

        <div className="card">
          <span className="field-label">Municipality</span>
          <span className="field-value">{municipality?.name || "-"}</span>
        </div>

        <div className="card">
          <span className="field-label">Neighborhood / Village</span>
          <span className="field-value">{location?.name || "-"}</span>
        </div>

        <div className="card">
          <span className="field-label">Location Type</span>
          <span className="field-value">{location?.type || "-"}</span>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="card">
          <h2 className="section-title">Property Information</h2>

          <div className="info-stack">
            <div className="info-row">
              <span className="field-label">Property Code</span>
              <span className="field-value">{property.property_code || "-"}</span>
            </div>

            <div className="info-row">
              <span className="field-label">Title</span>
              <span className="field-value">{property.title || "-"}</span>
            </div>

            <div className="info-row">
              <span className="field-label">Property Type</span>
              <span className="field-value">{property.property_type || "-"}</span>
            </div>

            <div className="info-row">
              <span className="field-label">Status</span>
              <span className="field-value">{property.status || "-"}</span>
            </div>

            <div className="info-row pt-2">
              <span className="section-title !mb-0 !text-base">Address</span>
            </div>

            <div className="info-row">
              <span className="field-label">Address Line 1</span>
              <span className="field-value">{property.address_line_1 || "-"}</span>
            </div>

            <div className="info-row">
              <span className="field-label">Address Line 2</span>
              <span className="field-value">{property.address_line_2 || "-"}</span>
            </div>

            <div className="info-row">
              <span className="field-label">Country</span>
              <span className="field-value">{property.country || "-"}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="section-title">Owner Summary</h2>

          <div className="summary-stack">
            <div className="summary-item">
              <span className="field-label">Assigned Owner</span>
              <span className="field-value">{owner}</span>
            </div>

            <div className="summary-item">
              <span className="field-label">Municipality</span>
              <span className="field-value">{municipality?.name || "-"}</span>
            </div>

            <div className="summary-item">
              <span className="field-label">Location</span>
              <span className="field-value">{location?.name || "-"}</span>
            </div>

            <div className="summary-item">
              <span className="field-label">Tracked Keys</span>
              <span className="field-value">{keysCount || 0}</span>
            </div>

            {ownerClient?.id ? (
              <div className="summary-item pt-2">
                <Link href={`/clients/${ownerClient.id}`} className="btn btn-ghost">
                  View Owner
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
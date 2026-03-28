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

type RelatedMunicipality =
  | {
      id: string;
      name: string;
    }
  | {
      id: string;
      name: string;
    }[]
  | null;

type RelatedLocation =
  | {
      id: string;
      name: string;
      type: string | null;
    }
  | {
      id: string;
      name: string;
      type: string | null;
    }[]
  | null;

type RelatedClient =
  | {
      id: string;
      full_name: string | null;
      company_name: string | null;
    }
  | {
      id: string;
      full_name: string | null;
      company_name: string | null;
    }[]
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

  const property = data as PropertyRecord;

  const municipality = getSingleRelation(property.municipalities);
  const location = getSingleRelation(property.locations);
  const ownerClient = getSingleRelation(property.clients);

  const owner =
    ownerClient?.company_name ||
    ownerClient?.full_name ||
    "No owner assigned";

  return (
    <main style={{ display: "grid", gap: 20 }}>
      <section
        className="row"
        style={{ justifyContent: "space-between", alignItems: "flex-start" }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                fontSize: 12,
                border: "1px solid var(--border)",
                background: "var(--panel)",
              }}
            >
              {property.property_type || "Property"}
            </span>

            <span
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                fontSize: 12,
                border: "1px solid var(--border)",
                background:
                  property.status === "active"
                    ? "rgba(34,197,94,0.12)"
                    : property.status === "vacant"
                      ? "rgba(245,158,11,0.12)"
                      : "rgba(239,68,68,0.12)",
              }}
            >
              {property.status || "Unknown"}
            </span>
          </div>

          <h1 style={{ margin: 0, fontSize: 28 }}>
            {property.title || "Untitled Property"}
          </h1>

          <div style={{ opacity: 0.72 }}>
            {property.property_code || "No property code"}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/properties" className="btn btn-ghost">
            ← Back to Properties
          </Link>

          <Link
            href={`/properties/${property.id}/edit`}
            className="btn btn-primary"
          >
            Edit Property
          </Link>

          <form action={deleteProperty}>
            <input type="hidden" name="id" value={property.id} />
            <DeletePropertyButton />
          </form>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <div className="card">
          <div style={{ fontSize: 13, opacity: 0.7 }}>Owner</div>
          <div style={{ marginTop: 6, fontWeight: 600 }}>{owner}</div>
        </div>

        <div className="card">
          <div style={{ fontSize: 13, opacity: 0.7 }}>Municipality</div>
          <div style={{ marginTop: 6, fontWeight: 600 }}>
            {municipality?.name || "-"}
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: 13, opacity: 0.7 }}>
            Neighborhood / Village
          </div>
          <div style={{ marginTop: 6, fontWeight: 600 }}>
            {location?.name || "-"}
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: 13, opacity: 0.7 }}>Location Type</div>
          <div style={{ marginTop: 6, fontWeight: 600 }}>
            {location?.type || "-"}
          </div>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 0.8fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        <div className="card" style={{ display: "grid", gap: 18 }}>
          <div>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>
              Property Information
            </h3>

            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <div style={{ fontSize: 13, opacity: 0.7 }}>Property Code</div>
                <div style={{ marginTop: 4 }}>{property.property_code || "-"}</div>
              </div>

              <div>
                <div style={{ fontSize: 13, opacity: 0.7 }}>Title</div>
                <div style={{ marginTop: 4 }}>{property.title || "-"}</div>
              </div>

              <div>
                <div style={{ fontSize: 13, opacity: 0.7 }}>Property Type</div>
                <div style={{ marginTop: 4 }}>{property.property_type || "-"}</div>
              </div>

              <div>
                <div style={{ fontSize: 13, opacity: 0.7 }}>Status</div>
                <div style={{ marginTop: 4 }}>{property.status || "-"}</div>
              </div>
            </div>
          </div>

          <div>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Address</h3>

            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <div style={{ fontSize: 13, opacity: 0.7 }}>Address Line 1</div>
                <div style={{ marginTop: 4 }}>
                  {property.address_line_1 || "-"}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 13, opacity: 0.7 }}>Address Line 2</div>
                <div style={{ marginTop: 4 }}>
                  {property.address_line_2 || "-"}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 13, opacity: 0.7 }}>Country</div>
                <div style={{ marginTop: 4 }}>{property.country || "-"}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ display: "grid", gap: 18 }}>
          <div>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Owner Summary</h3>

            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <div style={{ fontSize: 13, opacity: 0.7 }}>Assigned Owner</div>
                <div style={{ marginTop: 4 }}>{owner}</div>
              </div>

              <div>
                <div style={{ fontSize: 13, opacity: 0.7 }}>Municipality</div>
                <div style={{ marginTop: 4 }}>{municipality?.name || "-"}</div>
              </div>

              <div>
                <div style={{ fontSize: 13, opacity: 0.7 }}>Location</div>
                <div style={{ marginTop: 4 }}>{location?.name || "-"}</div>
              </div>
            </div>
          </div>

          <div>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Actions</h3>

            <div style={{ display: "grid", gap: 8 }}>
              <Link
                href={`/properties/${property.id}/edit`}
                className="btn btn-primary"
              >
                Edit Property
              </Link>

              <Link href="/properties/new" className="btn btn-ghost">
                Add New Property
              </Link>

              <Link href="/properties" className="btn btn-ghost">
                Back to List
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
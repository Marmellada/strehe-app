import Link from "next/link";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import DeleteClientButton from "./DeleteClientButton";

async function deleteClient(id: string) {
  "use server";

  const { error } = await supabase.from("clients").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  redirect("/clients");
}

type ClientDetail = {
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
  notes: string | null;
  status: string | null;
  municipality:
    | { id: string; name: string }
    | { id: string; name: string }[]
    | null;
  location:
    | { id: string; name: string; type: string | null }
    | { id: string; name: string; type: string | null }[]
    | null;
};

function getSingleRelation<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] || null;
  return value;
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: rawClient, error } = await supabase
    .from("clients")
    .select(
      `
        *,
        municipality:municipalities (
          id,
          name
        ),
        location:locations (
          id,
          name,
          type
        )
      `
    )
    .eq("id", id)
    .maybeSingle();

  const { data: properties } = await supabase
    .from("properties")
    .select("id, property_code, title, status")
    .eq("owner_client_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main className="p-6">
        <p className="text-red-400">Error: {error.message}</p>
      </main>
    );
  }

  if (!rawClient) {
    return (
      <main className="p-6">
        <p className="text-gray-300">Client not found.</p>
      </main>
    );
  }

  const client = rawClient as ClientDetail;
  const municipality = getSingleRelation(client.municipality);
  const location = getSingleRelation(client.location);

  const deleteClientWithId = deleteClient.bind(null, id);

  const isBusiness = client.client_type === "business";
  const isActive = client.status === "active";

  const displayName = isBusiness
    ? client.company_name || "Unnamed Business"
    : client.full_name || "Unnamed Client";

  const subtitle = isBusiness
    ? client.contact_person
      ? `Business client • Contact: ${client.contact_person}`
      : "Business client"
    : "Individual client";

  return (
    <main className="space-y-6">
      <div className="status-row">
        <span className="badge badge-outline">
          {isBusiness ? "Business" : "Individual"}
        </span>
        <span className={`badge ${isActive ? "badge-success" : "badge-warning"}`}>
          {isActive ? "Active" : "Inactive"}
        </span>
      </div>

      <div>
        <h1 className="page-title">{displayName}</h1>
        <p className="page-subtitle mt-2">{subtitle}</p>
      </div>

      <div className="top-actions">
        <Link href="/clients" className="btn btn-ghost">
          ← Back to Clients
        </Link>

        <Link href={`/clients/${id}/edit`} className="btn btn-primary">
          Edit Client
        </Link>

        <form action={deleteClientWithId}>
          <DeleteClientButton />
        </form>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="card">
          <span className="field-label">Phone</span>
          {client.phone ? (
            <a href={`tel:${client.phone}`} className="field-value">
              {client.phone}
            </a>
          ) : (
            <span className="field-value-muted">-</span>
          )}
        </div>

        <div className="card">
          <span className="field-label">Email</span>
          {client.email ? (
            <a href={`mailto:${client.email}`} className="field-value">
              {client.email}
            </a>
          ) : (
            <span className="field-value-muted">-</span>
          )}
        </div>

        <div className="card">
          <span className="field-label">Municipality</span>
          <span className="field-value">{municipality?.name || "-"}</span>
        </div>

        <div className="card">
          <span className="field-label">Location</span>
          <span className="field-value">{location?.name || "-"}</span>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="card">
          <h2 className="section-title">Address</h2>

          <div className="info-stack">
            <div className="info-row">
              <span className="field-label">Address Line 1</span>
              <span className="field-value">{client.address_line_1 || "-"}</span>
            </div>

            <div className="info-row">
              <span className="field-label">Address Line 2</span>
              <span className="field-value">{client.address_line_2 || "-"}</span>
            </div>

            <div className="info-row">
              <span className="field-label">Country</span>
              <span className="field-value">{client.country || "-"}</span>
            </div>

            {client.notes ? (
              <div className="info-row">
                <span className="field-label">Notes</span>
                <p className="field-value-muted whitespace-pre-wrap">
                  {client.notes}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="card">
          <h2 className="section-title">Client Summary</h2>

          <div className="summary-stack">
            <div className="summary-item">
              <span className="field-label">Client Type</span>
              <span className="field-value">
                {isBusiness ? "Business" : "Individual"}
              </span>
            </div>

            <div className="summary-item">
              <span className="field-label">Status</span>
              <span className="field-value">
                {isActive ? "Active" : "Inactive"}
              </span>
            </div>

            {isBusiness ? (
              <>
                <div className="summary-item">
                  <span className="field-label">Company Name</span>
                  <span className="field-value">{client.company_name || "-"}</span>
                </div>

                <div className="summary-item">
                  <span className="field-label">Contact Person</span>
                  <span className="field-value">
                    {client.contact_person || "-"}
                  </span>
                </div>
              </>
            ) : (
              <div className="summary-item">
                <span className="field-label">Full Name</span>
                <span className="field-value">{client.full_name || "-"}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="section-title !mb-0">Owned Properties</h2>
            <p className="page-subtitle mt-1">
              Properties currently assigned to this client.
            </p>
          </div>

          <Link href="/properties/new" className="btn btn-primary">
            + Add Property
          </Link>
        </div>

        {!properties || properties.length === 0 ? (
          <p className="field-value-muted">
            No properties assigned to this client yet.
          </p>
        ) : (
          <div className="related-list">
            {properties.map((property) => (
              <div key={property.id} className="related-item">
                <div>
                  <div className="related-item-title">
                    {property.title || "Untitled Property"}
                  </div>
                  <div className="related-item-subtitle">
                    {property.property_code || "-"}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`badge ${
                      property.status === "active"
                        ? "badge-success"
                        : property.status === "vacant"
                        ? "badge-warning"
                        : "badge-outline"
                    }`}
                  >
                    {property.status || "unknown"}
                  </span>

                  <Link
                    href={`/properties/${property.id}`}
                    className="btn btn-ghost"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
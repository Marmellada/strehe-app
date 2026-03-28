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
    | {
        id: string;
        name: string;
      }
    | {
        id: string;
        name: string;
      }[]
    | null;
  location:
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
      municipality:municipalities ( id, name ),
      location:locations ( id, name, type )
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return <div className="card">Error: {error.message}</div>;
  }

  if (!rawClient) {
    return <div className="card">Client not found</div>;
  }

  const client = rawClient as ClientDetail;
  const municipality = getSingleRelation(client.municipality);
  const location = getSingleRelation(client.location);

  const deleteClientWithId = deleteClient.bind(null, id);

  const displayName =
    client.client_type === "business"
      ? client.company_name || "Unnamed Business"
      : client.full_name || "Unnamed Client";

  const subtitle =
    client.client_type === "business"
      ? client.contact_person
        ? `Business client • Contact: ${client.contact_person}`
        : "Business client"
      : "Individual client";

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
              {client.client_type === "business" ? "Business" : "Individual"}
            </span>

            <span
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                fontSize: 12,
                border: "1px solid var(--border)",
                background:
                  client.status === "active"
                    ? "rgba(34,197,94,0.12)"
                    : "rgba(239,68,68,0.12)",
              }}
            >
              {client.status === "active" ? "Active" : "Inactive"}
            </span>
          </div>

          <h1 style={{ margin: 0, fontSize: 28 }}>{displayName}</h1>

          <div style={{ opacity: 0.72 }}>{subtitle}</div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/clients" className="btn btn-ghost">
            ← Back to Clients
          </Link>

          <Link href={`/clients/${id}/edit`} className="btn btn-primary">
            Edit
          </Link>

          <DeleteClientButton action={deleteClientWithId} />
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
          <div style={{ fontSize: 13, opacity: 0.7 }}>Phone</div>
          <div style={{ marginTop: 6, fontWeight: 600 }}>
            {client.phone ? (
              <a href={`tel:${client.phone}`} style={{ textDecoration: "none" }}>
                {client.phone}
              </a>
            ) : (
              "-"
            )}
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: 13, opacity: 0.7 }}>Email</div>
          <div style={{ marginTop: 6, fontWeight: 600, wordBreak: "break-word" }}>
            {client.email ? (
              <a
                href={`mailto:${client.email}`}
                style={{ textDecoration: "none" }}
              >
                {client.email}
              </a>
            ) : (
              "-"
            )}
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: 13, opacity: 0.7 }}>Municipality</div>
          <div style={{ marginTop: 6, fontWeight: 600 }}>
            {municipality?.name || "-"}
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: 13, opacity: 0.7 }}>Location</div>
          <div style={{ marginTop: 6, fontWeight: 600 }}>
            {location?.name || "-"}
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
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Address</h3>

            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <div style={{ fontSize: 13, opacity: 0.7 }}>Address Line 1</div>
                <div style={{ marginTop: 4 }}>{client.address_line_1 || "-"}</div>
              </div>

              <div>
                <div style={{ fontSize: 13, opacity: 0.7 }}>Address Line 2</div>
                <div style={{ marginTop: 4 }}>{client.address_line_2 || "-"}</div>
              </div>

              <div>
                <div style={{ fontSize: 13, opacity: 0.7 }}>Country</div>
                <div style={{ marginTop: 4 }}>{client.country || "-"}</div>
              </div>
            </div>
          </div>

          {client.notes ? (
            <div>
              <h3 style={{ marginTop: 0, marginBottom: 12 }}>Notes</h3>
              <div style={{ whiteSpace: "pre-wrap" }}>{client.notes}</div>
            </div>
          ) : null}
        </div>

        <div className="card" style={{ display: "grid", gap: 18 }}>
          <div>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Client Summary</h3>

            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <div style={{ fontSize: 13, opacity: 0.7 }}>Client Type</div>
                <div style={{ marginTop: 4 }}>
                  {client.client_type === "business" ? "Business" : "Individual"}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 13, opacity: 0.7 }}>Status</div>
                <div style={{ marginTop: 4 }}>
                  {client.status === "active" ? "Active" : "Inactive"}
                </div>
              </div>

              {client.client_type === "business" ? (
                <>
                  <div>
                    <div style={{ fontSize: 13, opacity: 0.7 }}>Company Name</div>
                    <div style={{ marginTop: 4 }}>
                      {client.company_name || "-"}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 13, opacity: 0.7 }}>
                      Contact Person
                    </div>
                    <div style={{ marginTop: 4 }}>
                      {client.contact_person || "-"}
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <div style={{ fontSize: 13, opacity: 0.7 }}>Full Name</div>
                  <div style={{ marginTop: 4 }}>{client.full_name || "-"}</div>
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Actions</h3>

            <div style={{ display: "grid", gap: 8 }}>
              <Link href={`/clients/${id}/edit`} className="btn btn-primary">
                Edit Client
              </Link>

              <Link href="/clients/new" className="btn btn-ghost">
                Add New Client
              </Link>

              <Link href="/clients" className="btn btn-ghost">
                Back to List
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
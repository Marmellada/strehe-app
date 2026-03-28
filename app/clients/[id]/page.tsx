import Link from "next/link";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import DeleteClientButton from "./DeleteClientButton";

async function deleteClient(id: string) {
  "use server";

  const { error } = await supabase
    .from("clients")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  redirect("/clients");
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: client, error } = await supabase
    .from("clients")
    .select(`
      *,
      municipality:municipalities ( id, name ),
      location:locations ( id, name, type )
    `)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return <div className="card">Error: {error.message}</div>;
  }

  if (!client) {
    return <div className="card">Client not found</div>;
  }

  const deleteClientWithId = deleteClient.bind(null, id);

  const displayName =
    client.client_type === "business"
      ? client.company_name || "Unnamed Business"
      : client.full_name || "Unnamed Client";

  return (
    <main>
      <div className="row" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>{displayName}</h2>
          <div style={{ opacity: 0.6 }}>{client.client_type}</div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/clients" className="btn btn-ghost">
            ← Back to Clients
          </Link>

          <Link href={`/clients/${id}/edit`} className="btn">
            Edit
          </Link>

          <DeleteClientButton action={deleteClientWithId} />
        </div>
      </div>

      <div className="card" style={{ display: "grid", gap: 16 }}>
        <div>
          <h4>Contact</h4>
          <div className="grid-2">
            <div>
              <strong>Phone:</strong>
              <div>{client.phone || "-"}</div>
            </div>

            <div>
              <strong>Email:</strong>
              <div>{client.email || "-"}</div>
            </div>
          </div>
        </div>

        <div>
          <h4>Address</h4>

          <div>{client.address_line_1 || "-"}</div>
          <div>{client.address_line_2 || ""}</div>

          <div style={{ marginTop: 8 }}>
            <strong>Location:</strong>
            <div>
              {client.municipality?.name || "-"}
              {client.location?.name ? ` / ${client.location.name}` : ""}
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <strong>Country:</strong>
            <div>{client.country || "-"}</div>
          </div>
        </div>

        {client.client_type === "business" && (
          <div>
            <h4>Business Info</h4>

            <div>
              <strong>Company:</strong>
              <div>{client.company_name || "-"}</div>
            </div>

            <div>
              <strong>Contact Person:</strong>
              <div>{client.contact_person || "-"}</div>
            </div>
          </div>
        )}

        {client.notes && (
          <div>
            <h4>Notes</h4>
            <div>{client.notes}</div>
          </div>
        )}
      </div>
    </main>
  );
}
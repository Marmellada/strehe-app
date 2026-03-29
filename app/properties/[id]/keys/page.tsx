import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PropertyKeysPage({ params }: PageProps) {
  const { id } = await params;

  const [
    { data: property, error: propertyError },
    { data: keys, error: keysError },
  ] = await Promise.all([
    supabase
      .from("properties")
      .select("id, title, property_code, address_line_1")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("keys")
      .select(
        "id, key_code, name, key_type, status, storage_location, holder_name"
      )
      .eq("property_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (propertyError || !property) {
    return notFound();
  }

  if (keysError) {
    return <div className="card">Error loading keys: {keysError.message}</div>;
  }

  return (
    <main className="space-y-6">
      <div>
        <div className="status-row">
          <span className="badge badge-outline">Keys</span>
          <span className="badge badge-success">
            {keys?.length || 0} tracked
          </span>
        </div>

        <h1 className="page-title mt-3">
          Keys for {property.title || "Untitled Property"}
        </h1>

        <p className="page-subtitle mt-2">
          {property.property_code || "-"} •{" "}
          {property.address_line_1 || "No address"}
        </p>
      </div>

      <div className="top-actions">
        <Link href={`/properties/${id}`} className="btn btn-ghost">
          ← Back to Property
        </Link>

        <Link href={`/properties/${id}/keys/new`} className="btn btn-primary">
          + Add Key
        </Link>
      </div>

      <section className="card">
        {!keys || keys.length === 0 ? (
          <div className="space-y-3">
            <h2 className="section-title !mb-0">No keys registered yet</h2>
            <p className="page-subtitle">
              Add the first tagged key or key bundle for this property.
            </p>
            <div>
              <Link
                href={`/properties/${id}/keys/new`}
                className="btn btn-primary"
              >
                Add First Key
              </Link>
            </div>
          </div>
        ) : (
          <div className="related-list">
            {keys.map((key) => (
              <div key={key.id} className="related-item">
                <div>
                  <div className="related-item-title">
                    {key.name || "Unnamed Key"}
                  </div>
                  <div className="related-item-subtitle">
                    Tag: <strong>{key.key_code || "No code"}</strong>
                  </div>
                  <div className="related-item-subtitle">
                    {key.key_type || "No type"}
                  </div>
                  <div className="related-item-subtitle">
                    Storage: {key.storage_location || "-"}
                  </div>
                  {key.holder_name ? (
                    <div className="related-item-subtitle">
                      Holder: {key.holder_name}
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`badge ${
                      key.status === "available"
                        ? "badge-success"
                        : key.status === "assigned"
                        ? "badge-warning"
                        : key.status === "lost"
                        ? "badge-danger"
                        : "badge-outline"
                    }`}
                  >
                    {key.status || "unknown"}
                  </span>

                  <Link href={`/keys/${key.id}`} className="btn btn-ghost">
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
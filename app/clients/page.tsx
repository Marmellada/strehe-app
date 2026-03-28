import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{
    municipality_id?: string;
    status?: string;
    client_type?: string;
    search?: string;
  }>;
}) {
  const params = await searchParams;

  const municipality_id = params.municipality_id || "";
  const status = params.status || "";
  const client_type = params.client_type || "";
  const search = params.search || "";

  const [
    { data: municipalities },
    { data: clients, error },
  ] = await Promise.all([
    supabase.from("municipalities").select("id, name").order("name"),
    (async () => {
      let query = supabase
        .from("clients")
        .select(`
          id,
          client_type,
          full_name,
          company_name,
          contact_person,
          email,
          phone,
          status,
          municipalities (name),
          locations (name)
        `);

      if (municipality_id) {
        query = query.eq("municipality_id", municipality_id);
      }

      if (status) {
        query = query.eq("status", status);
      }

      if (client_type) {
        query = query.eq("client_type", client_type);
      }

      if (search) {
        query = query.or(
          `full_name.ilike.%${search}%,company_name.ilike.%${search}%,contact_person.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
        );
      }

      return query.order("created_at", { ascending: false });
    })(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">
            Manage all registered clients.
          </p>
        </div>

        <Link href="/clients/new" className="btn">
          + New Client
        </Link>
      </div>

      <form className="card grid grid-3 gap-4">
        <input
          name="search"
          placeholder="Search name, company, email, phone..."
          defaultValue={search}
          className="input"
        />

        <select
          name="municipality_id"
          defaultValue={municipality_id}
          className="input"
        >
          <option value="">All municipalities</option>
          {municipalities?.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>

        <select name="status" defaultValue={status} className="input">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <select
          name="client_type"
          defaultValue={client_type}
          className="input"
        >
          <option value="">All client types</option>
          <option value="individual">Individual</option>
          <option value="business">Business</option>
        </select>

        <div className="flex gap-2">
          <button type="submit" className="btn">
            Apply
          </button>

          <Link href="/clients" className="btn btn-ghost">
            Reset
          </Link>
        </div>
      </form>

      <div className="card">
        {error ? (
          <p>Error loading clients.</p>
        ) : !clients || clients.length === 0 ? (
          <p>No clients found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Municipality</th>
                <th>Location</th>
                <th>Contact</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {clients.map((c: any) => (
                <tr key={c.id}>
                  <td>
                    {c.client_type === "business"
                      ? c.company_name || "-"
                      : c.full_name || "-"}
                  </td>
                  <td>{c.client_type}</td>
                  <td>{c.municipalities?.name || "-"}</td>
                  <td>{c.locations?.name || "-"}</td>
                  <td>{c.email || c.phone || "-"}</td>
                  <td>{c.status}</td>
                  <td>
                    <Link href={`/clients/${c.id}`}>View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{
    municipality_id?: string;
    status?: string;
    search?: string;
  }>;
}) {
  const params = await searchParams;

  const municipality_id = params.municipality_id || "";
  const status = params.status || "";
  const search = params.search || "";

  const [
    { data: municipalities },
    { data: properties, error },
  ] = await Promise.all([
    supabase.from("municipalities").select("id, name").order("name"),
    (async () => {
      let query = supabase
        .from("properties")
        .select(
          `
          id,
          property_code,
          title,
          address_line_1,
          property_type,
          status,
          municipalities (name),
          locations (name)
        `
        );

      if (municipality_id) {
        query = query.eq("municipality_id", municipality_id);
      }

      if (status) {
        query = query.eq("status", status);
      }

      if (search) {
        query = query.or(
          `title.ilike.%${search}%,property_code.ilike.%${search}%`
        );
      }

      return query.order("property_code", { ascending: true });
    })(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Properties</h1>
          <p className="page-subtitle">
            Manage all registered properties.
          </p>
        </div>

        <Link href="/properties/new" className="btn">
          + New Property
        </Link>
      </div>

      <form className="card grid grid-3 gap-4">
        <input
          name="search"
          placeholder="Search title or code..."
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
          <option value="vacant">Vacant</option>
          <option value="inactive">Inactive</option>
        </select>

        <div className="flex gap-2">
          <button type="submit" className="btn">
            Apply
          </button>

          <Link href="/properties" className="btn btn-ghost">
            Reset
          </Link>
        </div>
      </form>

      <div className="card">
        {!properties || properties.length === 0 ? (
          <p>No properties found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th>Code</th>
                <th>Title</th>
                <th>Municipality</th>
                <th>Location</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {properties.map((p: any) => (
                <tr key={p.id}>
                  <td>{p.property_code}</td>
                  <td>{p.title}</td>
                  <td>{p.municipalities?.name}</td>
                  <td>{p.locations?.name}</td>
                  <td>{p.status}</td>
                  <td>
                    <Link href={`/properties/${p.id}`}>View</Link>
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
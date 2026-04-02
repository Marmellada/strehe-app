import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

function formatLabel(value: string | null | undefined) {
  if (!value) return "-";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (l: string) => l.toUpperCase());
}

function formatPrice(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";

  const num = typeof value === "number" ? value : Number(value);

  if (Number.isNaN(num)) return "-";

  return `€${num.toFixed(2)}`;
}

export default async function ServicesPage() {
  const supabase = await createClient();
  
  const { data: services, error } = await supabase
    .from("services")
    .select(`
      id,
      name,
      category,
      base_price,
      default_priority,
      is_active
    `)
    .order("created_at", { ascending: false });

  if (error) {
    return <div>Error loading services</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Services</h1>
          <p className="page-subtitle">Manage your service catalog</p>
        </div>

        <Link href="/services/create" className="btn btn-primary">
          + New Service
        </Link>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Base Price</th>
                <th>Default Priority</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {services?.map((service: any) => (
                <tr key={service.id}>
                  <td>
                    <Link href={`/services/${service.id}`}>
                      {service.name || "-"}
                    </Link>
                  </td>

                  <td>{formatLabel(service.category)}</td>

                  <td>{formatPrice(service.base_price)}</td>

                  <td>{formatLabel(service.default_priority)}</td>

                  <td>{service.is_active ? "Active" : "Inactive"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {services?.length === 0 && (
            <div className="empty-state">No services found.</div>
          )}
        </div>
      </div>
    </div>
  );
}

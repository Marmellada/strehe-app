import Link from "next/link";
import { supabase } from "@/lib/supabase";

function formatPrice(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";

  const num = typeof value === "number" ? value : Number(value);

  if (Number.isNaN(num)) return "-";

  return `€${num.toFixed(2)}`;
}

export default async function PackagesPage() {
  const { data: packages, error } = await supabase
    .from("packages")
    .select(`
      id,
      name,
      monthly_price,
      is_active
    `)
    .order("created_at", { ascending: false });

  if (error) {
    return <div>Error loading packages</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Packages</h1>
          <p className="page-subtitle">Manage your package catalog</p>
        </div>

        <Link href="/packages/create" className="btn btn-primary">
          + New Package
        </Link>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Monthly Price</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {packages?.map((pkg: any) => (
                <tr key={pkg.id}>
                  <td>
                    <Link href={`/packages/${pkg.id}`}>
                      {pkg.name || "-"}
                    </Link>
                  </td>

                  <td>{formatPrice(pkg.monthly_price)}</td>

                  <td>{pkg.is_active ? "Active" : "Inactive"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {packages?.length === 0 && (
            <div className="empty-state">No packages found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
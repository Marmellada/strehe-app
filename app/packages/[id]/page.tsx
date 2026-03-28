import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";

async function deletePackage(formData: FormData) {
  "use server";

  const id = String(formData.get("id") || "").trim();

  if (!id) {
    throw new Error("Missing package id.");
  }

  const { error } = await supabase.from("packages").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  redirect("/packages");
}

async function addPackageService(formData: FormData) {
  "use server";

  const package_id = String(formData.get("package_id") || "").trim();
  const service_id = String(formData.get("service_id") || "").trim();
  const included_quantity_raw = String(formData.get("included_quantity") || "1").trim();

  if (!package_id || !service_id) {
    throw new Error("Package and service are required.");
  }

  const included_quantity = Number(included_quantity_raw);

  if (Number.isNaN(included_quantity) || included_quantity <= 0) {
    throw new Error("Included quantity must be greater than 0.");
  }

  const { data: existingRow, error: existingError } = await supabase
    .from("package_services")
    .select("id, included_quantity")
    .eq("package_id", package_id)
    .eq("service_id", service_id)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existingRow) {
    const { error: updateError } = await supabase
      .from("package_services")
      .update({
        included_quantity:
          Number(existingRow.included_quantity || 0) + included_quantity,
      })
      .eq("id", existingRow.id);

    if (updateError) {
      throw new Error(updateError.message);
    }
  } else {
    const { error: insertError } = await supabase
      .from("package_services")
      .insert({
        package_id,
        service_id,
        included_quantity,
      });

    if (insertError) {
      throw new Error(insertError.message);
    }
  }

  redirect(`/packages/${package_id}`);
}

async function removePackageService(formData: FormData) {
  "use server";

  const id = String(formData.get("id") || "").trim();
  const package_id = String(formData.get("package_id") || "").trim();

  if (!id || !package_id) {
    throw new Error("Missing package service id.");
  }

  const { error } = await supabase
    .from("package_services")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/packages/${package_id}`);
}

function formatPrice(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";

  const num = typeof value === "number" ? value : Number(value);

  if (Number.isNaN(num)) return "-";

  return `€${num.toFixed(2)}`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";

  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatLabel(value: string | null | undefined) {
  if (!value) return "-";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (l: string) => l.toUpperCase());
}

type PackagePageProps = {
  params: Promise<{ id: string }>;
};

export default async function PackageDetailPage({
  params,
}: PackagePageProps) {
  const { id } = await params;

  const [
    { data: pkg, error },
    { data: includedServices },
    { data: availableServices },
  ] = await Promise.all([
    supabase
      .from("packages")
      .select(`
        id,
        name,
        description,
        monthly_price,
        is_active,
        created_at,
        updated_at
      `)
      .eq("id", id)
      .single(),

    supabase
      .from("package_services")
      .select(`
        id,
        package_id,
        service_id,
        included_quantity,
        service:services!package_services_service_fk (
          id,
          name,
          category,
          base_price,
          is_active
        )
      `)
      .eq("package_id", id)
      .order("created_at", { ascending: true }),

    supabase
      .from("services")
      .select(`
        id,
        name,
        category,
        base_price,
        is_active
      `)
      .eq("is_active", true)
      .order("name", { ascending: true }),
  ]);

  if (error || !pkg) {
    return notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title">{pkg.name || "Untitled Package"}</h1>
          <p className="page-subtitle">
            {pkg.is_active ? "Active Package" : "Inactive Package"}
          </p>
        </div>

        <div className="flex gap-2">
          <Link href={`/packages/${pkg.id}/edit`} className="btn">
            Edit Package
          </Link>

          <form action={deletePackage}>
            <input type="hidden" name="id" value={pkg.id} />
            <button type="submit" className="btn btn-danger">
              Delete Package
            </button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="grid grid-2 gap-4">
          <div>
            <p className="field-label">Name</p>
            <p>{pkg.name || "-"}</p>
          </div>

          <div>
            <p className="field-label">Monthly Price</p>
            <p>{formatPrice(pkg.monthly_price)}</p>
          </div>

          <div>
            <p className="field-label">Status</p>
            <p>{pkg.is_active ? "Active" : "Inactive"}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title mb-4">Description</h2>
        <p>{pkg.description || "No description provided."}</p>
      </div>

      <div className="card">
        <h2 className="section-title mb-4">Add Service</h2>

        <form action={addPackageService} className="space-y-4">
          <input type="hidden" name="package_id" value={pkg.id} />

          <div className="grid grid-2 gap-4">
            <div>
              <label htmlFor="service_id" className="field-label">
                Service
              </label>
              <select
                id="service_id"
                name="service_id"
                defaultValue=""
                required
                className="input"
              >
                <option value="" disabled>
                  Select service
                </option>
                {availableServices?.map((service: any) => (
                  <option key={service.id} value={service.id}>
                    {service.name} ({formatLabel(service.category)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="included_quantity" className="field-label">
                Included Quantity
              </label>
              <input
                id="included_quantity"
                name="included_quantity"
                type="number"
                min="1"
                step="1"
                defaultValue="1"
                required
                className="input"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary">
              Add Service
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2 className="section-title mb-4">Included Services</h2>

        {includedServices && includedServices.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Category</th>
                  <th>Included Quantity</th>
                  <th>Base Price</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {includedServices.map((row: any) => (
                  <tr key={row.id}>
                    <td>{row.service?.name || "-"}</td>
                    <td>{formatLabel(row.service?.category)}</td>
                    <td>{row.included_quantity ?? "-"}</td>
                    <td>{formatPrice(row.service?.base_price)}</td>
                    <td>
                      <form action={removePackageService}>
                        <input type="hidden" name="id" value={row.id} />
                        <input
                          type="hidden"
                          name="package_id"
                          value={pkg.id}
                        />
                        <button type="submit" className="btn btn-danger">
                          Remove
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No services linked to this package yet.</p>
        )}
      </div>

      <div className="card">
        <h2 className="section-title mb-4">System Info</h2>

        <div className="grid grid-2 gap-4">
          <div>
            <p className="field-label">Created At</p>
            <p>{formatDateTime(pkg.created_at)}</p>
          </div>

          <div>
            <p className="field-label">Updated At</p>
            <p>{formatDateTime(pkg.updated_at)}</p>
          </div>
        </div>
      </div>

      <div>
        <Link href="/packages" className="text-sm underline">
          ← Back to packages
        </Link>
      </div>
    </div>
  );
}
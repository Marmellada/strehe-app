import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type PackagePageProps = {
  params: Promise<{ id: string }>;
};

type ServiceRelation =
  | {
      id: string;
      name: string | null;
      category: string | null;
      base_price: number | string | null;
      is_active: boolean | null;
    }
  | {
      id: string;
      name: string | null;
      category: string | null;
      base_price: number | string | null;
      is_active: boolean | null;
    }[]
  | null;

type IncludedServiceRow = {
  id: string;
  package_id: string;
  service_id: string;
  included_quantity: number | null;
  service: ServiceRelation;
};

type ContractRow = {
  id: string;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  monthly_price: number | string | null;
  property:
    | {
        id: string;
        title: string | null;
        property_code: string | null;
      }
    | {
        id: string;
        title: string | null;
        property_code: string | null;
      }[]
    | null;
  client:
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
};

function getSingleRelation<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] || null;
  return value;
}

function formatLabel(value: string | null | undefined) {
  if (!value) return "—";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (l: string) => l.toUpperCase());
}

function formatPrice(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";

  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return "—";

  return `€${num.toFixed(2)}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

async function deletePackage(formData: FormData) {
  "use server";

  const supabase = await createClient();

  const id = String(formData.get("id") || "").trim();

  if (!id) {
    throw new Error("Missing package id.");
  }

  const { count, error: countError } = await supabase
    .from("subscriptions")
    .select("*", { count: "exact", head: true })
    .eq("package_id", id)
    .in("status", ["active", "paused"]);

  if (countError) {
    throw new Error(countError.message);
  }

  if ((count || 0) > 0) {
    throw new Error(
      "This package has active or paused contracts and cannot be deleted."
    );
  }

  const { error: linkDeleteError } = await supabase
    .from("package_services")
    .delete()
    .eq("package_id", id);

  if (linkDeleteError) {
    throw new Error(linkDeleteError.message);
  }

  const { error } = await supabase.from("packages").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  redirect("/packages");
}

async function addPackageService(formData: FormData) {
  "use server";

  const supabase = await createClient();

  const package_id = String(formData.get("package_id") || "").trim();
  const service_id = String(formData.get("service_id") || "").trim();
  const included_quantity_raw = String(
    formData.get("included_quantity") || "1"
  ).trim();

  if (!package_id || !service_id) {
    throw new Error("Package and service are required.");
  }

  const included_quantity = Number(included_quantity_raw);

  if (
    Number.isNaN(included_quantity) ||
    !Number.isInteger(included_quantity) ||
    included_quantity <= 0
  ) {
    throw new Error("Included quantity must be a whole number greater than 0.");
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
    const { error: insertError } = await supabase.from("package_services").insert({
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

  const supabase = await createClient();

  const id = String(formData.get("id") || "").trim();
  const package_id = String(formData.get("package_id") || "").trim();

  if (!id || !package_id) {
    throw new Error("Missing package service id.");
  }

  const { error } = await supabase.from("package_services").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/packages/${package_id}`);
}

export default async function PackageDetailPage({
  params,
}: PackagePageProps) {
  const supabase = await createClient();
  const { id } = await params;

  const [
    { data: pkg, error },
    { data: includedServices },
    { data: availableServices },
    { data: subscriptions },
  ] = await Promise.all([
    supabase
      .from("packages")
      .select(
        `
        id,
        name,
        description,
        monthly_price,
        is_active,
        created_at,
        updated_at
      `
      )
      .eq("id", id)
      .single(),

    supabase
      .from("package_services")
      .select(
        `
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
      `
      )
      .eq("package_id", id)
      .order("created_at", { ascending: true }),

    supabase
      .from("services")
      .select(
        `
        id,
        name,
        category,
        base_price,
        is_active
      `
      )
      .eq("is_active", true)
      .order("name", { ascending: true }),

    supabase
      .from("subscriptions")
      .select(
        `
        id,
        status,
        start_date,
        end_date,
        monthly_price,
        property:properties!subscriptions_property_fk (
          id,
          title,
          property_code
        ),
        client:clients!subscriptions_client_fk (
          id,
          full_name,
          company_name
        )
      `
      )
      .eq("package_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (error || !pkg) {
    return notFound();
  }

  const serviceRows = (includedServices || []) as IncludedServiceRow[];
  const serviceOptions = (availableServices || []) as any[];
  const contractRows = (subscriptions || []) as ContractRow[];

  const activeContracts = contractRows.filter((row) => {
    const status = (row.status || "").toLowerCase();
    return status === "active" || status === "paused";
  });

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title">{pkg.name || "Untitled Package"}</h1>
          <p className="page-subtitle mt-2">
            {pkg.is_active ? "Active package" : "Inactive package"}
          </p>
        </div>

        <div className="flex gap-2">
          <Link href="/packages" className="btn">
            Back
          </Link>
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="card">
          <span className="field-label">Monthly Price</span>
          <span className="field-value">{formatPrice(pkg.monthly_price)}</span>
        </div>

        <div className="card">
          <span className="field-label">Status</span>
          <span className="field-value">{pkg.is_active ? "Active" : "Inactive"}</span>
        </div>

        <div className="card">
          <span className="field-label">Included Services</span>
          <span className="field-value">{serviceRows.length}</span>
        </div>

        <div className="card">
          <span className="field-label">Active Contracts</span>
          <span className="field-value">{activeContracts.length}</span>
        </div>
      </section>

      <section className="card">
        <div className="grid grid-2 gap-4">
          <div>
            <p className="field-label">Name</p>
            <p>{pkg.name || "—"}</p>
          </div>

          <div>
            <p className="field-label">Monthly Price</p>
            <p>{formatPrice(pkg.monthly_price)}</p>
          </div>

          <div>
            <p className="field-label">Created</p>
            <p>{formatDate(pkg.created_at)}</p>
          </div>

          <div>
            <p className="field-label">Updated</p>
            <p>{formatDate(pkg.updated_at)}</p>
          </div>

          <div className="col-span-2">
            <p className="field-label">Description</p>
            <p>{pkg.description || "No description provided."}</p>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="mb-4">
          <h2 className="section-title !mb-0">Included Services</h2>
          <p className="page-subtitle mt-1">
            These are the service quantities included in this contractual package.
          </p>
        </div>

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
                {serviceOptions.map((service) => (
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

        <div className="mt-6">
          {serviceRows.length === 0 ? (
            <p className="field-value-muted">No services added to this package yet.</p>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Category</th>
                    <th>Base Price</th>
                    <th>Included Qty</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {serviceRows.map((row) => {
                    const service = getSingleRelation(row.service);

                    return (
                      <tr key={row.id}>
                        <td>
                          <Link href={`/services/${service?.id}`}>
                            {service?.name || "Unnamed service"}
                          </Link>
                        </td>
                        <td>{formatLabel(service?.category)}</td>
                        <td>{formatPrice(service?.base_price)}</td>
                        <td>{row.included_quantity ?? "—"}</td>
                        <td>{service?.is_active ? "Active" : "Inactive"}</td>
                        <td>
                          <form action={removePackageService}>
                            <input type="hidden" name="id" value={row.id} />
                            <input
                              type="hidden"
                              name="package_id"
                              value={pkg.id}
                            />
                            <button type="submit" className="btn btn-ghost">
                              Remove
                            </button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <div className="mb-4">
          <h2 className="section-title !mb-0">Contracts Using This Package</h2>
          <p className="page-subtitle mt-1">
            Shows which properties are currently or historically linked to this package.
          </p>
        </div>

        {contractRows.length === 0 ? (
          <p className="field-value-muted">No contracts found for this package.</p>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Property</th>
                  <th>Status</th>
                  <th>Monthly Price</th>
                  <th>Period</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {contractRows.map((row) => {
                  const client = getSingleRelation(row.client);
                  const property = getSingleRelation(row.property);

                  const clientName =
                    client?.company_name || client?.full_name || "—";

                  const propertyName = property?.property_code
                    ? `${property.property_code} - ${property.title || ""}`
                    : property?.title || "—";

                  return (
                    <tr key={row.id}>
                      <td>{clientName}</td>
                      <td>{propertyName}</td>
                      <td>{formatLabel(row.status)}</td>
                      <td>{formatPrice(row.monthly_price)}</td>
                      <td>
                        {formatDate(row.start_date)} — {formatDate(row.end_date)}
                      </td>
                      <td>
                        <Link href={`/subscriptions/${row.id}`} className="btn btn-ghost">
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
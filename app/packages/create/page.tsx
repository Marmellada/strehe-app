import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function createPackage(formData: FormData) {
  "use server";

  const supabase = await createClient();

  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const monthly_price_raw = String(formData.get("monthly_price") || "").trim();
  const is_active = String(formData.get("is_active") || "true") === "true";

  if (!name) {
    throw new Error("Package name is required.");
  }

  const monthly_price =
    monthly_price_raw === "" ? null : Number(monthly_price_raw);

  if (monthly_price_raw !== "" && Number.isNaN(monthly_price)) {
    throw new Error("Monthly price must be a valid number.");
  }

  const { data, error } = await supabase
    .from("packages")
    .insert({
      name,
      description: description || null,
      monthly_price,
      is_active,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/packages/${data.id}`);
}

export default async function CreatePackagePage() {
  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title">New Package</h1>
          <p className="page-subtitle mt-2">
            Create a contractual package that can later be assigned to a property
            through a contract.
          </p>
        </div>

        <Link href="/packages" className="btn">
          Back to Packages
        </Link>
      </div>

      <section className="card">
        <div className="mb-4">
          <h2 className="section-title !mb-0">Package Basics</h2>
          <p className="page-subtitle mt-1">
            Define the package first. You will add included services after the
            package is created.
          </p>
        </div>

        <form action={createPackage} className="space-y-6">
          <div className="grid grid-2 gap-4">
            <div>
              <label htmlFor="name" className="field-label">
                Package Name *
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="input"
                placeholder="e.g. Basic, Standard, Premium"
              />
            </div>

            <div>
              <label htmlFor="monthly_price" className="field-label">
                Monthly Price
              </label>
              <input
                id="monthly_price"
                name="monthly_price"
                type="number"
                step="0.01"
                min="0"
                className="input"
                placeholder="e.g. 29.00"
              />
            </div>

            <div>
              <label htmlFor="is_active" className="field-label">
                Status
              </label>
              <select
                id="is_active"
                name="is_active"
                defaultValue="true"
                className="input"
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>

            <div className="col-span-2">
              <label htmlFor="description" className="field-label">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={6}
                className="input"
                placeholder="Describe what this package offers commercially."
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Link href="/packages" className="btn">
              Cancel
            </Link>
            <button type="submit" className="btn btn-primary">
              Create Package
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <div className="mb-4">
          <h2 className="section-title !mb-0">What happens next</h2>
        </div>

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          <div className="card">
            <div className="field-label">1. Create package</div>
            <div className="field-value">Commercial bundle</div>
          </div>

          <div className="card">
            <div className="field-label">2. Add services</div>
            <div className="field-value">Included service quantities</div>
          </div>

          <div className="card">
            <div className="field-label">3. Use in contracts</div>
            <div className="field-value">Assign package to property</div>
          </div>
        </div>
      </section>
    </main>
  );
}
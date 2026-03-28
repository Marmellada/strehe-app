import Link from "next/link";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";

async function createPackage(formData: FormData) {
  "use server";

  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const monthly_price_raw = String(formData.get("monthly_price") || "").trim();
  const is_active = String(formData.get("is_active") || "true") === "true";

  if (!name) {
    throw new Error("Name is required.");
  }

  const monthly_price =
    monthly_price_raw === "" ? null : Number(monthly_price_raw);

  if (monthly_price_raw !== "" && Number.isNaN(monthly_price)) {
    throw new Error("Monthly price must be a valid number.");
  }

  const { error } = await supabase.from("packages").insert({
    name,
    description: description || null,
    monthly_price,
    is_active,
  });

  if (error) {
    throw new Error(error.message);
  }

  redirect("/packages");
}

export default async function CreatePackagePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title">New Package</h1>
          <p className="page-subtitle">Create a new service package</p>
        </div>

        <Link href="/packages" className="btn">
          Back
        </Link>
      </div>

      <form action={createPackage} className="card space-y-6">
        <div className="grid grid-2 gap-4">
          <div>
            <label htmlFor="name" className="field-label">
              Name *
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="input"
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
    </div>
  );
}
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";

async function updatePackage(formData: FormData) {
  "use server";

  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const monthly_price_raw = String(formData.get("monthly_price") || "").trim();
  const is_active = String(formData.get("is_active") || "true") === "true";

  if (!id) {
    throw new Error("Missing package id.");
  }

  if (!name) {
    throw new Error("Name is required.");
  }

  const monthly_price =
    monthly_price_raw === "" ? null : Number(monthly_price_raw);

  if (monthly_price_raw !== "" && Number.isNaN(monthly_price)) {
    throw new Error("Monthly price must be a valid number.");
  }

  const { error } = await supabase
    .from("packages")
    .update({
      name,
      description: description || null,
      monthly_price,
      is_active,
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/packages/${id}`);
}

type EditPackagePageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditPackagePage({
  params,
}: EditPackagePageProps) {
  const { id } = await params;

  const { data: pkg, error } = await supabase
    .from("packages")
    .select(`
      id,
      name,
      description,
      monthly_price,
      is_active
    `)
    .eq("id", id)
    .single();

  if (error || !pkg) {
    return notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Edit Package</h1>
          <p className="page-subtitle">{pkg.name || "-"}</p>
        </div>

        <div className="flex gap-2">
          <Link href={`/packages/${pkg.id}`} className="btn">
            Back to Package
          </Link>
        </div>
      </div>

      <form action={updatePackage} className="card space-y-6">
        <input type="hidden" name="id" value={pkg.id} />

        <div className="grid grid-2 gap-4">
          <div>
            <label htmlFor="name" className="field-label">
              Name *
            </label>
            <input
              id="name"
              name="name"
              type="text"
              defaultValue={pkg.name || ""}
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
              defaultValue={pkg.monthly_price ?? ""}
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
              defaultValue={String(pkg.is_active)}
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
              defaultValue={pkg.description || ""}
              className="input"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Link href={`/packages/${pkg.id}`} className="btn">
            Cancel
          </Link>
          <button type="submit" className="btn btn-primary">
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
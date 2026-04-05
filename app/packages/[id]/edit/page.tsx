import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";

type EditPackagePageProps = {
  params: Promise<{ id: string }>;
};

async function updatePackage(formData: FormData) {
  "use server";

  const supabase = await createClient();

  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const monthly_price_raw = String(formData.get("monthly_price") || "").trim();
  const is_active = String(formData.get("is_active") || "true") === "true";

  if (!id) {
    throw new Error("Missing package id.");
  }

  if (!name) {
    throw new Error("Package name is required.");
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
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/packages/${id}`);
}

export default async function EditPackagePage({
  params,
}: EditPackagePageProps) {
  const supabase = await createClient();
  const { id } = await params;

  const { data: pkg, error } = await supabase
    .from("packages")
    .select(
      `
      id,
      name,
      description,
      monthly_price,
      is_active
    `
    )
    .eq("id", id)
    .single();

  if (error || !pkg) {
    return notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Package"
        description={pkg.name || "—"}
        backHref={`/packages/${pkg.id}`}
        actions={
          <Button asChild variant="outline">
            <Link href={`/packages/${pkg.id}`}>Back to Package</Link>
          </Button>
        }
      />

      <SectionCard
        title="Package Details"
        description="Update the commercial definition of this contractual package."
      >
        <form action={updatePackage} className="space-y-6">
          <input type="hidden" name="id" value={pkg.id} />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Package Name *
              </label>
              <input
                id="name"
                name="name"
                type="text"
                defaultValue={pkg.name || ""}
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="monthly_price" className="text-sm font-medium">
                Monthly Price
              </label>
              <input
                id="monthly_price"
                name="monthly_price"
                type="number"
                step="0.01"
                min="0"
                defaultValue={pkg.monthly_price ?? ""}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="is_active" className="text-sm font-medium">
                Status
              </label>
              <select
                id="is_active"
                name="is_active"
                defaultValue={pkg.is_active ? "true" : "false"}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label htmlFor="description" className="text-sm font-medium">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={6}
                defaultValue={pkg.description || ""}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`/packages/${pkg.id}`}>Cancel</Link>
            </Button>
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}
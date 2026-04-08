import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatCard } from "@/components/ui/StatCard";

async function createPackage(formData: FormData) {
  "use server";

  await requireRole(["admin", "office"]);
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
  await requireRole(["admin", "office"]);

  return (
    <div className="space-y-6">
      
      <div className="space-y-4">
  <Button asChild variant="ghost">
    <Link href="/packages">← Back</Link>
  </Button>

  <PageHeader
    title="New Package"
    description="Create a contractual package that can later be assigned to a property through a contract."
  />
</div>

      <SectionCard
        title="Package Basics"
        description="Define the package first. You will add included services after the package is created."
      >
        <form action={createPackage} className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Package Name *
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="e.g. Basic, Standard, Premium"
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
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="e.g. 29.00"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="is_active" className="text-sm font-medium">
                Status
              </label>
              <select
                id="is_active"
                name="is_active"
                defaultValue="true"
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
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Describe what this package offers commercially."
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/packages">Cancel</Link>
            </Button>
            <Button type="submit">Create Package</Button>
          </div>
        </form>
      </SectionCard>

      <SectionCard title="What happens next">
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard title="1. Create package" value="Commercial bundle" />
          <StatCard title="2. Add services" value="Included service quantities" />
          <StatCard title="3. Use in contracts" value="Assign package to property" />
        </div>
      </SectionCard>
    </div>
  );
}

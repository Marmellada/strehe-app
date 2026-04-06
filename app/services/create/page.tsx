import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { Card, CardContent } from "@/components/ui/Card";

async function createService(formData: FormData) {
  "use server";

  const supabase = await createClient();

  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const base_price_raw = String(formData.get("base_price") || "").trim();
  const default_priority = String(
    formData.get("default_priority") || "medium"
  ).trim();
  const default_title = String(formData.get("default_title") || "").trim();
  const default_description = String(
    formData.get("default_description") || ""
  ).trim();
  const is_active = String(formData.get("is_active") || "true") === "true";

  if (!name || !category) {
    throw new Error("Name and category are required.");
  }

  const base_price = base_price_raw === "" ? null : Number(base_price_raw);

  if (base_price_raw !== "" && Number.isNaN(base_price)) {
    throw new Error("Base price must be a valid number.");
  }

  const { error } = await supabase.from("services").insert({
    name,
    description: description || null,
    category,
    base_price,
    default_priority,
    default_title: default_title || null,
    default_description: default_description || null,
    is_active,
  });

  if (error) {
    throw new Error(error.message);
  }

  redirect("/services");
}

export default async function CreateServicePage() {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
  <Button asChild variant="ghost">
    <Link href="/services">← Back</Link>
  </Button>

  <PageHeader
    title="New Service"
    description="Create a reusable service catalog item"
  />
</div>

      <SectionCard
        title="Service Setup"
        description="Define pricing, category, and default task values for this service."
      >
        <form action={createService} className="space-y-6">
          <Card size="sm">
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Services are reusable catalog items. They can be included in
                packages and later reused in billing.
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Name *
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="category" className="text-sm font-medium">
                Category *
              </label>
              <select
                id="category"
                name="category"
                required
                defaultValue=""
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  Select category
                </option>
                <option value="inspection">Inspection</option>
                <option value="maintenance">Maintenance</option>
                <option value="cleaning">Cleaning</option>
                <option value="repair">Repair</option>
                <option value="handover">Handover</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="base_price" className="text-sm font-medium">
                Base Price
              </label>
              <input
                id="base_price"
                name="base_price"
                type="number"
                step="0.01"
                min="0"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="default_priority" className="text-sm font-medium">
                Default Priority
              </label>
              <select
                id="default_priority"
                name="default_priority"
                defaultValue="medium"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label htmlFor="default_title" className="text-sm font-medium">
                Default Task Title
              </label>
              <input
                id="default_title"
                name="default_title"
                type="text"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label
                htmlFor="default_description"
                className="text-sm font-medium"
              >
                Default Task Description
              </label>
              <textarea
                id="default_description"
                name="default_description"
                rows={4}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/services">Cancel</Link>
            </Button>
            <Button type="submit">Create Service</Button>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}
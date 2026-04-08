import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { Card, CardContent } from "@/components/ui/Card";

async function updateService(formData: FormData) {
  "use server";

  await requireRole(["admin", "office"]);
  const supabase = await createClient();

  const id = String(formData.get("id") || "").trim();
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

  if (!id) {
    throw new Error("Missing service id.");
  }

  if (!name || !category) {
    throw new Error("Name and category are required.");
  }

  const base_price = base_price_raw === "" ? null : Number(base_price_raw);

  if (base_price_raw !== "" && Number.isNaN(base_price)) {
    throw new Error("Base price must be a valid number.");
  }

  const { error } = await supabase
    .from("services")
    .update({
      name,
      description: description || null,
      category,
      base_price,
      default_priority,
      default_title: default_title || null,
      default_description: default_description || null,
      is_active,
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/services/${id}`);
}

type EditServicePageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditServicePage({
  params,
}: EditServicePageProps) {
  await requireRole(["admin", "office"]);

  const supabase = await createClient();
  const { id } = await params;

  const { data: service, error } = await supabase
    .from("services")
    .select(
      `
      id,
      name,
      description,
      category,
      base_price,
      default_priority,
      default_title,
      default_description,
      is_active
    `
    )
    .eq("id", id)
    .single();

  if (error || !service) {
    return notFound();
  }

  return (
    <div className="space-y-6">
    <div className="space-y-4">
  <Button asChild variant="ghost">
    <Link href="/somewhere">← Back</Link>
  </Button>

  <PageHeader
    title="Edit Service"
    description= {service.name || "-"}
  />
</div>

      <SectionCard
        title="Service Setup"
        description="Update the service catalog definition and its default task behavior."
      >
        <form action={updateService} className="space-y-6">
          <input type="hidden" name="id" value={service.id} />

          <Card size="sm">
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Services remain reusable catalog items. They can be included in
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
                defaultValue={service.name || ""}
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
                defaultValue={service.category || ""}
                required
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
                defaultValue={service.base_price ?? ""}
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
                defaultValue={service.default_priority || "medium"}
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
                defaultValue={service.default_title || ""}
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
                defaultValue={service.default_description || ""}
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
                defaultValue={String(service.is_active)}
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
                defaultValue={service.description || ""}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`/services/${service.id}`}>Cancel</Link>
            </Button>
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";

async function updateService(formData: FormData) {
  "use server";

  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const base_price_raw = String(formData.get("base_price") || "").trim();
  const default_priority = String(formData.get("default_priority") || "medium").trim();
  const default_title = String(formData.get("default_title") || "").trim();
  const default_description = String(formData.get("default_description") || "").trim();
  const is_active = String(formData.get("is_active") || "true") === "true";

  if (!id) {
    throw new Error("Missing service id.");
  }

  if (!name || !category) {
    throw new Error("Name and category are required.");
  }

  const base_price =
    base_price_raw === "" ? null : Number(base_price_raw);

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
  const { id } = await params;

  const { data: service, error } = await supabase
    .from("services")
    .select(`
      id,
      name,
      description,
      category,
      base_price,
      default_priority,
      default_title,
      default_description,
      is_active
    `)
    .eq("id", id)
    .single();

  if (error || !service) {
    return notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Edit Service</h1>
          <p className="page-subtitle">{service.name || "-"}</p>
        </div>

        <div className="flex gap-2">
          <Link href={`/services/${service.id}`} className="btn">
            Back to Service
          </Link>
        </div>
      </div>

      <form action={updateService} className="card space-y-6">
        <input type="hidden" name="id" value={service.id} />

        <div className="grid grid-2 gap-4">
          <div>
            <label htmlFor="name" className="field-label">
              Name *
            </label>
            <input
              id="name"
              name="name"
              type="text"
              defaultValue={service.name || ""}
              required
              className="input"
            />
          </div>

          <div>
            <label htmlFor="category" className="field-label">
              Category *
            </label>
            <select
              id="category"
              name="category"
              defaultValue={service.category || ""}
              required
              className="input"
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

          <div>
            <label htmlFor="base_price" className="field-label">
              Base Price
            </label>
            <input
              id="base_price"
              name="base_price"
              type="number"
              step="0.01"
              min="0"
              defaultValue={service.base_price ?? ""}
              className="input"
            />
          </div>

          <div>
            <label htmlFor="default_priority" className="field-label">
              Default Priority
            </label>
            <select
              id="default_priority"
              name="default_priority"
              defaultValue={service.default_priority || "medium"}
              className="input"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="col-span-2">
            <label htmlFor="default_title" className="field-label">
              Default Task Title
            </label>
            <input
              id="default_title"
              name="default_title"
              type="text"
              defaultValue={service.default_title || ""}
              className="input"
            />
          </div>

          <div className="col-span-2">
            <label htmlFor="default_description" className="field-label">
              Default Task Description
            </label>
            <textarea
              id="default_description"
              name="default_description"
              rows={4}
              defaultValue={service.default_description || ""}
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
              defaultValue={String(service.is_active)}
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
              defaultValue={service.description || ""}
              className="input"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Link href={`/services/${service.id}`} className="btn">
            Cancel
          </Link>
          <button type="submit" className="btn">
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
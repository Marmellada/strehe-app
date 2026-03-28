import Link from "next/link";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";

async function createService(formData: FormData) {
  "use server";

  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const base_price_raw = String(formData.get("base_price") || "").trim();
  const default_priority = String(formData.get("default_priority") || "medium").trim();
  const default_title = String(formData.get("default_title") || "").trim();
  const default_description = String(formData.get("default_description") || "").trim();
  const is_active = String(formData.get("is_active") || "true") === "true";

  if (!name || !category) {
    throw new Error("Name and category are required.");
  }

  const base_price =
    base_price_raw === "" ? null : Number(base_price_raw);

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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title">New Service</h1>
          <p className="page-subtitle">Create a new service offering</p>
        </div>

        <Link href="/services" className="btn">
          Back
        </Link>
      </div>

      <form action={createService} className="card space-y-6">
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
            <label htmlFor="category" className="field-label">
              Category *
            </label>
            <select
              id="category"
              name="category"
              required
              defaultValue=""
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
              defaultValue="medium"
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
          <Link href="/services" className="btn">
            Cancel
          </Link>
          <button type="submit" className="btn btn-primary">
            Create Service
          </button>
        </div>
      </form>
    </div>
  );
}
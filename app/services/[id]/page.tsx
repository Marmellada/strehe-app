import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";

async function deleteService(formData: FormData) {
  "use server";

  const id = String(formData.get("id") || "").trim();

  if (!id) {
    throw new Error("Missing service id.");
  }

  const { error } = await supabase.from("services").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  redirect("/services");
}

function formatLabel(value: string | null | undefined) {
  if (!value) return "-";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (l: string) => l.toUpperCase());
}

function formatPrice(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";

  const num = typeof value === "number" ? value : Number(value);

  if (Number.isNaN(num)) return "-";

  return `€${num.toFixed(2)}`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";

  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type ServicePageProps = {
  params: Promise<{ id: string }>;
};

export default async function ServiceDetailPage({
  params,
}: ServicePageProps) {
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
      is_active,
      created_at,
      updated_at
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
          <h1 className="page-title">{service.name || "Untitled Service"}</h1>
          <p className="page-subtitle">{formatLabel(service.category)}</p>
        </div>

        <div className="flex gap-2">
          <Link href={`/services/${service.id}/edit`} className="btn">
            Edit Service
          </Link>

          <form action={deleteService}>
            <input type="hidden" name="id" value={service.id} />
            <button type="submit" className="btn btn-danger">
              Delete Service
            </button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="grid grid-2 gap-4">
          <div>
            <p className="field-label">Name</p>
            <p>{service.name || "-"}</p>
          </div>

          <div>
            <p className="field-label">Category</p>
            <p>{formatLabel(service.category)}</p>
          </div>

          <div>
            <p className="field-label">Base Price</p>
            <p>{formatPrice(service.base_price)}</p>
          </div>

          <div>
            <p className="field-label">Default Priority</p>
            <p>{formatLabel(service.default_priority)}</p>
          </div>

          <div>
            <p className="field-label">Status</p>
            <p>{service.is_active ? "Active" : "Inactive"}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title mb-4">Task Template</h2>

        <div className="grid grid-2 gap-4">
          <div className="col-span-2">
            <p className="field-label">Default Task Title</p>
            <p>{service.default_title || "No default title set."}</p>
          </div>

          <div className="col-span-2">
            <p className="field-label">Default Task Description</p>
            <p>{service.default_description || "No default description set."}</p>
          </div>

          <div>
            <p className="field-label">Default Priority</p>
            <p>{formatLabel(service.default_priority)}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title mb-4">Description</h2>
        <p>{service.description || "No description provided."}</p>
      </div>

      <div className="card">
        <h2 className="section-title mb-4">System Info</h2>

        <div className="grid grid-2 gap-4">
          <div>
            <p className="field-label">Created At</p>
            <p>{formatDateTime(service.created_at)}</p>
          </div>

          <div>
            <p className="field-label">Updated At</p>
            <p>{formatDateTime(service.updated_at)}</p>
          </div>
        </div>
      </div>

      <div>
        <Link href="/services" className="text-sm underline">
          ← Back to services
        </Link>
      </div>
    </div>
  );
}
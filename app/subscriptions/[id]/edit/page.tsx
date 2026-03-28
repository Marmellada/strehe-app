import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";

async function updateSubscription(formData: FormData) {
  "use server";

  const id = String(formData.get("id") || "").trim();
  const client_id = String(formData.get("client_id") || "").trim();
  const property_id = String(formData.get("property_id") || "").trim();
  const package_id = String(formData.get("package_id") || "").trim();

  const start_date = String(formData.get("start_date") || "").trim();
  const end_date = String(formData.get("end_date") || "").trim();
  const status = String(formData.get("status") || "active").trim();

  const monthly_price_raw = String(formData.get("monthly_price") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  if (!id) {
    throw new Error("Missing subscription id.");
  }

  if (!client_id || !property_id || !package_id || !start_date) {
    throw new Error("Client, property, package and start date are required.");
  }

  const monthly_price =
    monthly_price_raw === "" ? null : Number(monthly_price_raw);

  if (monthly_price_raw !== "" && Number.isNaN(monthly_price)) {
    throw new Error("Monthly price must be a valid number.");
  }

  const { error } = await supabase
    .from("subscriptions")
    .update({
      client_id,
      property_id,
      package_id,
      start_date,
      end_date: end_date || null,
      status,
      monthly_price,
      notes: notes || null,
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/subscriptions/${id}`);
}

type EditSubscriptionPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditSubscriptionPage({
  params,
}: EditSubscriptionPageProps) {
  const { id } = await params;

  const [
    { data: subscription, error },
    { data: clients },
    { data: properties },
    { data: packages },
  ] = await Promise.all([
    supabase
      .from("subscriptions")
      .select(`
        id,
        client_id,
        property_id,
        package_id,
        start_date,
        end_date,
        status,
        monthly_price,
        notes
      `)
      .eq("id", id)
      .single(),

    supabase
      .from("clients")
      .select("id, full_name, company_name")
      .order("created_at", { ascending: false }),

    supabase
      .from("properties")
      .select("id, title, property_code")
      .order("created_at", { ascending: false }),

    supabase
      .from("packages")
      .select("id, name, monthly_price")
      .order("name", { ascending: true }),
  ]);

  if (error || !subscription) {
    return notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Edit Subscription</h1>
          <p className="page-subtitle">{subscription.id}</p>
        </div>

        <div className="flex gap-2">
          <Link href={`/subscriptions/${subscription.id}`} className="btn">
            Back to Subscription
          </Link>
        </div>
      </div>

      <form action={updateSubscription} className="card space-y-6">
        <input type="hidden" name="id" value={subscription.id} />

        <div className="grid grid-2 gap-4">
          <div>
            <label htmlFor="client_id" className="field-label">
              Client *
            </label>
            <select
              id="client_id"
              name="client_id"
              required
              defaultValue={subscription.client_id || ""}
              className="input"
            >
              <option value="" disabled>
                Select client
              </option>
              {clients?.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.company_name || c.full_name || "-"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="property_id" className="field-label">
              Property *
            </label>
            <select
              id="property_id"
              name="property_id"
              required
              defaultValue={subscription.property_id || ""}
              className="input"
            >
              <option value="" disabled>
                Select property
              </option>
              {properties?.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.property_code
                    ? `${p.property_code} - ${p.title || ""}`
                    : p.title || "-"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="package_id" className="field-label">
              Package *
            </label>
            <select
              id="package_id"
              name="package_id"
              required
              defaultValue={subscription.package_id || ""}
              className="input"
            >
              <option value="" disabled>
                Select package
              </option>
              {packages?.map((pkg: any) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.name} ({pkg.monthly_price ? `€${pkg.monthly_price}` : "-"})
                </option>
              ))}
            </select>
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
              defaultValue={subscription.monthly_price ?? ""}
              className="input"
            />
          </div>

          <div>
            <label htmlFor="start_date" className="field-label">
              Start Date *
            </label>
            <input
              id="start_date"
              name="start_date"
              type="date"
              required
              defaultValue={subscription.start_date || ""}
              className="input"
            />
          </div>

          <div>
            <label htmlFor="end_date" className="field-label">
              End Date
            </label>
            <input
              id="end_date"
              name="end_date"
              type="date"
              defaultValue={subscription.end_date || ""}
              className="input"
            />
          </div>

          <div>
            <label htmlFor="status" className="field-label">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={subscription.status || "active"}
              className="input"
            >
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="col-span-2">
            <label htmlFor="notes" className="field-label">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={4}
              defaultValue={subscription.notes || ""}
              className="input"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Link href={`/subscriptions/${subscription.id}`} className="btn">
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
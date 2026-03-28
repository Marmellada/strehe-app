import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";

async function deleteSubscription(formData: FormData) {
  "use server";

  const id = String(formData.get("id") || "").trim();

  if (!id) {
    throw new Error("Missing subscription id.");
  }

  const { error } = await supabase
    .from("subscriptions")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  redirect("/subscriptions");
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

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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

type SubscriptionPageProps = {
  params: Promise<{ id: string }>;
};

export default async function SubscriptionDetailPage({
  params,
}: SubscriptionPageProps) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      `
        id,
        start_date,
        end_date,
        status,
        monthly_price,
        notes,
        created_at,
        updated_at,
        client:clients!subscriptions_client_fk (
          id,
          full_name,
          company_name
        ),
        property:properties!subscriptions_property_fk (
          id,
          title,
          property_code,
          address_line_1
        ),
        package:packages!subscriptions_package_fk (
          id,
          name,
          monthly_price,
          description
        )
      `
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return notFound();
  }

  const subscription: any = data;

  const clientName =
    subscription.client?.company_name ||
    subscription.client?.full_name ||
    "-";

  const propertyLabel =
    subscription.property?.property_code
      ? `${subscription.property.property_code} - ${subscription.property?.title || ""}`
      : subscription.property?.title || "-";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Subscription</h1>
          <p className="page-subtitle">{clientName}</p>
        </div>

        <div className="flex gap-2">
          <Link href={`/subscriptions/${subscription.id}/edit`} className="btn">
            Edit Subscription
          </Link>

          <form action={deleteSubscription}>
            <input type="hidden" name="id" value={subscription.id} />
            <button type="submit" className="btn btn-danger">
              Delete Subscription
            </button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="grid grid-2 gap-4">
          <div>
            <p className="field-label">Client</p>
            <p>{clientName}</p>
          </div>

          <div>
            <p className="field-label">Property</p>
            <p>{propertyLabel}</p>
          </div>

          <div>
            <p className="field-label">Package</p>
            <p>{subscription.package?.name || "-"}</p>
          </div>

          <div>
            <p className="field-label">Status</p>
            <p>{formatLabel(subscription.status)}</p>
          </div>

          <div>
            <p className="field-label">Monthly Price</p>
            <p>{formatPrice(subscription.monthly_price)}</p>
          </div>

          <div>
            <p className="field-label">Package Default Price</p>
            <p>{formatPrice(subscription.package?.monthly_price)}</p>
          </div>

          <div>
            <p className="field-label">Start Date</p>
            <p>{formatDate(subscription.start_date)}</p>
          </div>

          <div>
            <p className="field-label">End Date</p>
            <p>{formatDate(subscription.end_date)}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title mb-4">Property Details</h2>

        <div className="grid grid-2 gap-4">
          <div>
            <p className="field-label">Property Code</p>
            <p>{subscription.property?.property_code || "-"}</p>
          </div>

          <div>
            <p className="field-label">Title</p>
            <p>{subscription.property?.title || "-"}</p>
          </div>

          <div>
            <p className="field-label">Address</p>
            <p>{subscription.property?.address_line_1 || "-"}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title mb-4">Package Details</h2>
        <div className="grid grid-2 gap-4">
          <div>
            <p className="field-label">Package Name</p>
            <p>{subscription.package?.name || "-"}</p>
          </div>

          <div>
            <p className="field-label">Package Price</p>
            <p>{formatPrice(subscription.package?.monthly_price)}</p>
          </div>

          <div className="col-span-2">
            <p className="field-label">Package Description</p>
            <p>{subscription.package?.description || "No description provided."}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title mb-4">Notes</h2>
        <p>{subscription.notes || "No notes provided."}</p>
      </div>

      <div className="card">
        <h2 className="section-title mb-4">System Info</h2>

        <div className="grid grid-2 gap-4">
          <div>
            <p className="field-label">Created At</p>
            <p>{formatDateTime(subscription.created_at)}</p>
          </div>

          <div>
            <p className="field-label">Updated At</p>
            <p>{formatDateTime(subscription.updated_at)}</p>
          </div>
        </div>
      </div>

      <div>
        <Link href="/subscriptions" className="text-sm underline">
          ← Back to subscriptions
        </Link>
      </div>
    </div>
  );
}
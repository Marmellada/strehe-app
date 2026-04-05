import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { Card, CardContent } from "@/components/ui/Card";

async function updateSubscription(formData: FormData) {
  "use server";

  const supabase = await createClient();

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
    throw new Error("Missing contract id.");
  }

  if (!client_id || !property_id || !package_id || !start_date) {
    throw new Error("Client, property, package, and start date are required.");
  }

  const monthly_price = monthly_price_raw === "" ? null : Number(monthly_price_raw);

  if (monthly_price_raw !== "" && Number.isNaN(monthly_price)) {
    throw new Error("Monthly price must be a valid number.");
  }

  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("id, owner_client_id")
    .eq("id", property_id)
    .single();

  if (propertyError || !property) {
    throw new Error(propertyError?.message || "Property not found.");
  }

  if (property.owner_client_id !== client_id) {
    throw new Error("Selected property does not belong to the selected client.");
  }

  const { data: blockingContracts, error: blockingError } = await supabase
    .from("subscriptions")
    .select("id, status")
    .eq("property_id", property_id)
    .neq("id", id)
    .in("status", ["active", "paused"]);

  if (blockingError) {
    throw new Error(blockingError.message);
  }

  if (blockingContracts && blockingContracts.length > 0) {
    throw new Error("This property already has another active or paused contract.");
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
  params: { id: string };
};

export default async function EditSubscriptionPage({
  params,
}: EditSubscriptionPageProps) {
  const supabase = await createClient();
  const id = params.id;

  const [
    { data: subscription, error },
    { data: clients, error: clientsError },
    { data: properties, error: propertiesError },
    { data: packages, error: packagesError },
  ] = await Promise.all([
    supabase
      .from("subscriptions")
      .select(
        `
        id,
        client_id,
        property_id,
        package_id,
        start_date,
        end_date,
        status,
        monthly_price,
        notes
      `
      )
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
      .select("id, name, monthly_price, is_active")
      .order("name", { ascending: true }),
  ]);

  if (error || !subscription) {
    return notFound();
  }

  if (clientsError) {
    throw new Error(clientsError.message);
  }

  if (propertiesError) {
    throw new Error(propertiesError.message);
  }

  if (packagesError) {
    throw new Error(packagesError.message);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Contract"
        description={subscription.id}
        backHref={`/subscriptions/${subscription.id}`}
        actions={
  <div className="flex gap-2">
    <Button asChild variant="outline">
      <Link href={`/subscriptions/${subscription.id}`}>
        Back to Contract
      </Link>
    </Button>

    {subscription?.id && (
      <>
        <Button asChild>
          <Link href={`/subscriptions/${subscription.id}/pdf`}>
            Open PDF
          </Link>
        </Button>

        <Button asChild variant="outline">
          <Link href={`/subscriptions/${subscription.id}/pdf?download=1`}>
            Download PDF
          </Link>
        </Button>
      </>
    )}
  </div>
}
      />

      <SectionCard
        title="Contract Setup"
        description="Edit the source contract record that the scheduled generator reads later."
      >
        <form action={updateSubscription} className="space-y-6">
          <input type="hidden" name="id" value={subscription.id} />

          <Card size="sm">
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Editing a contract updates the source record used for future scheduled work.
                It does not create tasks immediately.
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="client_id" className="text-sm font-medium">
                Client *
              </label>
              <select
                id="client_id"
                name="client_id"
                required
                defaultValue={subscription.client_id || ""}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  Select client
                </option>
                {clients?.map((client: any) => (
                  <option key={client.id} value={client.id}>
                    {client.company_name || client.full_name || "-"}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="property_id" className="text-sm font-medium">
                Property *
              </label>
              <select
                id="property_id"
                name="property_id"
                required
                defaultValue={subscription.property_id || ""}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  Select property
                </option>
                {properties?.map((property: any) => (
                  <option key={property.id} value={property.id}>
                    {property.property_code
                      ? `${property.property_code} - ${property.title || ""}`
                      : property.title || "-"}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="package_id" className="text-sm font-medium">
                Package *
              </label>
              <select
                id="package_id"
                name="package_id"
                required
                defaultValue={subscription.package_id || ""}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  Select package
                </option>
                {packages?.map((pkg: any) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.name}
                    {pkg.monthly_price !== null && pkg.monthly_price !== undefined
                      ? ` (€${pkg.monthly_price})`
                      : ""}
                    {pkg.is_active === false ? " [Inactive]" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="monthly_price" className="text-sm font-medium">
                Monthly Price *
              </label>
              <input
                id="monthly_price"
                name="monthly_price"
                type="number"
                step="0.01"
                min="0"
                required
                defaultValue={subscription.monthly_price ?? ""}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="start_date" className="text-sm font-medium">
                Start Date *
              </label>
              <input
                id="start_date"
                name="start_date"
                type="date"
                required
                defaultValue={subscription.start_date || ""}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="end_date" className="text-sm font-medium">
                End Date
              </label>
              <input
                id="end_date"
                name="end_date"
                type="date"
                defaultValue={subscription.end_date || ""}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="status" className="text-sm font-medium">
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={subscription.status || "active"}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label htmlFor="notes" className="text-sm font-medium">
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={4}
                defaultValue={subscription.notes || ""}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`/subscriptions/${subscription.id}`}>Cancel</Link>
            </Button>
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}
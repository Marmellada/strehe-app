import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import CreateSubscriptionForm from "@/app/subscriptions/create/CreateSubscriptionForm";

async function createSubscription(formData: FormData) {
  "use server";

  const supabase = await createClient();

  const client_id = String(formData.get("client_id") || "").trim();
  const property_id = String(formData.get("property_id") || "").trim();
  const package_id = String(formData.get("package_id") || "").trim();

  const start_date = String(formData.get("start_date") || "").trim();
  const end_date = String(formData.get("end_date") || "").trim();
  const status = String(formData.get("status") || "active").trim();
  const monthly_price_raw = String(formData.get("monthly_price") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  if (!client_id || !property_id || !package_id || !start_date) {
    throw new Error("Client, property, package, and start date are required.");
  }

  const monthly_price = Number(monthly_price_raw);
  if (!monthly_price_raw || Number.isNaN(monthly_price)) {
    throw new Error("Monthly price is required and must be valid.");
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
    .in("status", ["active", "paused"]);

  if (blockingError) {
    throw new Error(blockingError.message);
  }

  if (blockingContracts && blockingContracts.length > 0) {
    throw new Error("This property already has an active or paused contract.");
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .insert({
      client_id,
      property_id,
      package_id,
      start_date,
      end_date: end_date || null,
      status,
      monthly_price,
      notes: notes || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to create contract.");
  }

  redirect(`/subscriptions/${data.id}`);
}

export default async function CreateSubscriptionPage() {
  const supabase = await createClient();

  const [clientsResult, propertiesResult, packagesResult, subscriptionsResult] =
    await Promise.all([
      supabase
        .from("clients")
        .select("id, full_name, company_name")
        .order("created_at", { ascending: false }),

      supabase
        .from("properties")
        .select("id, title, property_code, owner_client_id")
        .order("created_at", { ascending: false }),

      supabase
        .from("packages")
        .select("id, name, monthly_price, is_active")
        .eq("is_active", true)
        .order("name", { ascending: true }),

      supabase.from("subscriptions").select("id, property_id, status"),
    ]);

  if (clientsResult.error) {
    throw new Error(`Clients load error: ${clientsResult.error.message}`);
  }

  if (propertiesResult.error) {
    throw new Error(`Properties load error: ${propertiesResult.error.message}`);
  }

  if (packagesResult.error) {
    throw new Error(`Packages load error: ${packagesResult.error.message}`);
  }

  if (subscriptionsResult.error) {
    throw new Error(`Contracts load error: ${subscriptionsResult.error.message}`);
  }

  const clients = clientsResult.data || [];
  const properties = propertiesResult.data || [];
  const packages = packagesResult.data || [];
  const subscriptions = subscriptionsResult.data || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Contract"
        description="Create a contract by linking client, property, and package"
        backHref="/subscriptions"
        actions={
          <Button asChild variant="outline">
            <Link href="/subscriptions">Back</Link>
          </Button>
        }
      />

      <SectionCard
        title="Contract Setup"
        description="Create the source contract record that the scheduled generator reads later."
      >
        <CreateSubscriptionForm
          clients={clients}
          properties={properties}
          packages={packages}
          subscriptions={subscriptions}
          action={createSubscription}
        />
      </SectionCard>
    </div>
  );
}
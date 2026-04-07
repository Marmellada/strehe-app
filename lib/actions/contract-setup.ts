import { createClient } from "@/lib/supabase/server";

/**
 * Keeps legacy action name while enriching newly created subscriptions
 * with immutable display snapshots.
 */
export async function setupContractAutomation(subscriptionId: string) {
  if (!subscriptionId) {
    throw new Error("Missing subscription id.");
  }

  const supabase = await createClient();

  const { data: subscription, error: subscriptionError } = await supabase
    .from("subscriptions")
    .select("id, client_id, property_id, package_id")
    .eq("id", subscriptionId)
    .single();

  if (subscriptionError || !subscription) {
    throw new Error(subscriptionError?.message || "Subscription not found.");
  }

  const [{ data: client, error: clientError }, { data: property, error: propertyError }, { data: pkg, error: packageError }] =
    await Promise.all([
      supabase
        .from("clients")
        .select("id, full_name, company_name")
        .eq("id", subscription.client_id)
        .single(),
      supabase
        .from("properties")
        .select("id, property_code")
        .eq("id", subscription.property_id)
        .single(),
      supabase
        .from("packages")
        .select("id, name")
        .eq("id", subscription.package_id)
        .single(),
    ]);

  if (clientError || !client) {
    throw new Error(clientError?.message || "Client not found.");
  }

  if (propertyError || !property) {
    throw new Error(propertyError?.message || "Property not found.");
  }

  if (packageError || !pkg) {
    throw new Error(packageError?.message || "Package not found.");
  }

  const clientSnapshot = client.company_name || client.full_name || null;

  const { error: updateError } = await supabase
    .from("subscriptions")
    .update({
      client_name_snapshot: clientSnapshot,
      property_code_snapshot: property.property_code ?? null,
      package_name_snapshot: pkg.name,
    })
    .eq("id", subscriptionId);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

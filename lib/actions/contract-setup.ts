import { createClient } from "@/lib/supabase/server";

export type ContractSnapshotPayload = {
  client_name_snapshot: string | null;
  property_code_snapshot: string | null;
  package_name_snapshot: string | null;
};

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

  const snapshot = await resolveContractSnapshot({
    clientId: subscription.client_id,
    propertyId: subscription.property_id,
    packageId: subscription.package_id,
  });

  const { error: updateError } = await supabase
    .from("subscriptions")
    .update(snapshot)
    .eq("id", subscriptionId);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

export async function resolveContractSnapshot({
  clientId,
  propertyId,
  packageId,
}: {
  clientId: string;
  propertyId: string;
  packageId: string;
}): Promise<ContractSnapshotPayload> {
  const supabase = await createClient();

  const [
    { data: client, error: clientError },
    { data: property, error: propertyError },
    { data: pkg, error: packageError },
  ] = await Promise.all([
    supabase
      .from("clients")
      .select("id, full_name, company_name")
      .eq("id", clientId)
      .single(),
    supabase
      .from("properties")
      .select("id, property_code")
      .eq("id", propertyId)
      .single(),
    supabase
      .from("packages")
      .select("id, name")
      .eq("id", packageId)
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

  return {
    client_name_snapshot: clientSnapshot,
    property_code_snapshot: property.property_code ?? null,
    package_name_snapshot: pkg.name,
  };
}

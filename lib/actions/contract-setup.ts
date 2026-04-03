import { createClient } from "@/lib/supabase/server";

export async function setupContractAutomation(subscriptionId: string) {
  const supabase = await createClient();

  const { data: subscription, error: subscriptionError } = await supabase
    .from("subscriptions")
    .select(
      `
      id,
      package:packages (
        id,
        name
      )
    `
    )
    .eq("id", subscriptionId)
    .single();

  if (subscriptionError || !subscription) {
    throw new Error(subscriptionError?.message || "Subscription not found");
  }

  const pkg = Array.isArray(subscription.package)
    ? subscription.package[0]
    : subscription.package;

  const packageName = pkg?.name?.toLowerCase()?.trim();

  if (!packageName) {
    throw new Error("Subscription package is missing");
  }

  let templateName = "";

  if (packageName.includes("basic")) {
    templateName = "Basic Monthly Visit";
  } else if (packageName.includes("standard")) {
    templateName = "Standard Visits";
  } else if (packageName.includes("premium")) {
    templateName = "Premium Visits";
  } else {
    throw new Error(`No automation rule found for package: ${pkg?.name}`);
  }

  const { data: template, error: templateError } = await supabase
    .from("task_templates")
    .select("id, name")
    .eq("name", templateName)
    .single();

  if (templateError || !template) {
    throw new Error(templateError?.message || "Task template not found");
  }

  const { data: existing } = await supabase
    .from("subscription_tasks")
    .select("id")
    .eq("subscription_id", subscriptionId)
    .eq("template_id", template.id)
    .limit(1);

  if (existing && existing.length > 0) {
    return;
  }

  const { error: insertError } = await supabase
    .from("subscription_tasks")
    .insert({
      subscription_id: subscriptionId,
      template_id: template.id,
      is_active: true,
    });

  if (insertError) {
    throw new Error(insertError.message);
  }
}
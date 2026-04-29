import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import CreateSubscriptionForm from "@/app/subscriptions/create/CreateSubscriptionForm";
import { resolveContractSnapshot } from "@/lib/actions/contract-setup";
import { validatePromotionCode } from "@/lib/promotions/validation";

const SUBSCRIPTION_EDITABLE_STATUSES = [
  "draft",
  "prepared",
  "paused",
  "cancelled",
] as const;

async function createSubscription(formData: FormData) {
  "use server";

  const { authUser } = await requireRole(["admin"]);
  const supabase = await createClient();

  const client_id = String(formData.get("client_id") || "").trim();
  const property_id = String(formData.get("property_id") || "").trim();
  const package_id = String(formData.get("package_id") || "").trim();

  const start_date = String(formData.get("start_date") || "").trim();
  const end_date = String(formData.get("end_date") || "").trim();
  const status = String(formData.get("status") || "draft")
    .trim()
    .toLowerCase();
  const monthly_price_raw = String(formData.get("monthly_price") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  if (!client_id || !property_id || !package_id || !start_date) {
    throw new Error("Client, property, package, and start date are required.");
  }

  const monthly_price = Number(monthly_price_raw);
  if (!monthly_price_raw || Number.isNaN(monthly_price)) {
    throw new Error("Monthly price is required and must be valid.");
  }

  if (
    !SUBSCRIPTION_EDITABLE_STATUSES.includes(
      status as (typeof SUBSCRIPTION_EDITABLE_STATUSES)[number]
    )
  ) {
    throw new Error("Invalid contract status.");
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

  const snapshot = await resolveContractSnapshot({
    clientId: client_id,
    propertyId: property_id,
    packageId: package_id,
  });

  const promotionCode = String(formData.get("promotion_code") || "")
    .trim()
    .toUpperCase();
  let finalMonthlyPrice = monthly_price;
  let promotionPayload: Record<string, unknown> = {
    original_monthly_price: monthly_price,
    discounted_monthly_price: monthly_price,
  };
  let validatedPromotion:
    | Awaited<ReturnType<typeof validatePromotionCode>>
    | null = null;

  if (promotionCode) {
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("email")
      .eq("id", client_id)
      .maybeSingle();

    if (clientError) {
      throw new Error(clientError.message);
    }

    validatedPromotion = await validatePromotionCode({
      supabase,
      code: promotionCode,
      monthlyPrice: monthly_price,
      clientEmail: client?.email ?? null,
    });

    if (!validatedPromotion.ok) {
      throw new Error(validatedPromotion.error);
    }

    finalMonthlyPrice = validatedPromotion.discountedMonthlyPrice;
    promotionPayload = {
      promotion_code_id: validatedPromotion.code.id,
      original_monthly_price: validatedPromotion.originalMonthlyPrice,
      discount_type: validatedPromotion.campaign.discount_type,
      discount_percent: validatedPromotion.campaign.discount_percent,
      discount_amount_cents: validatedPromotion.campaign.discount_amount_cents,
      discounted_monthly_price: validatedPromotion.discountedMonthlyPrice,
      promotion_summary_snapshot: validatedPromotion.summary,
    };
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
      monthly_price: finalMonthlyPrice,
      notes: notes || null,
      physical_contract_confirmed_at: null,
      physical_contract_confirmed_by_user_id: null,
      ...snapshot,
      ...promotionPayload,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to create contract.");
  }

  if (validatedPromotion?.ok) {
    const { error: redemptionError } = await supabase
      .from("promotion_redemptions")
      .insert({
        promotion_code_id: validatedPromotion.code.id,
        subscription_id: data.id,
        client_id,
        redeemed_by_user_id: authUser.id,
        discount_type_snapshot: validatedPromotion.campaign.discount_type,
        discount_percent_snapshot:
          validatedPromotion.campaign.discount_percent,
        discount_amount_cents_snapshot:
          validatedPromotion.campaign.discount_amount_cents,
        original_monthly_price: validatedPromotion.originalMonthlyPrice,
        discounted_monthly_price: validatedPromotion.discountedMonthlyPrice,
      });

    if (redemptionError) {
      throw new Error(redemptionError.message);
    }

    const { error: codeUpdateError } = await supabase
      .from("promotion_codes")
      .update({
        status: "redeemed",
        redemption_count:
          (validatedPromotion.code.redemption_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", validatedPromotion.code.id);

    if (codeUpdateError) {
      throw new Error(codeUpdateError.message);
    }
  }

  redirect(`/subscriptions/${data.id}`);
}

export default async function CreateSubscriptionPage() {
  await requireRole(["admin"]);

  const supabase = await createClient();

  const [
    clientsResult,
    propertiesResult,
    packagesResult,
    subscriptionsResult,
    promotionCodesResult,
  ] =
    await Promise.all([
      supabase
        .from("clients")
        .select("id, full_name, company_name, email")
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

      supabase
        .from("promotion_codes")
        .select(
          `
          id,
          code,
          assigned_name,
          assigned_email,
          status,
          expires_at,
          redemption_count,
          max_redemptions,
          campaign:promotion_campaigns (
            id,
            name,
            discount_type,
            discount_percent,
            discount_amount_cents,
            active,
            starts_at,
            ends_at
          )
        `
        )
        .in("status", ["issued", "sent"])
        .order("created_at", { ascending: false }),
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

  if (promotionCodesResult.error) {
    throw new Error(`Promotion codes load error: ${promotionCodesResult.error.message}`);
  }

  const clients = clientsResult.data || [];
  const properties = propertiesResult.data || [];
  const packages = packagesResult.data || [];
  const subscriptions = subscriptionsResult.data || [];
  const promotionCodes = promotionCodesResult.data || [];

  return (
    <div className="space-y-6">
      <div className="space-y-4">
  <Button asChild variant="ghost">
    <Link href="/subscriptions">← Back</Link>
  </Button>

  <PageHeader
    title="New Contract"
    description="Create a contract by linking client, property, and package"
  />
</div>

      <SectionCard
        title="Contract Setup"
        description="Create the source contract record that the scheduled generator reads later."
      >
        <CreateSubscriptionForm
          clients={clients}
          properties={properties}
          packages={packages}
          subscriptions={subscriptions}
          promotionCodes={promotionCodes}
          action={createSubscription}
        />
      </SectionCard>
    </div>
  );
}

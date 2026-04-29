import type { createClient } from "@/lib/supabase/server";

type SupabaseClientLike = Awaited<ReturnType<typeof createClient>>;

type PromotionCampaignRow = {
  id: string;
  name: string;
  discount_type: "percent" | "fixed_amount";
  applies_to: "package_fee" | "service_lines" | "both";
  discount_percent: number | string | null;
  discount_amount_cents: number | null;
  currency: string | null;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean | null;
  max_redemptions: number | null;
};

type PromotionCodeRow = {
  id: string;
  campaign_id: string;
  code: string;
  assigned_name: string | null;
  assigned_email: string | null;
  status: string | null;
  expires_at: string | null;
  max_redemptions: number | null;
  redemption_count: number | null;
};

export type PromotionValidationResult =
  | {
      ok: true;
      code: PromotionCodeRow;
      campaign: PromotionCampaignRow;
      originalMonthlyPrice: number;
      discountValue: number;
      discountedMonthlyPrice: number;
      summary: string;
      warning?: string;
    }
  | {
      ok: false;
      error: string;
    };

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isBeforeToday(dateValue: string | null | undefined) {
  if (!dateValue) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(`${dateValue}T00:00:00`);
  return date < today;
}

function isAfterToday(dateValue: string | null | undefined) {
  if (!dateValue) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(`${dateValue}T00:00:00`);
  return date > today;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export async function validatePromotionCode({
  supabase,
  code,
  monthlyPrice,
  appliesTo = "package_fee",
  clientEmail,
}: {
  supabase: SupabaseClientLike;
  code: string;
  monthlyPrice: number;
  appliesTo?: "package_fee" | "service_lines";
  clientEmail?: string | null;
}): Promise<PromotionValidationResult> {
  const normalizedCode = normalizeCode(code);

  if (!normalizedCode) {
    return { ok: false, error: "Promotion code is empty." };
  }

  const { data: rawPromotionCode, error: codeError } = await supabase
    .from("promotion_codes")
    .select(
      "id, campaign_id, code, assigned_name, assigned_email, status, expires_at, max_redemptions, redemption_count"
    )
    .eq("code", normalizedCode)
    .maybeSingle();

  if (codeError) {
    return { ok: false, error: codeError.message };
  }

  if (!rawPromotionCode) {
    return { ok: false, error: "Promotion code was not found." };
  }

  const promotionCode = rawPromotionCode as PromotionCodeRow;
  const status = String(promotionCode.status || "").toLowerCase();
  if (!["issued", "sent"].includes(status)) {
    return { ok: false, error: "Promotion code is not available." };
  }

  if (isBeforeToday(promotionCode.expires_at)) {
    return { ok: false, error: "Promotion code has expired." };
  }

  const maxCodeRedemptions = promotionCode.max_redemptions || 1;
  const codeRedemptions = promotionCode.redemption_count || 0;
  if (codeRedemptions >= maxCodeRedemptions) {
    return { ok: false, error: "Promotion code has already been redeemed." };
  }

  const { data: rawCampaign, error: campaignError } = await supabase
    .from("promotion_campaigns")
    .select(
      "id, name, discount_type, applies_to, discount_percent, discount_amount_cents, currency, starts_at, ends_at, active, max_redemptions"
    )
    .eq("id", promotionCode.campaign_id)
    .maybeSingle();

  if (campaignError) {
    return { ok: false, error: campaignError.message };
  }

  if (!rawCampaign) {
    return { ok: false, error: "Promotion campaign was not found." };
  }

  const campaign = rawCampaign as PromotionCampaignRow;
  if (!campaign.active) {
    return { ok: false, error: "Promotion campaign is not active." };
  }

  if (campaign.applies_to !== "both" && campaign.applies_to !== appliesTo) {
    return {
      ok: false,
      error:
        appliesTo === "package_fee"
          ? "Promotion code does not apply to package fees."
          : "Promotion code does not apply to service invoice lines.",
    };
  }

  if (isAfterToday(campaign.starts_at)) {
    return { ok: false, error: "Promotion campaign has not started yet." };
  }

  if (isBeforeToday(campaign.ends_at)) {
    return { ok: false, error: "Promotion campaign has ended." };
  }

  if (campaign.max_redemptions !== null && campaign.max_redemptions !== undefined) {
    const { data: rawCampaignCodes, error: countError } = await supabase
      .from("promotion_codes")
      .select("redemption_count")
      .eq("campaign_id", campaign.id);

    if (countError) {
      return { ok: false, error: countError.message };
    }

    const campaignCodes = (rawCampaignCodes || []) as {
      redemption_count: number | null;
    }[];
    const campaignRedemptions = campaignCodes.reduce(
      (sum: number, row: { redemption_count: number | null }) =>
        sum + (row.redemption_count || 0),
      0
    );

    if (campaignRedemptions >= campaign.max_redemptions) {
      return { ok: false, error: "Promotion campaign redemption limit has been reached." };
    }
  }

  const originalMonthlyPrice = roundMoney(monthlyPrice);
  let discountValue = 0;

  if (campaign.discount_type === "percent") {
    const percent = toNumber(campaign.discount_percent);
    discountValue = roundMoney(originalMonthlyPrice * (percent / 100));
  } else {
    discountValue = roundMoney((campaign.discount_amount_cents || 0) / 100);
  }

  if (discountValue <= 0) {
    return { ok: false, error: "Promotion code has no valid discount value." };
  }

  const discountedMonthlyPrice = roundMoney(
    Math.max(0, originalMonthlyPrice - discountValue)
  );

  const assignedEmail = promotionCode.assigned_email?.trim().toLowerCase();
  const normalizedClientEmail = clientEmail?.trim().toLowerCase();
  const warning =
    assignedEmail && normalizedClientEmail && assignedEmail !== normalizedClientEmail
      ? "Assigned email does not match the selected client email."
      : undefined;

  const discountLabel =
    campaign.discount_type === "percent"
      ? `${toNumber(campaign.discount_percent)}%`
      : `€${discountValue.toFixed(2)}`;

  return {
    ok: true,
    code: promotionCode,
    campaign,
    originalMonthlyPrice,
    discountValue,
    discountedMonthlyPrice,
    summary: `${campaign.name} applied with code ${promotionCode.code}. Discount: ${discountLabel}. Normal price €${originalMonthlyPrice.toFixed(
      2
    )}, final price €${discountedMonthlyPrice.toFixed(2)}.`,
    warning,
  };
}

export function previewPromotionDiscount({
  discountType,
  discountPercent,
  discountAmountCents,
  monthlyPrice,
}: {
  discountType: "percent" | "fixed_amount";
  discountPercent: number | string | null;
  discountAmountCents: number | null;
  monthlyPrice: number;
}) {
  const original = roundMoney(monthlyPrice);
  const discount =
    discountType === "percent"
      ? roundMoney(original * (toNumber(discountPercent) / 100))
      : roundMoney((discountAmountCents || 0) / 100);

  return {
    original,
    discount,
    final: roundMoney(Math.max(0, original - discount)),
  };
}

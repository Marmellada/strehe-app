"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { sendPromotionCodeEmail } from "@/lib/email/promotion-code-email";

type CampaignForEmail = {
  id: string;
  name: string;
  discount_type: "percent" | "fixed_amount";
  applies_to: "package_fee" | "service_lines" | "both";
  discount_percent: number | string | null;
  discount_amount_cents: number | null;
};

function normalizeCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "-");
}

function generateCode(prefix = "STREHE") {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";

  for (let index = 0; index < 6; index += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return `${normalizeCode(prefix)}-${suffix}`;
}

function moneyToCents(value: string) {
  const parsed = Number(value);
  if (!value || Number.isNaN(parsed)) return null;
  return Math.round(parsed * 100);
}

function formatDiscount(campaign: CampaignForEmail) {
  if (campaign.discount_type === "percent") {
    return `${Number(campaign.discount_percent || 0)}%`;
  }

  return `€${((campaign.discount_amount_cents || 0) / 100).toFixed(2)}`;
}

function parseRecipientList(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);

      if (parts.length === 1) {
        return {
          name: "",
          email: parts[0],
        };
      }

      return {
        name: parts[0],
        email: parts[1],
      };
    });
}

async function getCampaignForEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  campaignId: string
) {
  const { data, error } = await supabase
    .from("promotion_campaigns")
    .select("id, name, discount_type, applies_to, discount_percent, discount_amount_cents")
    .eq("id", campaignId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Promotion campaign was not found.");
  }

  return data as CampaignForEmail;
}

async function sendAndMarkPromotionCode({
  supabase,
  codeId,
  code,
  assignedName,
  assignedEmail,
  expiresAt,
  campaign,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  codeId: string;
  code: string;
  assignedName: string | null;
  assignedEmail: string;
  expiresAt: string | null;
  campaign: CampaignForEmail;
}) {
  const sendResult = await sendPromotionCodeEmail({
    to: assignedEmail,
    name: assignedName,
    code,
    campaignName: campaign.name,
    discountLabel: formatDiscount(campaign),
    expiresAt,
  });

  if (sendResult.ok) {
    await supabase
      .from("promotion_codes")
      .update({
        status: "sent",
        emailed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {
          email_provider: "resend",
          email_message_id: sendResult.providerMessageId,
        },
      })
      .eq("id", codeId);

    return;
  }

  await supabase
    .from("promotion_codes")
    .update({
      metadata: {
        email_error: sendResult.error,
        email_attempted_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", codeId);
}

export async function createPromotionCampaignAction(formData: FormData) {
  await requireRole(["admin"]);

  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const discountType = String(formData.get("discount_type") || "percent");
  const appliesTo = String(formData.get("applies_to") || "package_fee").trim();
  const discountPercentRaw = String(formData.get("discount_percent") || "").trim();
  const discountAmountRaw = String(formData.get("discount_amount") || "").trim();
  const startsAt = String(formData.get("starts_at") || "").trim();
  const endsAt = String(formData.get("ends_at") || "").trim();
  const maxRedemptionsRaw = String(formData.get("max_redemptions") || "").trim();

  if (!name) {
    throw new Error("Campaign name is required.");
  }

  const discountPercent =
    discountType === "percent" ? Number(discountPercentRaw) : null;
  const discountAmountCents =
    discountType === "fixed_amount" ? moneyToCents(discountAmountRaw) : null;

  if (
    discountType === "percent" &&
    (!discountPercent || Number.isNaN(discountPercent))
  ) {
    throw new Error("Percent discount is required.");
  }

  if (discountType === "fixed_amount" && !discountAmountCents) {
    throw new Error("Fixed discount amount is required.");
  }

  const maxRedemptions = maxRedemptionsRaw ? Number(maxRedemptionsRaw) : null;
  if (maxRedemptionsRaw && Number.isNaN(maxRedemptions)) {
    throw new Error("Max redemptions must be a number.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("promotion_campaigns").insert({
    name,
    description: description || null,
    discount_type: discountType,
    applies_to: appliesTo,
    discount_percent: discountPercent,
    discount_amount_cents: discountAmountCents,
    currency: "EUR",
    starts_at: startsAt || null,
    ends_at: endsAt || null,
    active: true,
    max_redemptions: maxRedemptions,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings/promotions");
  redirect("/settings/promotions");
}

export async function createPromotionCodeAction(formData: FormData) {
  await requireRole(["admin"]);

  const campaignId = String(formData.get("campaign_id") || "").trim();
  const codeInput = String(formData.get("code") || "").trim();
  const assignedName = String(formData.get("assigned_name") || "").trim();
  const assignedEmail = String(formData.get("assigned_email") || "").trim();
  const source = String(formData.get("source") || "manual").trim();
  const expiresAt = String(formData.get("expires_at") || "").trim();
  const prefix = String(formData.get("prefix") || "STREHE").trim();
  const sendEmail = String(formData.get("send_email") || "") === "true";

  if (!campaignId) {
    throw new Error("Campaign is required.");
  }

  if (sendEmail && !assignedEmail) {
    throw new Error("Assigned email is required when sending immediately.");
  }

  const code = codeInput ? normalizeCode(codeInput) : generateCode(prefix);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("promotion_codes")
    .insert({
      campaign_id: campaignId,
      code,
      assigned_name: assignedName || null,
      assigned_email: assignedEmail || null,
      source: source || "manual",
      status: "issued",
      expires_at: expiresAt || null,
      max_redemptions: 1,
      redemption_count: 0,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("This promotion code already exists. Try another code.");
    }

    throw new Error(error.message);
  }

  if (sendEmail && data) {
    const campaign = await getCampaignForEmail(supabase, campaignId);

    await sendAndMarkPromotionCode({
      supabase,
      codeId: data.id,
      code,
      assignedName: assignedName || null,
      assignedEmail,
      expiresAt: expiresAt || null,
      campaign,
    });
  }

  revalidatePath("/settings/promotions");
  redirect("/settings/promotions");
}

export async function createBulkPromotionCodesAction(formData: FormData) {
  await requireRole(["admin"]);

  const campaignId = String(formData.get("campaign_id") || "").trim();
  const recipientsRaw = String(formData.get("recipients") || "").trim();
  const source = String(formData.get("source") || "survey").trim();
  const expiresAt = String(formData.get("expires_at") || "").trim();
  const prefix = String(formData.get("prefix") || "SURVEY-10").trim();
  const sendEmail = String(formData.get("send_email") || "") === "true";

  if (!campaignId) {
    throw new Error("Campaign is required.");
  }

  const recipients = parseRecipientList(recipientsRaw);

  if (recipients.length === 0) {
    throw new Error("Add at least one recipient.");
  }

  const invalidRecipient = recipients.find(
    (recipient) => !recipient.email || !recipient.email.includes("@")
  );

  if (invalidRecipient) {
    throw new Error(`Invalid email in recipient list: ${invalidRecipient.email}`);
  }

  const supabase = await createClient();
  const campaign = await getCampaignForEmail(supabase, campaignId);

  for (const recipient of recipients) {
    const code = generateCode(prefix);
    const { data, error } = await supabase
      .from("promotion_codes")
      .insert({
        campaign_id: campaignId,
        code,
        assigned_name: recipient.name || null,
        assigned_email: recipient.email,
        source: source || "survey",
        status: "issued",
        expires_at: expiresAt || null,
        max_redemptions: 1,
        redemption_count: 0,
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (sendEmail && data) {
      await sendAndMarkPromotionCode({
        supabase,
        codeId: data.id,
        code,
        assignedName: recipient.name || null,
        assignedEmail: recipient.email,
        expiresAt: expiresAt || null,
        campaign,
      });
    }
  }

  revalidatePath("/settings/promotions");
  redirect("/settings/promotions");
}

export async function markPromotionCodeSentAction(formData: FormData) {
  await requireRole(["admin"]);

  const id = String(formData.get("id") || "").trim();
  if (!id) {
    throw new Error("Missing promotion code id.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("promotion_codes")
    .update({
      status: "sent",
      emailed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .in("status", ["issued", "sent"]);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings/promotions");
}

export async function cancelPromotionCodeAction(formData: FormData) {
  await requireRole(["admin"]);

  const id = String(formData.get("id") || "").trim();
  if (!id) {
    throw new Error("Missing promotion code id.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("promotion_codes")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .neq("status", "redeemed");

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings/promotions");
}

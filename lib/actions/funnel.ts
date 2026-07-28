"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { FOUNDING_PACKAGES, STANDARD_EXCLUSIONS, type FoundingPackageKey } from "@/lib/funnel/definitions";
import { assertOfferCanBeSent, assertOfferTransition, type OfferStatus } from "@/lib/funnel/transitions";

function text(formData: FormData, key: string, max = 2000) {
  const value = String(formData.get(key) || "").normalize("NFKC").trim();
  if (value.length > max || /[<>{}\u0000-\u001f]/u.test(value)) {
    throw new Error(`${key} contains unsupported content.`);
  }
  return value || null;
}

function positiveInt(formData: FormData, key: string, fallback?: number) {
  const raw = text(formData, key, 20);
  if (!raw && fallback !== undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) throw new Error(`${key} must be a positive whole number.`);
  return value;
}

function money(formData: FormData, key: string, fallback?: number) {
  const raw = text(formData, key, 20);
  if (!raw && fallback !== undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new Error(`${key} must be a valid amount.`);
  return Math.round(value * 100);
}

async function context() {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, userId: user?.id || null };
}

async function event(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leadId: string,
  eventType: string,
  summary: string,
  userId: string | null,
  metadata: Record<string, unknown> = {}
) {
  const { error } = await supabase.from("lead_events").insert({
    lead_id: leadId,
    event_type: eventType,
    summary,
    created_by_user_id: userId,
    metadata,
  });
  if (error) throw new Error(error.message);
}

function refresh(leadId: string) {
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads/reports");
}

export async function qualifyLeadAction(leadId: string, formData: FormData) {
  const { supabase, userId } = await context();
  const outcome = text(formData, "qualification_outcome", 20);
  if (outcome !== "qualified" && outcome !== "disqualified") throw new Error("Choose a qualification outcome.");
  const now = new Date().toISOString();
  const { error } = await supabase.from("leads").update({
    qualification_outcome: outcome,
    qualification_notes: text(formData, "qualification_notes"),
    qualified_at: outcome === "qualified" ? now : null,
    disqualified_at: outcome === "disqualified" ? now : null,
    updated_at: now,
  }).eq("id", leadId);
  if (error) throw new Error(error.message);
  await event(supabase, leadId, outcome, `Lead ${outcome}`, userId);
  refresh(leadId);
}

export async function saveConsultationAction(leadId: string, formData: FormData) {
  const { supabase, userId } = await context();
  const { data: lead, error: leadError } = await supabase.from("leads").select("qualified_at").eq("id", leadId).single();
  if (leadError || !lead) throw new Error("Lead not found.");
  if (!lead.qualified_at) throw new Error("Qualify the lead before booking a consultation.");
  const scheduledStart = text(formData, "scheduled_start", 40);
  const contactFormat = text(formData, "contact_format", 30);
  const status = text(formData, "status", 20) || "booked";
  if (!scheduledStart || !["whatsapp_voice", "whatsapp_video"].includes(contactFormat || "")) {
    throw new Error("Scheduled start and WhatsApp format are required.");
  }
  if (!["requested", "booked", "completed", "cancelled", "no_show"].includes(status)) {
    throw new Error("Invalid consultation status.");
  }
  if (status === "completed") {
    const { count, error: bookedError } = await supabase.from("lead_consultations").select("id", { count: "exact", head: true }).eq("lead_id", leadId).eq("status", "booked");
    if (bookedError) throw new Error(bookedError.message);
    if (!count) throw new Error("Book the consultation before completing it.");
    if (!text(formData, "outcome") || !text(formData, "recommended_package", 80)) {
      throw new Error("Completed consultations require an outcome and recommended package.");
    }
  }
  const completedAt = status === "completed" ? new Date().toISOString() : null;
  const payload = {
    lead_id: leadId,
    owner_user_id: userId,
    scheduled_start: new Date(scheduledStart).toISOString(),
    contact_format: contactFormat,
    status,
    property_location: text(formData, "property_location", 240),
    property_count: positiveInt(formData, "property_count", 1),
    occupancy_condition: text(formData, "occupancy_condition"),
    access_key_situation: text(formData, "access_key_situation"),
    primary_concerns: text(formData, "primary_concerns"),
    desired_visit_frequency: text(formData, "desired_visit_frequency", 200),
    arrival_readiness_needs: text(formData, "arrival_readiness_needs"),
    known_maintenance_issues: text(formData, "known_maintenance_issues"),
    communication_preference: text(formData, "communication_preference", 200),
    recommended_package: text(formData, "recommended_package", 80),
    normal_approval_limit_cents: money(formData, "normal_approval_limit", 10000),
    emergency_limit_cents: money(formData, "emergency_limit", 30000),
    outcome: text(formData, "outcome"),
    next_action: text(formData, "next_action"),
    follow_up_date: text(formData, "follow_up_date", 20),
    completed_at: completedAt,
    created_by_user_id: userId,
  };
  const { data, error } = await supabase.from("lead_consultations").insert(payload).select("id").single();
  if (error) throw new Error(error.message);
  const now = new Date().toISOString();
  const { error: leadUpdateError } = await supabase.from("leads").update({
    consultation_scheduled_at: payload.scheduled_start,
    consultation_status: status,
    consultation_completed_at: completedAt,
    consultation_outcome: payload.outcome,
    recommended_package: payload.recommended_package,
    next_follow_up_date: payload.follow_up_date,
    updated_at: now,
  }).eq("id", leadId);
  if (leadUpdateError) throw new Error(leadUpdateError.message);
  await event(supabase, leadId, status === "completed" ? "consultation_completed" : "consultation_booked", status === "completed" ? "Consultation completed" : "Consultation booked", userId, { consultation_id: data.id });
  refresh(leadId);
}

export async function createOfferAction(leadId: string, formData: FormData) {
  const { supabase, userId } = await context();
  const { data: lead, error: leadError } = await supabase.from("leads").select("consultation_completed_at").eq("id", leadId).single();
  if (leadError || !lead) throw new Error("Lead not found.");
  if (!lead.consultation_completed_at) throw new Error("Complete a consultation before drafting an offer.");
  const packageKey = text(formData, "selected_package", 40) as FoundingPackageKey | null;
  if (!packageKey || !FOUNDING_PACKAGES[packageKey]) throw new Error("Choose a valid package.");
  const pkg = FOUNDING_PACKAGES[packageKey];
  const { data: versions, error: versionError } = await supabase.from("lead_offers").select("id,version,status,offer_number").eq("lead_id", leadId).order("version", { ascending: false }).limit(1);
  if (versionError) throw new Error(versionError.message);
  const version = ((versions?.[0]?.version as number | undefined) || 0) + 1;
  const previous = versions?.[0];
  if (previous?.status === "accepted") {
    throw new Error("An accepted offer cannot be replaced. Continue with conversion or record a separate approved change.");
  }
  if (previous && ["draft", "sent"].includes(previous.status)) {
    const supersededAt = new Date().toISOString();
    const { error: supersedeError } = await supabase.from("lead_offers").update({
      status: "superseded",
      superseded_at: supersededAt,
      updated_at: supersededAt,
    }).eq("id", previous.id).eq("status", previous.status);
    if (supersedeError) throw new Error(supersedeError.message);
    await event(supabase, leadId, "offer_superseded", `Offer ${previous.offer_number} superseded by a new version`, userId, { offer_id: previous.id });
  }
  const founding = text(formData, "founding_customer_eligible", 10) === "yes";
  const { data, error } = await supabase.from("lead_offers").insert({
    lead_id: leadId,
    consultation_id: text(formData, "consultation_id", 40),
    version,
    selected_package: packageKey,
    monthly_price_cents: money(formData, "monthly_price", pkg.monthlyPriceCents),
    founding_customer_eligible: founding,
    price_lock_months: founding ? 12 : null,
    price_lock_statement: founding ? "Çmimi i paketës fiksohet për 12 muajt e parë." : null,
    property_service_area_summary: text(formData, "property_service_area_summary") || "Apartament në zonën e shërbimit Prishtinë ose Fushë Kosovë.",
    visit_frequency: text(formData, "visit_frequency", 300) || pkg.visits,
    included_services: text(formData, "included_services") || pkg.included,
    exclusions: text(formData, "exclusions") || STANDARD_EXCLUSIONS,
    normal_approval_limit_cents: money(formData, "normal_approval_limit", 10000),
    emergency_limit_cents: money(formData, "emergency_limit", 30000),
    proposed_start_date: text(formData, "proposed_start_date", 20),
    valid_until: text(formData, "valid_until", 20),
    consultation_summary: text(formData, "consultation_summary"),
    additional_agreed_items: text(formData, "additional_agreed_items"),
    created_by_user_id: userId,
  }).select("id, offer_number").single();
  if (error) throw new Error(error.message);
  const { error: leadUpdateError } = await supabase.from("leads").update({
    offer_drafted_at: new Date().toISOString(),
    current_offer_status: "draft",
    updated_at: new Date().toISOString(),
  }).eq("id", leadId);
  if (leadUpdateError) throw new Error(leadUpdateError.message);
  await event(supabase, leadId, "offer_created", `Offer ${data.offer_number} drafted`, userId, { offer_id: data.id, version });
  refresh(leadId);
}

export async function transitionOfferAction(offerId: string, formData: FormData) {
  const { supabase, userId } = await context();
  const target = text(formData, "target_status", 20) as OfferStatus;
  const { data: offer, error } = await supabase.from("lead_offers").select("*").eq("id", offerId).single();
  if (error || !offer) throw new Error("Offer not found.");
  assertOfferTransition(offer.status as OfferStatus, target);
  const now = new Date().toISOString();
  const update: Record<string, unknown> = { status: target, updated_at: now };
  if (target === "sent") {
    assertOfferCanBeSent({ validUntil: offer.valid_until });
    update.sent_at = now;
    update.follow_up_date = text(formData, "follow_up_date", 20);
  } else if (target === "accepted") {
    const evidence = text(formData, "acceptance_evidence_note");
    if (!evidence) throw new Error("Acceptance evidence note is required.");
    update.accepted_at = now;
    update.acceptance_evidence_note = evidence;
  } else if (target === "rejected") {
    const reason = text(formData, "rejection_reason");
    if (!reason) throw new Error("Rejection reason is required.");
    update.rejected_at = now;
    update.rejection_reason = reason;
  } else if (target === "expired") {
    update.expired_at = now;
  } else if (target === "superseded") {
    update.superseded_at = now;
  }
  const { error: updateError } = await supabase.from("lead_offers").update(update).eq("id", offerId).eq("status", offer.status);
  if (updateError) throw new Error(updateError.message);
  const leadUpdate: Record<string, unknown> = { updated_at: now, current_offer_status: target };
  if (target === "sent") {
    leadUpdate.offer_sent_at = now;
    leadUpdate.offer_follow_up_date = update.follow_up_date;
  } else if (target === "accepted") leadUpdate.offer_accepted_at = now;
  else if (target === "rejected") {
    leadUpdate.offer_rejected_at = now;
    leadUpdate.offer_rejection_reason = update.rejection_reason;
  }
  const { error: leadError } = await supabase.from("leads").update(leadUpdate).eq("id", offer.lead_id);
  if (leadError) throw new Error(leadError.message);
  await event(supabase, offer.lead_id, `offer_${target}`, `Offer ${offer.offer_number} ${target}`, userId, { offer_id: offerId });
  refresh(offer.lead_id);
}

import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { generateOfferPdf, type OfferPdfData } from "@/lib/funnel/offer-pdf";
import { type TermMonths, VALID_TERMS } from "@/lib/funnel/definitions";

type DbOffer = {
  id: string;
  offer_number: string;
  version: number;
  selected_package: string;
  selected_term_months: number | null;
  monthly_price_cents: number;
  founding_customer_eligible: boolean;
  price_lock_statement: string | null;
  property_service_area_summary: string;
  visit_frequency: string;
  included_services: string;
  exclusions: string;
  normal_approval_limit_cents: number;
  emergency_limit_cents: number;
  proposed_start_date: string | null;
  valid_until: string | null;
  consultation_summary: string | null;
  additional_agreed_items: string | null;
  lead: { full_name: string | null; email: string | null; phone: string | null } | { full_name: string | null; email: string | null; phone: string | null }[];
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireRole(["admin", "office"]);
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lead_offers")
    .select("*,lead:leads!lead_offers_lead_id_fkey(full_name,email,phone)")
    .eq("id", id)
    .single();
  if (error || !data) return new NextResponse("Offer not found", { status: 404 });
  const db = data as unknown as DbOffer;
  const lead = Array.isArray(db.lead) ? db.lead[0] : db.lead;
  const termMonths: TermMonths = (db.selected_term_months && VALID_TERMS.includes(db.selected_term_months as TermMonths))
    ? db.selected_term_months as TermMonths
    : 12;
  const offer: OfferPdfData = {
    offer_number: db.offer_number,
    version: db.version,
    selected_package: db.selected_package as OfferPdfData["selected_package"],
    selected_term_months: termMonths,
    term_total_cents: db.monthly_price_cents,
    founding_customer_eligible: db.founding_customer_eligible,
    price_lock_statement: db.price_lock_statement,
    property_service_area_summary: db.property_service_area_summary,
    visit_frequency: db.visit_frequency,
    included_services: db.included_services,
    exclusions: db.exclusions,
    normal_approval_limit_cents: db.normal_approval_limit_cents,
    emergency_limit_cents: db.emergency_limit_cents,
    proposed_start_date: db.proposed_start_date,
    valid_until: db.valid_until,
    consultation_summary: db.consultation_summary,
    additional_agreed_items: db.additional_agreed_items,
    lead: { full_name: lead?.full_name ?? null, email: lead?.email ?? null, phone: lead?.phone ?? null },
  };
  const result = await generateOfferPdf(offer);
  return new NextResponse(Buffer.from(result.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${result.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { normalizeAttribution } from "@/lib/funnel/attribution";
import { FOUNDING_PACKAGES, getCommercialStage, safeCost } from "@/lib/funnel/definitions";
import { firstPaymentForClient } from "@/lib/funnel/paying-customer";
import { campaignCosts, countFunnel, type FunnelLead } from "@/lib/funnel/reporting";
import { assertOfferCanBeSent, assertOfferTransition } from "@/lib/funnel/transitions";
import { generateOfferPdf } from "@/lib/funnel/offer-pdf";

test("normalizes and bounds first-touch attribution", () => {
  expect(normalizeAttribution({
    source_detail: "  Facebook   DM ",
    campaign_name: "strehe_meta_diaspora_founders_202608",
    utm_source: " META ",
    utm_medium: "paid_social",
    utm_campaign: " founders ",
    utm_content: "video_a",
    utm_term: "",
    click_id: "abc-123",
    landing_locale: "sq",
    landing_page: "/sq/contact?utm_source=meta",
  })).toMatchObject({ source_detail: "Facebook DM", utm_source: "META", utm_term: null });
  expect(() => normalizeAttribution({
    source_detail: "<script>",
    campaign_name: "",
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    utm_content: "",
    utm_term: "",
    click_id: "",
    landing_locale: "sq",
    landing_page: "",
  })).toThrow();
});

test("commercial stage requires payment evidence for paying customer", () => {
  expect(getCommercialStage({ created_at: "2026-01-01", converted_client_id: "c1" })).toBe("customer_converted");
  expect(getCommercialStage({ created_at: "2026-01-01", converted_client_id: "c1", first_payment_at: "2026-02-01" })).toBe("paying_customer");
  expect(firstPaymentForClient("c1", [
    { amount_cents: 0, payment_date: "2026-01-01", invoice: { client_id: "c1" } },
    { amount_cents: 7500, payment_date: "2026-02-01", invoice: { client_id: "c1" } },
  ])).toBe("2026-02-01");
});

test("offer lifecycle rejects invalid transitions and missing validity", () => {
  expect(() => assertOfferTransition("draft", "accepted")).toThrow();
  expect(() => assertOfferTransition("sent", "accepted")).not.toThrow();
  expect(() => assertOfferCanBeSent({ validUntil: null })).toThrow();
  expect(() => assertOfferCanBeSent({ validUntil: "2030-01-01", sentAt: new Date("2026-01-01") })).not.toThrow();
});

test("campaign funnel metrics handle zero denominators and payment-backed CAC", () => {
  const lead: FunnelLead = {
    id: "l1", created_at: "2026-01-01", source: "website", source_detail: "landing",
    campaign_id: "campaign", campaign_name: "strehe_meta_diaspora_founders_202608",
    recommended_package: "essential_check", qualified_at: "2026-01-02",
    consultation_scheduled_at: "2026-01-03", consultation_completed_at: "2026-01-04",
    offer_sent_at: "2026-01-05", offer_accepted_at: "2026-01-06", converted_client_id: "c1",
  };
  const counts = countFunnel([lead], new Set(["c1"]));
  expect(counts.payingCustomers).toBe(1);
  expect(campaignCosts(10000, counts).customerAcquisitionCost).toBe(10000);
  expect(safeCost(10000, 0)).toBeNull();
});

test("generates an Albanian proposal PDF with proposal boundaries", async () => {
  const pkg = FOUNDING_PACKAGES.essential_check;
  const result = await generateOfferPdf({
    offer_number: "STH-OFR-2026-0001", version: 1, selected_package: "essential_check",
    monthly_price_cents: pkg.monthlyPriceCents, founding_customer_eligible: true,
    price_lock_statement: "Çmimi fiksohet për 12 muaj.", property_service_area_summary: "Apartament në Prishtinë",
    visit_frequency: pkg.visits, included_services: pkg.included, exclusions: "Kontraktorët dhe materialet veç.",
    normal_approval_limit_cents: 10000, emergency_limit_cents: 30000,
    proposed_start_date: "2026-08-15", valid_until: "2026-08-10",
    consultation_summary: "Nevojat u konfirmuan.", additional_agreed_items: null,
    lead: { full_name: "Ada Example", email: "ada@example.com", phone: null },
  });
  expect(result.bytes.byteLength).toBeGreaterThan(1000);
  expect(result.filename).toContain("_sq.pdf");
});

test("migration keeps consultations and offers internal under RLS", () => {
  const sql = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20260728120000_add_founding_customer_funnel.sql"), "utf8");
  expect(sql).toContain("alter table public.lead_consultations enable row level security");
  expect(sql).toContain("alter table public.lead_offers enable row level security");
  expect(sql).not.toContain("to anon");
  expect(sql).toContain("protect_lead_first_touch");
});


export const FOUNDING_PACKAGES = {
  essential_check: {
    label: "Essential Check",
    monthlyPriceCents: 7500,
    visits: "Një vizitë e planifikuar në muaj",
    included:
      "Kontroll bazë i gjendjes së dukshme; kontroll bazë i qasjes dhe gatishmërisë; përditësim i shkurtër; fotografi kur janë të dobishme; raportim i çështjeve të dukshme.",
  },
  care_plus: {
    label: "Care Plus",
    monthlyPriceCents: 11000,
    visits: "Dy vizita të planifikuara në muaj",
    included:
      "Kontrolle të gjendjes së dukshme dhe gatishmërisë; përditësim pas çdo vizite; fotografi kur janë të dobishme; sinjalizim çështjesh; ndjekje lokale e kufizuar; vetëdije bazë për ardhjen dhe gatishmërinë.",
  },
  arrival_ready: {
    label: "Arrival Ready",
    monthlyPriceCents: 16000,
    visits: "Dy vizita të planifikuara në muaj",
    included:
      "Mbështetje për përgatitje para ardhjes; kontroll gatishmërie para kthimit; ajrosje dhe përgatitje e lehtë kur është e përshtatshme; raportim çështjesh; koordinim i kufizuar i detyrave të vogla të gatishmërisë.",
  },
} as const;

export type FoundingPackageKey = keyof typeof FOUNDING_PACKAGES;

export const STANDARD_EXCLUSIONS =
  "Tarifat e kontraktorëve; pjesët ose materialet zëvendësuese; pastrimi i thellë pa marrëveshje të veçantë; riparimet e mëdha; porositë e pakufizuara; koordinimi i pakufizuar i kontraktorëve; menaxhimi i qirasë; përgjigjja emergjente 24/7 e garantuar.";

export type FunnelEvidence = {
  created_at: string;
  qualified_at?: string | null;
  consultation_scheduled_at?: string | null;
  consultation_status?: string | null;
  consultation_completed_at?: string | null;
  offer_drafted_at?: string | null;
  current_offer_status?: string | null;
  offer_sent_at?: string | null;
  offer_accepted_at?: string | null;
  converted_client_id?: string | null;
  first_payment_at?: string | null;
};

export function getCommercialStage(lead: FunnelEvidence) {
  if (lead.first_payment_at) return "paying_customer";
  if (lead.converted_client_id) return "customer_converted";
  if (lead.current_offer_status === "rejected") return "offer_rejected";
  if (lead.current_offer_status === "expired") return "offer_expired";
  if (lead.current_offer_status === "superseded") return "offer_superseded";
  if (lead.offer_accepted_at) return "offer_accepted";
  if (lead.offer_sent_at) return "offer_sent";
  if (lead.offer_drafted_at) return "offer_drafted";
  if (lead.consultation_completed_at) return "consultation_completed";
  if (lead.consultation_status === "cancelled") return "consultation_cancelled";
  if (lead.consultation_status === "no_show") return "consultation_no_show";
  if (lead.consultation_scheduled_at) return "consultation_booked";
  if (lead.qualified_at) return "qualified";
  return "inquiry";
}

export function safeCost(spendCents: number, count: number) {
  return count > 0 ? Math.round(spendCents / count) : null;
}

export function assertFoundingCapacity(activeOfferCount: number) {
  if (activeOfferCount >= 3) {
    throw new Error("All three founding-customer places are already reserved by active offers.");
  }
}

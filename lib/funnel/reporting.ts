import { safeCost } from "./definitions";

export type FunnelLead = {
  id: string;
  created_at: string;
  source: string | null;
  source_detail: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  recommended_package: string | null;
  qualified_at: string | null;
  consultation_scheduled_at: string | null;
  consultation_completed_at: string | null;
  offer_sent_at: string | null;
  offer_accepted_at: string | null;
  converted_client_id: string | null;
};

export type FunnelCounts = {
  inquiries: number;
  qualified: number;
  consultationsBooked: number;
  consultationsCompleted: number;
  offersSent: number;
  offersAccepted: number;
  payingCustomers: number;
};

export function countFunnel(leads: FunnelLead[], payingClientIds: Set<string>): FunnelCounts {
  return {
    inquiries: leads.length,
    qualified: leads.filter((lead) => lead.qualified_at).length,
    consultationsBooked: leads.filter((lead) => lead.consultation_scheduled_at).length,
    consultationsCompleted: leads.filter((lead) => lead.consultation_completed_at).length,
    offersSent: leads.filter((lead) => lead.offer_sent_at).length,
    offersAccepted: leads.filter((lead) => lead.offer_accepted_at).length,
    payingCustomers: leads.filter((lead) => lead.converted_client_id && payingClientIds.has(lead.converted_client_id)).length,
  };
}

export function groupFunnel(
  leads: FunnelLead[],
  key: (lead: FunnelLead) => string,
  payingClientIds: Set<string>
) {
  const groups = new Map<string, FunnelLead[]>();
  for (const lead of leads) {
    const value = key(lead) || "unknown";
    groups.set(value, [...(groups.get(value) || []), lead]);
  }
  return [...groups.entries()].map(([label, rows]) => ({ label, counts: countFunnel(rows, payingClientIds) }));
}

export function campaignCosts(spendCents: number, counts: FunnelCounts) {
  return {
    costPerInquiry: safeCost(spendCents, counts.inquiries),
    costPerQualifiedLead: safeCost(spendCents, counts.qualified),
    costPerCompletedConsultation: safeCost(spendCents, counts.consultationsCompleted),
    costPerAcceptedOffer: safeCost(spendCents, counts.offersAccepted),
    customerAcquisitionCost: safeCost(spendCents, counts.payingCustomers),
  };
}

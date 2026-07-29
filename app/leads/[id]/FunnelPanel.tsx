import Link from "next/link";
import { Badge, Button, Input, Label, SectionCard, Textarea } from "@/components/ui";
import { createOfferAction, qualifyLeadAction, saveConsultationAction, transitionOfferAction } from "@/lib/actions/funnel";
import { FOUNDING_PACKAGES, getCommercialStage } from "@/lib/funnel/definitions";

type Consultation = {
  id: string;
  status: string;
  scheduled_start: string;
  contact_format: string;
  recommended_package: string | null;
  completed_at: string | null;
  created_at: string;
};

type Offer = {
  id: string;
  offer_number: string;
  version: number;
  status: string;
  selected_package: string;
  monthly_price_cents: number;
  valid_until: string | null;
  sent_at: string | null;
  follow_up_date: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
};

type LeadFunnelData = {
  id: string;
  created_at: string;
  city: string | null;
  property_count: number | null;
  preferred_contact_method: string | null;
  qualification_outcome: string | null;
  qualification_notes: string | null;
  qualified_at: string | null;
  consultation_scheduled_at: string | null;
  consultation_status: string | null;
  consultation_completed_at: string | null;
  offer_drafted_at: string | null;
  current_offer_status: string | null;
  offer_sent_at: string | null;
  offer_accepted_at: string | null;
  converted_client_id: string | null;
};

export function FunnelPanel({
  lead,
  consultations,
  offers,
  firstPaymentAt,
}: {
  lead: LeadFunnelData;
  consultations: Consultation[];
  offers: Offer[];
  firstPaymentAt: string | null;
}) {
  const qualify = qualifyLeadAction.bind(null, lead.id);
  const saveConsultation = saveConsultationAction.bind(null, lead.id);
  const createOffer = createOfferAction.bind(null, lead.id);
  const stage = getCommercialStage({
    created_at: lead.created_at,
    qualified_at: lead.qualified_at,
    consultation_scheduled_at: lead.consultation_scheduled_at,
    consultation_status: lead.consultation_status,
    consultation_completed_at: lead.consultation_completed_at,
    offer_drafted_at: lead.offer_drafted_at,
    current_offer_status: lead.current_offer_status,
    offer_sent_at: lead.offer_sent_at,
    offer_accepted_at: lead.offer_accepted_at,
    converted_client_id: lead.converted_client_id,
    first_payment_at: firstPaymentAt,
  });
  const latestConsultation = consultations[0];

  return (
    <div className="space-y-6">
      <SectionCard title="Commercial Funnel">
        <div className="flex flex-wrap items-center gap-2">
          {["inquiry", "qualified", "consultation_booked", "consultation_completed", "offer_drafted", "offer_sent", "offer_accepted", "customer_converted", "paying_customer"].map((item) => (
            <Badge key={item} variant={item === stage ? "success" : "neutral"}>
              {item.replaceAll("_", " ")}
            </Badge>
          ))}
        </div>
        <div className="mt-4 grid gap-2 text-sm md:grid-cols-4">
          <span>Qualified: {lead.qualified_at ? new Date(lead.qualified_at).toLocaleString("en-GB") : "—"}</span>
          <span>Consultation complete: {lead.consultation_completed_at ? new Date(lead.consultation_completed_at).toLocaleString("en-GB") : "—"}</span>
          <span>Offer accepted: {lead.offer_accepted_at ? new Date(lead.offer_accepted_at).toLocaleString("en-GB") : "—"}</span>
          <span>First payment: {firstPaymentAt || "No recorded payment"}</span>
          <span>Current offer: {lead.current_offer_status || "—"}</span>
        </div>
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Qualification">
          <form action={qualify} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="qualification_outcome">Outcome</Label>
              <select id="qualification_outcome" name="qualification_outcome" required defaultValue={lead.qualification_outcome || ""} className="flex h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">Choose</option>
                <option value="qualified">Qualified</option>
                <option value="disqualified">Disqualified</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="qualification_notes">Eligibility and notes</Label>
              <Textarea id="qualification_notes" name="qualification_notes" maxLength={2000} defaultValue={lead.qualification_notes || ""} required />
            </div>
            <Button type="submit">Save qualification</Button>
          </form>
        </SectionCard>

        <SectionCard title="Consultation Checklist">
          <form action={saveConsultation} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="scheduled_start">Scheduled start</Label><Input id="scheduled_start" name="scheduled_start" type="datetime-local" required /></div>
            <div className="space-y-2"><Label htmlFor="contact_format">Format</Label><select id="contact_format" name="contact_format" className="flex h-10 w-full rounded-md border bg-background px-3 text-sm" required><option value="whatsapp_voice">WhatsApp voice</option><option value="whatsapp_video">WhatsApp video</option></select></div>
            <div className="space-y-2"><Label htmlFor="consultation_status">Status</Label><select id="consultation_status" name="status" className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="booked">Booked</option><option value="requested">Requested</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="no_show">No-show</option></select></div>
            <div className="space-y-2"><Label htmlFor="property_location">Property location</Label><Input id="property_location" name="property_location" defaultValue={lead.city || ""} required /></div>
            <div className="space-y-2"><Label htmlFor="property_count">Apartment count</Label><Input id="property_count" name="property_count" type="number" min="1" defaultValue={lead.property_count || 1} /></div>
            <div className="space-y-2"><Label htmlFor="occupancy_condition">Occupancy/current condition</Label><Input id="occupancy_condition" name="occupancy_condition" /></div>
            <div className="space-y-2"><Label htmlFor="access_key_situation">Access/key situation</Label><Input id="access_key_situation" name="access_key_situation" /></div>
            <div className="space-y-2"><Label htmlFor="desired_visit_frequency">Desired visit frequency</Label><Input id="desired_visit_frequency" name="desired_visit_frequency" /></div>
            <div className="space-y-2 md:col-span-2"><Label htmlFor="primary_concerns">Primary concerns</Label><Textarea id="primary_concerns" name="primary_concerns" /></div>
            <div className="space-y-2"><Label htmlFor="arrival_readiness_needs">Arrival-readiness needs</Label><Textarea id="arrival_readiness_needs" name="arrival_readiness_needs" /></div>
            <div className="space-y-2"><Label htmlFor="known_maintenance_issues">Known maintenance issues</Label><Textarea id="known_maintenance_issues" name="known_maintenance_issues" /></div>
            <div className="space-y-2"><Label htmlFor="communication_preference">Communication preference</Label><Input id="communication_preference" name="communication_preference" defaultValue={lead.preferred_contact_method || "whatsapp"} /></div>
            <div className="space-y-2"><Label htmlFor="recommended_package">Recommended package</Label><select id="recommended_package" name="recommended_package" className="flex h-10 w-full rounded-md border bg-background px-3 text-sm">{Object.entries(FOUNDING_PACKAGES).map(([key, pkg]) => <option key={key} value={key}>{pkg.label}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="normal_approval_limit">Normal approval limit (€)</Label><Input id="normal_approval_limit" name="normal_approval_limit" type="number" min="0" defaultValue="100" /></div>
            <div className="space-y-2"><Label htmlFor="emergency_limit">Emergency limit (€)</Label><Input id="emergency_limit" name="emergency_limit" type="number" min="0" defaultValue="300" /></div>
            <div className="space-y-2"><Label htmlFor="outcome">Outcome</Label><Textarea id="outcome" name="outcome" /></div>
            <div className="space-y-2"><Label htmlFor="next_action">Next action</Label><Textarea id="next_action" name="next_action" /></div>
            <div className="space-y-2"><Label htmlFor="consultation_follow_up_date">Follow-up date</Label><Input id="consultation_follow_up_date" name="follow_up_date" type="date" /></div>
            <div className="flex items-end"><Button type="submit" disabled={!lead.qualified_at}>Save consultation</Button></div>
          </form>
          {consultations.length ? <p className="mt-4 text-xs text-muted-foreground">{consultations.length} consultation record(s); latest: {latestConsultation.status}.</p> : null}
        </SectionCard>
      </div>

      <SectionCard title="Written Offers">
        <form action={createOffer} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <input type="hidden" name="consultation_id" value={latestConsultation?.id || ""} />
          <div className="space-y-2"><Label htmlFor="selected_package">Package</Label><select id="selected_package" name="selected_package" className="flex h-10 w-full rounded-md border bg-background px-3 text-sm">{Object.entries(FOUNDING_PACKAGES).map(([key, pkg]) => <option key={key} value={key}>{pkg.label} — €{(pkg.monthlyPriceCents / 100).toFixed(0)}</option>)}</select></div>
          <div className="space-y-2"><Label htmlFor="monthly_price">Monthly price (€)</Label><Input id="monthly_price" name="monthly_price" type="number" min="1" step="0.01" placeholder="Defaults to package price" /></div>
          <div className="space-y-2"><Label htmlFor="founding_customer_eligible">Founding customer</Label><select id="founding_customer_eligible" name="founding_customer_eligible" className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="no">No</option><option value="yes">Yes — 12-month price lock</option></select></div>
          <div className="space-y-2"><Label htmlFor="property_service_area_summary">Property/service area</Label><Input id="property_service_area_summary" name="property_service_area_summary" defaultValue={`Apartment — ${lead.city || "location to confirm"}`} required /></div>
          <div className="space-y-2"><Label htmlFor="normal_offer_limit">Normal approval limit (€)</Label><Input id="normal_offer_limit" name="normal_approval_limit" type="number" min="0" defaultValue="100" /></div>
          <div className="space-y-2"><Label htmlFor="emergency_offer_limit">Emergency limit (€)</Label><Input id="emergency_offer_limit" name="emergency_limit" type="number" min="0" defaultValue="300" /></div>
          <div className="space-y-2"><Label htmlFor="proposed_start_date">Proposed start</Label><Input id="proposed_start_date" name="proposed_start_date" type="date" /></div>
          <div className="space-y-2"><Label htmlFor="valid_until">Valid until (required to send)</Label><Input id="valid_until" name="valid_until" type="date" /></div>
          <div className="space-y-2"><Label htmlFor="consultation_summary">Consultation summary</Label><Textarea id="consultation_summary" name="consultation_summary" /></div>
          <div className="space-y-2"><Label htmlFor="additional_agreed_items">Additional agreed items</Label><Textarea id="additional_agreed_items" name="additional_agreed_items" /></div>
          <div className="flex items-end"><Button type="submit" disabled={!lead.consultation_completed_at}>Create Albanian offer</Button></div>
        </form>

        <div className="mt-6 grid gap-3">
          {offers.map((offer) => {
            const transition = transitionOfferAction.bind(null, offer.id);
            return (
              <div key={offer.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><span className="font-medium">{offer.offer_number}</span> <span className="text-sm text-muted-foreground">v{offer.version} · {offer.selected_package} · €{(offer.monthly_price_cents / 100).toFixed(2)}</span></div>
                  <Badge variant={offer.status === "accepted" ? "success" : "neutral"}>{offer.status}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm"><Link href={`/leads/offers/${offer.id}/pdf`}>Albanian PDF</Link></Button>
                  {offer.status === "draft" ? <form action={transition} className="flex gap-2"><input type="hidden" name="target_status" value="sent" /><Input name="follow_up_date" type="date" required /><Button size="sm" type="submit">Mark sent</Button></form> : null}
                  {offer.status === "sent" ? (
                    <>
                      <form action={transition} className="flex gap-2"><input type="hidden" name="target_status" value="accepted" /><Input name="acceptance_evidence_note" placeholder="Acceptance evidence" required /><Button size="sm" type="submit">Accept</Button></form>
                      <form action={transition} className="flex gap-2"><input type="hidden" name="target_status" value="rejected" /><Input name="rejection_reason" placeholder="Rejection reason" required /><Button size="sm" variant="outline" type="submit">Reject</Button></form>
                      <form action={transition}><input type="hidden" name="target_status" value="expired" /><Button size="sm" variant="outline" type="submit">Expire</Button></form>
                    </>
                  ) : null}
                  {offer.status === "draft" || offer.status === "sent" ? <form action={transition}><input type="hidden" name="target_status" value="superseded" /><Button size="sm" variant="ghost" type="submit">Supersede</Button></form> : null}
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}

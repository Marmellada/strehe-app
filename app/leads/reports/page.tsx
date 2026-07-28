import Link from "next/link";
import { Button, PageHeader, SectionCard, StatCard } from "@/components/ui";
import { requireRole } from "@/lib/auth/require-role";
import { campaignCosts, countFunnel, groupFunnel, type FunnelLead } from "@/lib/funnel/reporting";
import { createClient } from "@/lib/supabase/server";

function euros(cents: number | null) {
  return cents === null ? "—" : `€${(cents / 100).toFixed(2)}`;
}

function Breakdown({ title, rows }: { title: string; rows: ReturnType<typeof groupFunnel> }) {
  return (
    <SectionCard title={title}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead><tr className="border-b text-left text-muted-foreground"><th className="p-2">Group</th><th>Inquiries</th><th>Qualified</th><th>Consultations</th><th>Offers sent</th><th>Accepted</th><th>Paying</th></tr></thead>
          <tbody>{rows.map(({ label, counts }) => <tr key={label} className="border-b"><td className="p-2 font-medium">{label}</td><td>{counts.inquiries}</td><td>{counts.qualified}</td><td>{counts.consultationsCompleted}</td><td>{counts.offersSent}</td><td>{counts.offersAccepted}</td><td>{counts.payingCustomers}</td></tr>)}</tbody>
        </table>
      </div>
    </SectionCard>
  );
}

export default async function LeadReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireRole(["admin", "office"]);
  const { from, to } = await searchParams;
  const supabase = await createClient();
  let leadQuery = supabase.from("leads").select("id,created_at,source,source_detail,campaign_id,campaign_name,recommended_package,qualified_at,consultation_scheduled_at,consultation_completed_at,offer_sent_at,offer_accepted_at,converted_client_id");
  if (from) leadQuery = leadQuery.gte("created_at", `${from}T00:00:00Z`);
  if (to) leadQuery = leadQuery.lte("created_at", `${to}T23:59:59Z`);
  const [{ data: leadData, error: leadError }, { data: paymentData }, { data: campaignData }] = await Promise.all([
    leadQuery,
    supabase.from("payments").select("amount_cents,invoice:invoices!payments_invoice_id_fkey(client_id)").gt("amount_cents", 0),
    supabase.from("promotion_campaigns").select("id,name,actual_spend_cents"),
  ]);
  if (leadError) throw new Error(leadError.message);
  const leads = (leadData || []) as FunnelLead[];
  const payingClientIds = new Set<string>();
  for (const payment of paymentData || []) {
    const invoice = Array.isArray(payment.invoice) ? payment.invoice[0] : payment.invoice;
    if (invoice?.client_id) payingClientIds.add(invoice.client_id);
  }
  const total = countFunnel(leads, payingClientIds);
  const campaigns = new Map((campaignData || []).map((campaign) => [campaign.id, campaign]));

  return (
    <div className="space-y-6">
      <PageHeader title="Founding Customer Funnel" description="Milestone evidence and recorded-payment conversion reporting." actions={<Button asChild variant="outline"><Link href="/leads">Back to leads</Link></Button>} />
      <form className="flex flex-wrap items-end gap-3 rounded-xl border p-4">
        <label className="grid gap-1 text-sm">From<input className="h-10 rounded-md border bg-background px-3" name="from" type="date" defaultValue={from} /></label>
        <label className="grid gap-1 text-sm">To<input className="h-10 rounded-md border bg-background px-3" name="to" type="date" defaultValue={to} /></label>
        <Button type="submit">Apply period</Button>
      </form>
      <div className="grid gap-4 md:grid-cols-4 xl:grid-cols-7">
        <StatCard title="Inquiries" value={total.inquiries} />
        <StatCard title="Qualified" value={total.qualified} />
        <StatCard title="Consultations booked" value={total.consultationsBooked} />
        <StatCard title="Consultations completed" value={total.consultationsCompleted} />
        <StatCard title="Offers sent" value={total.offersSent} />
        <StatCard title="Offers accepted" value={total.offersAccepted} />
        <StatCard title="Paying customers" value={total.payingCustomers} />
      </div>
      <Breakdown title="By source" rows={groupFunnel(leads, (lead) => lead.source || "unknown", payingClientIds)} />
      <Breakdown title="By source detail" rows={groupFunnel(leads, (lead) => lead.source_detail || "unknown", payingClientIds)} />
      <Breakdown title="By campaign" rows={groupFunnel(leads, (lead) => lead.campaign_name || "unknown", payingClientIds)} />
      <Breakdown title="By package" rows={groupFunnel(leads, (lead) => lead.recommended_package || "unknown", payingClientIds)} />
      <SectionCard title="Campaign acquisition costs">
        <div className="grid gap-3">
          {(campaignData || []).map((campaign) => {
            const rows = leads.filter((lead) => lead.campaign_id === campaign.id || (!lead.campaign_id && lead.campaign_name === campaign.name));
            const counts = countFunnel(rows, payingClientIds);
            const spend = campaign.actual_spend_cents || 0;
            const costs = campaignCosts(spend, counts);
            return <div key={campaign.id} className="rounded-xl border p-4"><div className="font-medium">{campaign.name} · spend {euros(spend)}</div><div className="mt-2 grid gap-2 text-sm md:grid-cols-5"><span>CPI {euros(costs.costPerInquiry)}</span><span>CPQL {euros(costs.costPerQualifiedLead)}</span><span>CP consultation {euros(costs.costPerCompletedConsultation)}</span><span>CP accepted {euros(costs.costPerAcceptedOffer)}</span><span>CAC {euros(costs.customerAcquisitionCost)}</span></div></div>;
          })}
          {!campaigns.size ? <p className="text-sm text-muted-foreground">No campaigns with spend records.</p> : null}
        </div>
      </SectionCard>
    </div>
  );
}

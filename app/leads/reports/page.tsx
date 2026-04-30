import Link from "next/link";
import { Badge, Button, PageHeader, SectionCard, StatCard } from "@/components/ui";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { formatStatusLabel, getStatusVariant } from "@/lib/ui/status";

type LeadSummary = {
  source: string | null;
  status: string | null;
  estimated_monthly_value_cents: number | null;
};

function formatMoney(value: number) {
  return `€${(value / 100).toFixed(2)}`;
}

export default async function LeadReportsPage() {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select("source, status, estimated_monthly_value_cents");

  const rows = (data || []) as LeadSummary[];
  const totalValue = rows.reduce(
    (sum, lead) => sum + (lead.estimated_monthly_value_cents || 0),
    0
  );
  const won = rows.filter((lead) => lead.status === "won").length;
  const sourceGroups = rows.reduce<Record<string, LeadSummary[]>>((groups, lead) => {
    const source = lead.source || "unknown";
    groups[source] = groups[source] || [];
    groups[source].push(lead);
    return groups;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lead Reports"
        description="Simple source, conversion, and open value reporting."
        actions={
          <Button asChild variant="outline">
            <Link href="/leads">Back to Leads</Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Total Leads" value={rows.length} />
        <StatCard title="Won Leads" value={won} />
        <StatCard title="Estimated Value" value={formatMoney(totalValue)} />
      </div>

      <SectionCard title="By Source">
        <div className="grid gap-3">
          {Object.entries(sourceGroups).map(([source, leads]) => {
            const sourceWon = leads.filter((lead) => lead.status === "won").length;
            const sourceValue = leads.reduce(
              (sum, lead) => sum + (lead.estimated_monthly_value_cents || 0),
              0
            );

            return (
              <div key={source} className="grid gap-3 rounded-xl border p-4 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
                <div className="font-medium text-foreground">{formatStatusLabel(source)}</div>
                <div className="text-sm text-muted-foreground">{leads.length} leads</div>
                <Badge variant={sourceWon > 0 ? "success" : "neutral"}>
                  {sourceWon} won
                </Badge>
                <div className="text-sm font-medium">{formatMoney(sourceValue)}</div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="By Status">
        <div className="grid gap-3 md:grid-cols-5">
          {["new", "contacted", "interested", "won", "lost"].map((status) => (
            <div key={status} className="rounded-xl border p-4">
              <Badge variant={getStatusVariant(status)}>{formatStatusLabel(status)}</Badge>
              <div className="mt-3 text-2xl font-semibold">
                {rows.filter((lead) => lead.status === status).length}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

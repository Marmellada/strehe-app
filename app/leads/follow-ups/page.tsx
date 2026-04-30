import Link from "next/link";
import { Badge, Button, EmptyState, PageHeader, SectionCard } from "@/components/ui";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { formatStatusLabel, getStatusVariant } from "@/lib/ui/status";

type LeadRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  status: string | null;
  priority: string | null;
  source: string | null;
  next_follow_up_date: string | null;
};

function formatDate(date: string | null) {
  if (!date) return "No follow-up";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

function FollowUpList({ title, rows }: { title: string; rows: LeadRow[] }) {
  return (
    <SectionCard title={title}>
      {rows.length === 0 ? (
        <EmptyState title="Nothing here" description="No leads match this follow-up group." />
      ) : (
        <div className="grid gap-3">
          {rows.map((lead) => (
            <div key={lead.id} className="flex items-center justify-between gap-4 rounded-xl border p-4">
              <div>
                <div className="font-medium text-foreground">
                  {lead.full_name || "Unnamed lead"}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {formatDate(lead.next_follow_up_date)} • {lead.phone || lead.email || "No contact"} • {formatStatusLabel(lead.source)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={getStatusVariant(lead.status)}>
                  {formatStatusLabel(lead.status)}
                </Badge>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/leads/${lead.id}`}>Open</Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

export default async function LeadFollowUpsPage() {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();
  const todayDate = new Date();
  const weekDate = new Date(todayDate);
  weekDate.setDate(todayDate.getDate() + 7);
  const today = todayDate.toISOString().slice(0, 10);
  const week = weekDate.toISOString().slice(0, 10);

  const [{ data: overdue }, { data: todayRows }, { data: weekRows }, { data: noFollowUp }] =
    await Promise.all([
      supabase
        .from("leads")
        .select("id, full_name, phone, email, status, priority, source, next_follow_up_date")
        .lt("next_follow_up_date", today)
        .not("status", "in", "(won,lost)")
        .order("next_follow_up_date"),
      supabase
        .from("leads")
        .select("id, full_name, phone, email, status, priority, source, next_follow_up_date")
        .eq("next_follow_up_date", today)
        .not("status", "in", "(won,lost)")
        .order("priority", { ascending: false }),
      supabase
        .from("leads")
        .select("id, full_name, phone, email, status, priority, source, next_follow_up_date")
        .gt("next_follow_up_date", today)
        .lte("next_follow_up_date", week)
        .not("status", "in", "(won,lost)")
        .order("next_follow_up_date"),
      supabase
        .from("leads")
        .select("id, full_name, phone, email, status, priority, source, next_follow_up_date")
        .is("next_follow_up_date", null)
        .not("status", "in", "(won,lost)")
        .order("created_at", { ascending: false })
        .limit(25),
    ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lead Follow-ups"
        description="Overdue, today, this week, and unscheduled lead work."
        actions={
          <Button asChild variant="outline">
            <Link href="/leads">Back to Leads</Link>
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <FollowUpList title="Overdue" rows={(overdue || []) as LeadRow[]} />
        <FollowUpList title="Due Today" rows={(todayRows || []) as LeadRow[]} />
        <FollowUpList title="This Week" rows={(weekRows || []) as LeadRow[]} />
        <FollowUpList title="No Follow-up Set" rows={(noFollowUp || []) as LeadRow[]} />
      </div>
    </div>
  );
}

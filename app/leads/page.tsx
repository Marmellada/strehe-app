import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatCard } from "@/components/ui/StatCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
} from "@/components/ui/Table";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { formatStatusLabel, getStatusVariant } from "@/lib/ui/status";

type AssignedUser =
  | { full_name: string | null; email: string | null }
  | { full_name: string | null; email: string | null }[]
  | null;

type LeadRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  country: string | null;
  source: string | null;
  status: string | null;
  priority: string | null;
  next_follow_up_date: string | null;
  converted_client_id: string | null;
  assigned: AssignedUser;
};

function getSingleUser(value: AssignedUser) {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] || null;
  return value;
}

function isDue(date: string | null) {
  if (!date) return false;
  const today = new Date().toISOString().split("T")[0];
  return date <= today;
}

function formatDate(date: string | null) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

export default async function LeadsPage() {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();

  const [
    { data: leads },
    { count: total },
    { count: newCount },
    { count: contactedCount },
    { count: interestedCount },
  ] = await Promise.all([
    supabase
      .from("leads")
      .select(
        `
        id,
        full_name,
        phone,
        email,
        city,
        country,
        source,
        status,
        priority,
        next_follow_up_date,
        converted_client_id,
        assigned:app_users!leads_assigned_user_id_fkey(full_name, email)
      `
      )
      .order("created_at", { ascending: false }),
    supabase.from("leads").select("*", { count: "exact", head: true }),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "contacted"),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "interested"),
  ]);

  const rows = (leads || []) as LeadRow[];
  const dueCount = rows.filter((lead) => isDue(lead.next_follow_up_date)).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description="Track inquiries, follow-ups, and conversion before a client record exists."
        actions={
          <Button asChild>
            <Link href="/leads/new">New Lead</Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Total" value={total || 0} />
        <StatCard title="New" value={newCount || 0} />
        <StatCard title="Contacted" value={contactedCount || 0} />
        <StatCard title="Interested" value={interestedCount || 0} />
        <StatCard title="Due Follow-up" value={dueCount} />
      </div>

      <SectionCard title="Lead Pipeline">
        {rows.length === 0 ? (
          <EmptyState
            title="No leads"
            description="Create the first inquiry when someone contacts STREHE."
            action={
              <Button asChild>
                <Link href="/leads/new">Create Lead</Link>
              </Button>
            }
          />
        ) : (
          <TableShell className="rounded-none border-x-0 border-b-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Follow-up</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((lead) => {
                  const assigned = getSingleUser(lead.assigned);
                  const contact = [lead.phone, lead.email].filter(Boolean).join(" • ");
                  const location = [lead.city, lead.country].filter(Boolean).join(", ");

                  return (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">
                        <Link href={`/leads/${lead.id}`} className="hover:underline">
                          {lead.full_name || "Unnamed lead"}
                        </Link>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {contact || location || "No contact details"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(lead.status)}>
                          {formatStatusLabel(lead.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatStatusLabel(lead.source)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            isDue(lead.next_follow_up_date)
                              ? "font-medium text-[var(--badge-warning-text)]"
                              : "text-muted-foreground"
                          }
                        >
                          {formatDate(lead.next_follow_up_date)}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {assigned?.full_name || assigned?.email || "Unassigned"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/leads/${lead.id}`}>Open</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableShell>
        )}
      </SectionCard>
    </div>
  );
}

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
  service_interest: string | null;
  preferred_contact_method: string | null;
  status: string | null;
  priority: string | null;
  next_follow_up_date: string | null;
  estimated_monthly_value_cents: number | null;
  last_interaction_at: string | null;
  converted_client_id: string | null;
  assigned: AssignedUser;
};

type LeadsPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    source?: string;
  }>;
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

function formatMoneyFromCents(value: number | null | undefined) {
  return `€${((value || 0) / 100).toFixed(2)}`;
}

function buildLeadsHref(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });

  const query = search.toString();
  return query ? `/leads?${query}` : "/leads";
}

const statusFilters = ["new", "contacted", "interested", "won", "lost"];
const sourceFilters = ["manual", "whatsapp", "website", "referral", "facebook", "instagram", "phone"];

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();
  const params = (await searchParams) || {};
  const query = String(params.q || "").trim();
  const status = String(params.status || "").trim();
  const source = String(params.source || "").trim();

  let leadsQuery = supabase
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
      service_interest,
      preferred_contact_method,
      status,
      priority,
      next_follow_up_date,
      estimated_monthly_value_cents,
      last_interaction_at,
      converted_client_id,
      assigned:app_users!leads_assigned_user_id_fkey(full_name, email)
    `
    )
    .order("created_at", { ascending: false });

  if (status) {
    leadsQuery = leadsQuery.eq("status", status);
  }

  if (source) {
    leadsQuery = leadsQuery.eq("source", source);
  }

  if (query) {
    const escapedQuery = query.replace(/[%_]/g, "\\$&");
    leadsQuery = leadsQuery.or(
      `full_name.ilike.%${escapedQuery}%,phone.ilike.%${escapedQuery}%,email.ilike.%${escapedQuery}%,city.ilike.%${escapedQuery}%`
    );
  }

  const [
    { data: leads },
    { count: total },
    { count: newCount },
    { count: contactedCount },
    { count: interestedCount },
  ] = await Promise.all([
    leadsQuery,
    supabase.from("leads").select("*", { count: "exact", head: true }),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "contacted"),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "interested"),
  ]);

  const rows = (leads || []) as LeadRow[];
  const dueCount = rows.filter((lead) => isDue(lead.next_follow_up_date)).length;
  const openValue = rows
    .filter((lead) => !["won", "lost"].includes(lead.status || ""))
    .reduce((totalValue, lead) => totalValue + (lead.estimated_monthly_value_cents || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description="Track inquiries, follow-ups, and conversion before a client record exists."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/leads/new?source=whatsapp">New WhatsApp Lead</Link>
            </Button>
            <Button asChild>
              <Link href="/leads/new">New Lead</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard title="Total" value={total || 0} />
        <StatCard title="New" value={newCount || 0} />
        <StatCard title="Contacted" value={contactedCount || 0} />
        <StatCard title="Interested" value={interestedCount || 0} />
        <StatCard title="Due Follow-up" value={dueCount} />
        <StatCard title="Open Value" value={formatMoneyFromCents(openValue)} />
      </div>

      <SectionCard title="Filters">
        <form className="grid gap-3 md:grid-cols-[1fr_180px_180px_auto]">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground" htmlFor="q">
              Search
            </label>
            <input
              id="q"
              name="q"
              defaultValue={query}
              placeholder="Name, phone, email, city"
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-muted-foreground" htmlFor="status">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={status}
              className="h-10 w-full rounded-md border border-[var(--select-border)] bg-[var(--select-bg)] px-3 py-2 text-sm text-[var(--select-text)]"
            >
              <option value="">All</option>
              {statusFilters.map((filter) => (
                <option key={filter} value={filter}>
                  {formatStatusLabel(filter)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-muted-foreground" htmlFor="source">
              Source
            </label>
            <select
              id="source"
              name="source"
              defaultValue={source}
              className="h-10 w-full rounded-md border border-[var(--select-border)] bg-[var(--select-bg)] px-3 py-2 text-sm text-[var(--select-text)]"
            >
              <option value="">All</option>
              {sourceFilters.map((filter) => (
                <option key={filter} value={filter}>
                  {formatStatusLabel(filter)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <Button type="submit">Apply</Button>
            <Button asChild variant="outline">
              <Link href="/leads">Clear</Link>
            </Button>
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Pipeline Stages">
        <div className="grid gap-3 md:grid-cols-5">
          {statusFilters.map((filter) => {
            const stageRows = rows.filter((lead) => lead.status === filter);
            const stageValue = stageRows.reduce(
              (totalValue, lead) => totalValue + (lead.estimated_monthly_value_cents || 0),
              0
            );

            return (
              <Link
                key={filter}
                href={buildLeadsHref({ q: query, source, status: filter })}
                className="rounded-xl border p-4 hover:bg-muted/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={getStatusVariant(filter)}>
                    {formatStatusLabel(filter)}
                  </Badge>
                  <span className="text-sm font-medium">{stageRows.length}</span>
                </div>
                <div className="mt-3 text-sm text-muted-foreground">
                  {formatMoneyFromCents(stageValue)}
                </div>
              </Link>
            );
          })}
        </div>
      </SectionCard>

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
                  <TableHead>Interest</TableHead>
                  <TableHead>Value</TableHead>
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
                  const leadMeta = [
                    contact,
                    location,
                    lead.preferred_contact_method
                      ? `Prefers ${formatStatusLabel(lead.preferred_contact_method)}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" • ");

                  return (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">
                        <Link href={`/leads/${lead.id}`} className="hover:underline">
                          {lead.full_name || "Unnamed lead"}
                        </Link>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {leadMeta || "No contact details"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(lead.status)}>
                          {formatStatusLabel(lead.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-foreground">
                          {formatStatusLabel(lead.service_interest)}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatStatusLabel(lead.source)}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatMoneyFromCents(lead.estimated_monthly_value_cents)}
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

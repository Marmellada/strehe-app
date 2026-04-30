import Link from "next/link";
import { notFound } from "next/navigation";
import { addLeadInteractionAction, convertLeadToClientAction } from "@/lib/actions/leads";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { DetailField } from "@/components/ui/DetailField";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { Textarea } from "@/components/ui/Textarea";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { formatStatusLabel, getStatusVariant } from "@/lib/ui/status";

type AssignedUser =
  | { full_name: string | null; email: string | null }
  | { full_name: string | null; email: string | null }[]
  | null;

type LeadInteraction = {
  id: string;
  interaction_type: string | null;
  summary: string | null;
  interaction_date: string | null;
  author: AssignedUser;
};

function getSingleUser(value: AssignedUser) {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] || null;
  return value;
}

function formatDate(date: string | null | undefined) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function formatDateTime(date: string | null | undefined) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function formatMoneyFromCents(value: number | null | undefined) {
  return `€${((value || 0) / 100).toFixed(2)}`;
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();
  const { id } = await params;

  const [{ data: lead }, { data: interactions }] = await Promise.all([
    supabase
      .from("leads")
      .select(
        `
        *,
        assigned:app_users!leads_assigned_user_id_fkey(full_name, email)
      `
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("lead_interactions")
      .select(
        `
        id,
        interaction_type,
        summary,
        interaction_date,
        author:app_users!lead_interactions_created_by_user_id_fkey(full_name, email)
      `
      )
      .eq("lead_id", id)
      .order("interaction_date", { ascending: false }),
  ]);

  if (!lead) return notFound();

  const assigned = getSingleUser(lead.assigned);
  const addInteraction = addLeadInteractionAction.bind(null, id);
  const convertLead = convertLeadToClientAction.bind(null, id);
  const rows = (interactions || []) as LeadInteraction[];

  return (
    <div className="space-y-6">
      <PageHeader
        title={lead.full_name || "Lead"}
        description="Inquiry, follow-up, and conversion record."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/leads">Back</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/leads/${id}/edit`}>Edit</Link>
            </Button>
            {lead.converted_client_id ? (
              <Button asChild>
                <Link href={`/clients/${lead.converted_client_id}`}>Open Client</Link>
              </Button>
            ) : (
              <form action={convertLead}>
                <Button type="submit">Convert to Client</Button>
              </form>
            )}
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card size="sm">
          <CardContent>
            <DetailField
              label="Status"
              value={
                <Badge variant={getStatusVariant(lead.status)}>
                  {formatStatusLabel(lead.status)}
                </Badge>
              }
            />
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <DetailField label="Priority" value={formatStatusLabel(lead.priority)} />
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <DetailField
              label="Next Follow-up"
              value={formatDate(lead.next_follow_up_date)}
            />
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <DetailField
              label="Assigned"
              value={assigned?.full_name || assigned?.email || "Unassigned"}
            />
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <DetailField
              label="Estimated Value"
              value={formatMoneyFromCents(lead.estimated_monthly_value_cents)}
            />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <SectionCard title="Contact" contentClassName="grid gap-4">
          <DetailField label="Phone" value={lead.phone || "-"} />
          <DetailField label="Email" value={lead.email || "-"} />
          <DetailField
            label="Preferred Contact"
            value={formatStatusLabel(lead.preferred_contact_method)}
          />
          <DetailField
            label="Location"
            value={[lead.city, lead.country].filter(Boolean).join(", ") || "-"}
          />
        </SectionCard>

        <SectionCard title="Pipeline" contentClassName="grid gap-4">
          <DetailField label="Source" value={formatStatusLabel(lead.source)} />
          <DetailField
            label="Interest"
            value={formatStatusLabel(lead.service_interest)}
          />
          <DetailField label="Properties" value={lead.property_count ?? "-"} />
          <DetailField
            label="Expected Start"
            value={formatDate(lead.expected_start_date)}
          />
          <DetailField label="Created" value={formatDateTime(lead.created_at)} />
          <DetailField
            label="Last Interaction"
            value={formatDateTime(lead.last_interaction_at)}
          />
          <DetailField
            label="Converted"
            value={lead.converted_at ? formatDateTime(lead.converted_at) : "-"}
          />
          <DetailField label="Lost Reason" value={lead.lost_reason || "-"} />
        </SectionCard>

        <SectionCard title="Notes">
          <div className="whitespace-pre-wrap text-sm text-muted-foreground">
            {lead.notes || "-"}
          </div>
        </SectionCard>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Add Interaction</CardTitle>
            <CardDescription>
              Keep the latest call, WhatsApp, email, or meeting note on the lead.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={addInteraction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="interaction_type">Type</Label>
                <select
                  id="interaction_type"
                  name="interaction_type"
                  defaultValue="note"
                  className="flex h-10 w-full rounded-md border border-[var(--select-border)] bg-[var(--select-bg)] px-3 py-2 text-sm text-[var(--select-text)]"
                >
                  <option value="note">Note</option>
                  <option value="call">Call</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                  <option value="meeting">Meeting</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="summary">Summary</Label>
                <Textarea id="summary" name="summary" rows={5} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="interaction_next_follow_up_date">
                  Next Follow-up Date
                </Label>
                <Input
                  id="interaction_next_follow_up_date"
                  name="next_follow_up_date"
                  type="date"
                  defaultValue={lead.next_follow_up_date || ""}
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit">Add Note</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <SectionCard title="Interaction History">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No interactions have been logged yet.
            </p>
          ) : (
            <div className="grid gap-3">
              {rows.map((interaction) => {
                const author = getSingleUser(interaction.author);

                return (
                  <div key={interaction.id} className="rounded-xl border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Badge variant="neutral">
                        {formatStatusLabel(interaction.interaction_type)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(interaction.interaction_date)}
                      </span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">
                      {interaction.summary}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {author?.full_name || author?.email || "Unknown user"}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

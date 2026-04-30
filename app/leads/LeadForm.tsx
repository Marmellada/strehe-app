"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { Textarea } from "@/components/ui/Textarea";

type AppUser = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type Lead = {
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  country?: string | null;
  city?: string | null;
  source?: string | null;
  preferred_contact_method?: string | null;
  service_interest?: string | null;
  property_count?: number | null;
  expected_start_date?: string | null;
  estimated_monthly_value_cents?: number | null;
  status?: string | null;
  priority?: string | null;
  next_follow_up_date?: string | null;
  assigned_user_id?: string | null;
  lost_reason?: string | null;
  notes?: string | null;
};

type LeadFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  users: AppUser[];
  initialData?: Lead;
  isEdit?: boolean;
  leadId?: string;
};

const nativeSelectClassName =
  "flex h-10 w-full items-center justify-between rounded-md border border-[var(--select-border)] bg-[var(--select-bg)] px-3 py-2 text-sm text-[var(--select-text)] ring-offset-background focus:outline-none focus:ring-2 focus:ring-[var(--select-ring-color)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export default function LeadForm({
  action,
  users,
  initialData,
  isEdit = false,
  leadId,
}: LeadFormProps) {
  const estimatedMonthlyValue =
    initialData?.estimated_monthly_value_cents === null ||
    initialData?.estimated_monthly_value_cents === undefined
      ? ""
      : (initialData.estimated_monthly_value_cents / 100).toFixed(2);

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEdit ? "Edit Lead" : "New Lead"}
        description={
          isEdit
            ? "Update the inquiry, next follow-up, and sales status."
            : "Capture a new inquiry before it becomes a client."
        }
      />

      <form action={action} className="max-w-3xl space-y-6">
        <SectionCard title="Lead">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                name="full_name"
                defaultValue={initialData?.full_name || ""}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <select
                id="source"
                name="source"
                defaultValue={initialData?.source || "manual"}
                className={nativeSelectClassName}
              >
                <option value="manual">Manual</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="website">Website</option>
                <option value="referral">Referral</option>
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
                <option value="phone">Phone</option>
              </select>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Contact">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                defaultValue={initialData?.phone || ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={initialData?.email || ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferred_contact_method">Preferred Contact</Label>
              <select
                id="preferred_contact_method"
                name="preferred_contact_method"
                defaultValue={initialData?.preferred_contact_method || ""}
                className={nativeSelectClassName}
              >
                <option value="">Not set</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="phone">Phone</option>
                <option value="email">Email</option>
              </select>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Location">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                name="city"
                defaultValue={initialData?.city || ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                name="country"
                defaultValue={initialData?.country || "Kosovo"}
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Pipeline">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="service_interest">Service Interest</Label>
              <select
                id="service_interest"
                name="service_interest"
                defaultValue={initialData?.service_interest || ""}
                className={nativeSelectClassName}
              >
                <option value="">Not set</option>
                <option value="basic">Basic</option>
                <option value="care">Care</option>
                <option value="care_plus">Care Plus</option>
                <option value="arrival_ready">Arrival-ready</option>
                <option value="technician_coordination">Technician Coordination</option>
                <option value="not_sure">Not Sure</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimated_monthly_value">Estimated Monthly Value</Label>
              <Input
                id="estimated_monthly_value"
                name="estimated_monthly_value"
                type="number"
                min="0"
                step="0.01"
                defaultValue={estimatedMonthlyValue}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                defaultValue={initialData?.status || "new"}
                className={nativeSelectClassName}
              >
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="interested">Interested</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <select
                id="priority"
                name="priority"
                defaultValue={initialData?.priority || "normal"}
                className={nativeSelectClassName}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="next_follow_up_date">Next Follow-up Date</Label>
              <Input
                id="next_follow_up_date"
                name="next_follow_up_date"
                type="date"
                defaultValue={initialData?.next_follow_up_date || ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expected_start_date">Expected Start Date</Label>
              <Input
                id="expected_start_date"
                name="expected_start_date"
                type="date"
                defaultValue={initialData?.expected_start_date || ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="property_count">Property Count</Label>
              <Input
                id="property_count"
                name="property_count"
                type="number"
                min="0"
                step="1"
                defaultValue={initialData?.property_count ?? ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="assigned_user_id">Assigned User</Label>
              <select
                id="assigned_user_id"
                name="assigned_user_id"
                defaultValue={initialData?.assigned_user_id || ""}
                className={nativeSelectClassName}
              >
                <option value="">Unassigned</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name || user.email || "User"}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="lost_reason">Lost Reason</Label>
              <Input
                id="lost_reason"
                name="lost_reason"
                defaultValue={initialData?.lost_reason || ""}
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Notes">
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={5}
              defaultValue={initialData?.notes || ""}
            />
          </div>
        </SectionCard>

        <div className="flex justify-end gap-2">
          <Button variant="outline" asChild>
            <Link href={isEdit && leadId ? `/leads/${leadId}` : "/leads"}>
              Cancel
            </Link>
          </Button>

          <Button type="submit">{isEdit ? "Update Lead" : "Create Lead"}</Button>
        </div>
      </form>
    </div>
  );
}

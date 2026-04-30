"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

function clean(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  return text || null;
}

function cleanNumber(value: FormDataEntryValue | null) {
  const text = clean(value);
  if (!text) return null;

  const number = Number(text);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error("Use a valid positive number.");
  }

  return number;
}

function cleanMoneyToCents(value: FormDataEntryValue | null) {
  const number = cleanNumber(value);
  if (number === null) return null;
  return Math.round(number * 100);
}

function getLeadPayload(formData: FormData) {
  const fullName = clean(formData.get("full_name"));

  if (!fullName) {
    throw new Error("Lead name is required.");
  }

  return {
    full_name: fullName,
    phone: clean(formData.get("phone")),
    email: clean(formData.get("email")),
    country: clean(formData.get("country")) || "Kosovo",
    city: clean(formData.get("city")),
    source: clean(formData.get("source")),
    preferred_contact_method: clean(formData.get("preferred_contact_method")),
    service_interest: clean(formData.get("service_interest")),
    property_count: cleanNumber(formData.get("property_count")),
    expected_start_date: clean(formData.get("expected_start_date")),
    estimated_monthly_value_cents: cleanMoneyToCents(
      formData.get("estimated_monthly_value")
    ),
    status: clean(formData.get("status")) || "new",
    priority: clean(formData.get("priority")) || "normal",
    next_follow_up_date: clean(formData.get("next_follow_up_date")),
    assigned_user_id: clean(formData.get("assigned_user_id")),
    lost_reason: clean(formData.get("lost_reason")),
    notes: clean(formData.get("notes")),
    updated_at: new Date().toISOString(),
  };
}

export async function createLeadAction(formData: FormData) {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("leads")
    .insert([
      {
        ...getLeadPayload(formData),
        created_by_user_id: user?.id || null,
      },
    ])
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/leads");
  redirect(`/leads/${data.id}`);
}

export async function updateLeadAction(id: string, formData: FormData) {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();

  const { error } = await supabase
    .from("leads")
    .update(getLeadPayload(formData))
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  redirect(`/leads/${id}`);
}

export async function addLeadInteractionAction(id: string, formData: FormData) {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();
  const summary = clean(formData.get("summary"));

  if (!summary) {
    throw new Error("Interaction summary is required.");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("lead_interactions").insert([
    {
      lead_id: id,
      interaction_type: clean(formData.get("interaction_type")) || "note",
      summary,
      created_by_user_id: user?.id || null,
    },
  ]);

  if (error) {
    throw new Error(error.message);
  }

  const nextFollowUpDate = clean(formData.get("next_follow_up_date"));
  const { error: leadError } = await supabase
    .from("leads")
    .update({
      next_follow_up_date: nextFollowUpDate,
      last_interaction_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (leadError) {
    throw new Error(leadError.message);
  }

  revalidatePath(`/leads/${id}`);
  revalidatePath("/leads");
  redirect(`/leads/${id}`);
}

export async function convertLeadToClientAction(id: string) {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (leadError) {
    throw new Error(leadError.message);
  }

  if (!lead) {
    throw new Error("Lead not found.");
  }

  if (lead.converted_client_id) {
    redirect(`/clients/${lead.converted_client_id}`);
  }

  const leadNotes = [
    lead.notes,
    lead.source ? `Lead source: ${lead.source}` : null,
    lead.service_interest ? `Interest: ${lead.service_interest}` : null,
    lead.property_count ? `Properties: ${lead.property_count}` : null,
    lead.estimated_monthly_value_cents
      ? `Estimated monthly value: €${(lead.estimated_monthly_value_cents / 100).toFixed(2)}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .insert([
      {
        client_type: "individual",
        full_name: lead.full_name,
        phone: lead.phone,
        email: lead.email,
        country: lead.country || "Kosovo",
        notes: leadNotes || null,
        status: "active",
      },
    ])
    .select("id")
    .single();

  if (clientError) {
    throw new Error(clientError.message);
  }

  const { error: updateError } = await supabase
    .from("leads")
    .update({
      status: "won",
      converted_client_id: client.id,
      converted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  revalidatePath("/clients");
  redirect(`/clients/${client.id}`);
}

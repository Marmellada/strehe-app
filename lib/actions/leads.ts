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

function getChangedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[]
) {
  return fields.filter((field) => {
    const beforeValue = before[field] ?? null;
    const afterValue = after[field] ?? null;
    return String(beforeValue ?? "") !== String(afterValue ?? "");
  });
}

async function createLeadEvent({
  supabase,
  leadId,
  eventType,
  summary,
  userId,
  metadata = {},
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  leadId: string;
  eventType: string;
  summary: string;
  userId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await supabase.from("lead_events").insert([
    {
      lead_id: leadId,
      event_type: eventType,
      summary,
      created_by_user_id: userId || null,
      metadata,
    },
  ]);

  if (error) {
    throw new Error(error.message);
  }
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

  await createLeadEvent({
    supabase,
    leadId: data.id,
    eventType: "created",
    summary: "Lead created",
    userId: user?.id,
  });

  revalidatePath("/leads");
  redirect(`/leads/${data.id}`);
}

export async function updateLeadAction(id: string, formData: FormData) {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: before, error: beforeError } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (beforeError) {
    throw new Error(beforeError.message);
  }

  if (!before) {
    throw new Error("Lead not found.");
  }

  const payload = getLeadPayload(formData);

  const { error } = await supabase
    .from("leads")
    .update(payload)
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  const changedFields = getChangedFields(before, payload, [
    "full_name",
    "phone",
    "email",
    "country",
    "city",
    "source",
    "preferred_contact_method",
    "service_interest",
    "property_count",
    "expected_start_date",
    "estimated_monthly_value_cents",
    "status",
    "priority",
    "next_follow_up_date",
    "assigned_user_id",
    "lost_reason",
    "notes",
  ]);

  if (changedFields.length > 0) {
    await createLeadEvent({
      supabase,
      leadId: id,
      eventType:
        before.status !== payload.status
          ? "status_changed"
          : before.assigned_user_id !== payload.assigned_user_id
            ? "assigned"
            : before.next_follow_up_date !== payload.next_follow_up_date
              ? "follow_up_changed"
              : "updated",
      summary:
        before.status !== payload.status
          ? `Status changed to ${payload.status}`
          : `Lead updated: ${changedFields.join(", ")}`,
      userId: user?.id,
      metadata: { changed_fields: changedFields },
    });
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

  await createLeadEvent({
    supabase,
    leadId: id,
    eventType: "interaction",
    summary: `${clean(formData.get("interaction_type")) || "note"}: ${summary}`,
    userId: user?.id,
  });

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
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
        company_name: null,
        contact_person: null,
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

  await createLeadEvent({
    supabase,
    leadId: id,
    eventType: "converted",
    summary: "Lead converted to client",
    userId: user?.id,
    metadata: { client_id: client.id },
  });

  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  revalidatePath("/clients");
  redirect(`/clients/${client.id}`);
}

export async function convertLeadWithOptionsAction(id: string, formData: FormData) {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const clientType = clean(formData.get("client_type")) || "individual";
  const createProperty = clean(formData.get("create_property")) === "yes";
  const propertyTitle = clean(formData.get("property_title"));
  const propertyAddress = clean(formData.get("property_address"));

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (leadError) throw new Error(leadError.message);
  if (!lead) throw new Error("Lead not found.");
  if (lead.converted_client_id) redirect(`/clients/${lead.converted_client_id}`);

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
        client_type: clientType,
        full_name: clientType === "individual" ? lead.full_name : null,
        company_name: clientType === "business" ? lead.full_name : null,
        contact_person: clientType === "business" ? lead.full_name : null,
        phone: lead.phone,
        email: lead.email,
        country: lead.country || "Kosovo",
        notes: leadNotes || null,
        status: "active",
      },
    ])
    .select("id")
    .single();

  if (clientError) throw new Error(clientError.message);

  let propertyId: string | null = null;
  if (createProperty) {
    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .insert([
        {
          title: propertyTitle || `${lead.full_name} property draft`,
          owner_client_id: client.id,
          address_line_1: propertyAddress || "Address to confirm",
          city: lead.city || "Prishtina",
          country: lead.country || "Kosovo",
          property_type: "apartment",
          status: "vacant",
        },
      ])
      .select("id")
      .single();

    if (propertyError) throw new Error(propertyError.message);
    propertyId = property.id;
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

  if (updateError) throw new Error(updateError.message);

  await createLeadEvent({
    supabase,
    leadId: id,
    eventType: "converted",
    summary: propertyId
      ? "Lead converted to client with draft property"
      : "Lead converted to client",
    userId: user?.id,
    metadata: { client_id: client.id, property_id: propertyId },
  });

  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  revalidatePath("/clients");
  revalidatePath("/properties");
  redirect(propertyId ? `/properties/${propertyId}` : `/clients/${client.id}`);
}

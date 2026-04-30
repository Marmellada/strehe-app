"use server";

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/supabase/admin";

export type PublicContactLeadState = {
  status: "idle" | "success" | "error";
  message: string;
  mailtoHref?: string;
};

function clean(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  return text || null;
}

function buildMailtoHref({
  email,
  name,
  contact,
  abroad,
  country,
  area,
  message,
}: {
  email: string;
  name: string | null;
  contact: string | null;
  abroad: string | null;
  country: string | null;
  area: string | null;
  message: string | null;
}) {
  const subject = `Website inquiry from ${name || "new contact"}`;
  const body = [
    `Name: ${name || "-"}`,
    `Email or phone: ${contact || "-"}`,
    `Lives abroad: ${abroad === "yes" ? "Yes" : "No"}`,
    `Country where they live: ${country || "-"}`,
    `Apartment area: ${area || "-"}`,
    "",
    "Message:",
    message || "-",
  ].join("\n");

  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export async function createPublicContactLeadAction(
  _state: PublicContactLeadState,
  formData: FormData
): Promise<PublicContactLeadState> {
  const honeypot = clean(formData.get("website_url"));
  const email = clean(formData.get("company_email")) || "";
  const name = clean(formData.get("name"));
  const contact = clean(formData.get("contact"));
  const abroad = clean(formData.get("abroad"));
  const country = clean(formData.get("country"));
  const area = clean(formData.get("area"));
  const message = clean(formData.get("message"));
  const locale = clean(formData.get("locale"));
  const mailtoHref = buildMailtoHref({
    email,
    name,
    contact,
    abroad,
    country,
    area,
    message,
  });

  if (honeypot) {
    return {
      status: "success",
      message: "Thanks. We received your request.",
      mailtoHref,
    };
  }

  if (!name || !contact) {
    return {
      status: "error",
      message: "Please add your name and email or phone.",
      mailtoHref,
    };
  }

  const notes = [
    message,
    area ? `Apartment area: ${area}` : null,
    abroad ? `Lives abroad: ${abroad === "yes" ? "yes" : "no"}` : null,
    country ? `Country where they live: ${country}` : null,
    locale ? `Website locale: ${locale}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const supabase = getAdminClient();
  const { error } = await supabase.from("leads").insert([
    {
      full_name: name,
      phone: contact,
      country: "Kosovo",
      city: area,
      source: "website",
      status: "new",
      priority: "normal",
      preferred_contact_method: contact.includes("@") ? "email" : "whatsapp",
      service_interest: "not_sure",
      notes: notes || null,
      updated_at: new Date().toISOString(),
    },
  ]);

  if (error) {
    return {
      status: "error",
      message: "We could not save the request yet. Please use the email fallback.",
      mailtoHref,
    };
  }

  revalidatePath("/leads");

  return {
    status: "success",
    message: "Thanks. Your request is now in our lead list.",
    mailtoHref,
  };
}

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

const messages = {
  en: {
    success: "Thanks. We received your request and will reply shortly.",
    required: "Please add your name and email or phone.",
    error: "We could not save the request yet. Please use the email option.",
  },
  sq: {
    success: "Faleminderit. E pranuam kërkesën tuaj dhe do t'ju përgjigjemi së shpejti.",
    required: "Ju lutemi shkruani emrin dhe email-in ose telefonin.",
    error: "Kërkesa nuk u ruajt. Ju lutemi përdorni opsionin e email-it.",
  },
  de: {
    success: "Vielen Dank. Wir haben Ihre Anfrage erhalten und melden uns in Kürze.",
    required: "Bitte geben Sie Ihren Namen und Ihre E-Mail-Adresse oder Telefonnummer an.",
    error: "Die Anfrage konnte nicht gespeichert werden. Bitte nutzen Sie die E-Mail-Option.",
  },
} as const;

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
  const copy = messages[locale as keyof typeof messages] || messages.en;
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
      message: copy.success,
      mailtoHref,
    };
  }

  if (!name || !contact) {
    return {
      status: "error",
      message: copy.required,
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
  const contactIsEmail = contact.includes("@");
  const { error } = await supabase.from("leads").insert([
    {
      full_name: name,
      phone: contactIsEmail ? null : contact,
      email: contactIsEmail ? contact : null,
      country: country || null,
      city: area,
      source: "website",
      status: "new",
      priority: "normal",
      preferred_contact_method: contactIsEmail ? "email" : "whatsapp",
      service_interest: "not_sure",
      notes: notes || null,
      updated_at: new Date().toISOString(),
    },
  ]);

  if (error) {
    return {
      status: "error",
      message: copy.error,
      mailtoHref,
    };
  }

  revalidatePath("/leads");

  return {
    status: "success",
    message: copy.success,
    mailtoHref,
  };
}

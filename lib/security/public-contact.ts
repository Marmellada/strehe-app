import { z } from "zod";
import { normalizeAttribution } from "@/lib/funnel/attribution";

export type PublicContactLeadState = {
  status: "idle" | "success" | "error";
  message: string;
  mailtoHref?: string;
};

type RecentLead = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  notes: string | null;
  source_detail?: string | null;
  campaign_name?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  click_id?: string | null;
  landing_locale?: string | null;
  landing_page?: string | null;
};

type RecentLeadQuery = {
  eq(column: string, value: unknown): RecentLeadQuery;
  gte(column: string, value: string): RecentLeadQuery;
  limit(count: number): Promise<{ data: RecentLead[] | null; error: unknown }>;
};

type LeadInsert = RecentLead & {
  id: string;
  source: "website";
  status: "new";
  priority: "normal";
  preferred_contact_method: "email" | "whatsapp";
  service_interest: "not_sure";
  created_at: string;
  updated_at: string;
  first_touch_at: string;
};

export type PublicInquiryNotification = {
  inquiryId: string;
  customerName: string;
  email: string | null;
  phone: string | null;
  message: string | null;
  locale: "en" | "sq" | "de";
  source: "website";
  sourceDetail: string | null;
  campaignName: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  clickId: string | null;
  submittedAt: string;
};

export type PublicInquiryNotificationResult =
  | { ok: true }
  | { ok: false; reason: string };

type PublicInquiryNotificationFailure = {
  event: "public_contact_notification_failed";
  inquiryId: string;
  reason: string;
};

export type PublicContactAdminClient = {
  from(table: "leads"): {
    select(columns: string): RecentLeadQuery;
    insert(rows: LeadInsert[]): Promise<{ error: unknown }>;
  };
};

type PublicContactDependencies = {
  getAdminClient: () => PublicContactAdminClient;
  createInquiryId: () => string;
  now: () => Date;
  revalidateLeads: () => void;
  sendInquiryNotification: (
    inquiry: PublicInquiryNotification
  ) => Promise<PublicInquiryNotificationResult>;
  logNotificationFailure: (
    failure: PublicInquiryNotificationFailure
  ) => void;
};

const DUPLICATE_WINDOW_MS = 15 * 60 * 1000;
const MEANINGFUL_TEXT = /[\p{L}\p{N}]/u;

const messages = {
  en: {
    success: "Thanks. We received your request and will reply shortly.",
    required: "Please add a valid name and email or phone.",
    error: "We could not save the request yet. Please use the email option.",
  },
  sq: {
    success: "Faleminderit. E pranuam kërkesën tuaj dhe do t'ju përgjigjemi së shpejti.",
    required: "Ju lutemi shkruani një emër dhe email ose telefon të vlefshëm.",
    error: "Kërkesa nuk u ruajt. Ju lutemi përdorni opsionin e email-it.",
  },
  de: {
    success: "Vielen Dank. Wir haben Ihre Anfrage erhalten und melden uns in Kürze.",
    required: "Bitte geben Sie einen gültigen Namen und eine E-Mail-Adresse oder Telefonnummer an.",
    error: "Die Anfrage konnte nicht gespeichert werden. Bitte nutzen Sie die E-Mail-Option.",
  },
} as const;

const contactSchema = z.object({
  email: z.string().email().max(254),
  name: z.string().min(2).max(100).regex(MEANINGFUL_TEXT),
  contact: z
    .string()
    .min(3)
    .max(254)
    .refine(
      (value) => z.email().safeParse(value).success || /^\+?\d{6,20}$/.test(value),
      "Invalid contact"
    ),
  abroad: z.enum(["yes", "no"]),
  country: z.string().max(80),
  area: z.string().max(120),
  message: z.string().max(2000),
  locale: z.enum(["en", "sq", "de"]),
});

function readString(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}

function normalizeText(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}

function normalizeContact(value: string) {
  const normalized = normalizeText(value);
  if (normalized.includes("@")) return normalized.toLowerCase();
  return normalized.replace(/[\s().-]/g, "");
}

function buildMailtoHref(input: {
  email: string;
  name: string;
  contact: string;
  abroad: "yes" | "no";
  country: string;
  area: string;
  message: string;
}) {
  const subject = "Website inquiry from " + input.name;
  const body = [
    "Name: " + input.name,
    "Email or phone: " + input.contact,
    "Lives abroad: " + (input.abroad === "yes" ? "Yes" : "No"),
    "Country where they live: " + (input.country || "-"),
    "Apartment area: " + (input.area || "-"),
    "",
    "Message:",
    input.message || "-",
  ].join("\n");

  return (
    "mailto:" +
    input.email +
    "?subject=" +
    encodeURIComponent(subject) +
    "&body=" +
    encodeURIComponent(body)
  );
}

function equivalentLead(row: RecentLead, candidate: RecentLead) {
  return (
    row.full_name === candidate.full_name &&
    row.email === candidate.email &&
    row.phone === candidate.phone &&
    row.country === candidate.country &&
    row.city === candidate.city &&
    row.notes === candidate.notes
  );
}

export function createPublicContactLeadHandler(
  dependencies: PublicContactDependencies
) {
  function recordNotificationFailure(
    inquiryId: string,
    reason: string
  ) {
    try {
      dependencies.logNotificationFailure({
        event: "public_contact_notification_failed",
        inquiryId,
        reason,
      });
    } catch {
      // Logging must never change the persisted inquiry's customer response.
    }
  }

  return async function handlePublicContactLead(
    _state: PublicContactLeadState,
    formData: FormData
  ): Promise<PublicContactLeadState> {
    const rawLocale = normalizeText(readString(formData, "locale"));
    const locale = rawLocale === "sq" || rawLocale === "de" ? rawLocale : "en";
    const copy = messages[locale];

    if (normalizeText(readString(formData, "website_url"))) {
      return { status: "success", message: copy.success };
    }

    const parsed = contactSchema.safeParse({
      email: normalizeText(readString(formData, "company_email")).toLowerCase(),
      name: normalizeText(readString(formData, "name")),
      contact: normalizeContact(readString(formData, "contact")),
      abroad: normalizeText(readString(formData, "abroad")),
      country: normalizeText(readString(formData, "country")),
      area: normalizeText(readString(formData, "area")),
      message: normalizeText(readString(formData, "message")),
      locale,
    });

    if (!parsed.success) {
      return { status: "error", message: copy.required };
    }

    const input = parsed.data;
    let attribution;
    try {
      attribution = normalizeAttribution({
        source_detail: readString(formData, "source_detail"),
        campaign_name: readString(formData, "campaign_name"),
        utm_source: readString(formData, "utm_source"),
        utm_medium: readString(formData, "utm_medium"),
        utm_campaign: readString(formData, "utm_campaign"),
        utm_content: readString(formData, "utm_content"),
        utm_term: readString(formData, "utm_term"),
        click_id: readString(formData, "click_id"),
        landing_locale: readString(formData, "landing_locale"),
        landing_page: readString(formData, "landing_page"),
      });
    } catch {
      return { status: "error", message: copy.required };
    }
    const contactIsEmail = input.contact.includes("@");
    const notes = [
      input.message || null,
      input.area ? "Apartment area: " + input.area : null,
      "Lives abroad: " + input.abroad,
      input.country ? "Country where they live: " + input.country : null,
      "Website locale: " + input.locale,
    ]
      .filter(Boolean)
      .join("\n");
    const candidate: RecentLead = {
      full_name: input.name,
      phone: contactIsEmail ? null : input.contact,
      email: contactIsEmail ? input.contact : null,
      country: input.country || null,
      city: input.area || null,
      notes: notes || null,
      ...attribution,
    };
    const mailtoHref = buildMailtoHref(input);

    try {
      const supabase = dependencies.getAdminClient();
      const cutoff = new Date(
        dependencies.now().getTime() - DUPLICATE_WINDOW_MS
      ).toISOString();
      const recentResult = await supabase
        .from("leads")
        .select("full_name,email,phone,country,city,notes,created_at")
        .eq("source", "website")
        .gte("created_at", cutoff)
        .limit(25);

      if (recentResult.error) {
        return { status: "error", message: copy.error, mailtoHref };
      }

      if ((recentResult.data || []).some((row) => equivalentLead(row, candidate))) {
        return { status: "success", message: copy.success, mailtoHref };
      }

      const inquiryId = dependencies.createInquiryId();
      const submittedAt = dependencies.now().toISOString();

      const insertResult = await supabase.from("leads").insert([
        {
          ...candidate,
          id: inquiryId,
          source: "website",
          status: "new",
          priority: "normal",
          preferred_contact_method: contactIsEmail ? "email" : "whatsapp",
          service_interest: "not_sure",
          created_at: submittedAt,
          first_touch_at: submittedAt,
          updated_at: submittedAt,
        },
      ]);

      if (insertResult.error) {
        return { status: "error", message: copy.error, mailtoHref };
      }

      try {
        const notificationResult = await dependencies.sendInquiryNotification({
          inquiryId,
          customerName: input.name,
          email: candidate.email,
          phone: candidate.phone,
          message: input.message || null,
          locale: input.locale,
          source: "website",
          sourceDetail: attribution.source_detail,
          campaignName: attribution.campaign_name,
          utmSource: attribution.utm_source,
          utmMedium: attribution.utm_medium,
          utmCampaign: attribution.utm_campaign,
          utmContent: attribution.utm_content,
          utmTerm: attribution.utm_term,
          clickId: attribution.click_id,
          submittedAt,
        });

        if (!notificationResult.ok) {
          recordNotificationFailure(inquiryId, notificationResult.reason);
        }
      } catch {
        recordNotificationFailure(inquiryId, "unexpected_error");
      }

      try {
        dependencies.revalidateLeads();
      } catch (error) {
        console.error("Lead saved but lead-list revalidation failed.", error);
      }
      return { status: "success", message: copy.success, mailtoHref };
    } catch {
      return { status: "error", message: copy.error, mailtoHref };
    }
  };
}

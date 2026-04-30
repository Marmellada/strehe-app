import { getAdminClient } from "@/lib/supabase/admin";

export type CompanyProfile = {
  companyName: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  logoUrl: string | null;
};

const FALLBACK_PROFILE: CompanyProfile = {
  companyName: "STREHË",
  email: "info@strehe.com",
  phone: "+383 44 000 000",
  city: "Prishtina",
  country: "Kosovo",
  logoUrl: null,
};

export async function getCompanyProfile(): Promise<CompanyProfile> {
  const supabase = getAdminClient();
  const { data } = await supabase
    .from("company_settings")
    .select("company_name, email, phone, city, country, logo_url")
    .limit(1)
    .maybeSingle();

  return {
    companyName: data?.company_name || FALLBACK_PROFILE.companyName,
    email: data?.email || FALLBACK_PROFILE.email,
    phone: data?.phone || FALLBACK_PROFILE.phone,
    city: data?.city || FALLBACK_PROFILE.city,
    country: data?.country || FALLBACK_PROFILE.country,
    logoUrl: data?.logo_url || null,
  };
}

export function buildWhatsAppMessage({
  page,
  locale,
  message,
}: {
  page: string;
  locale: string;
  message: string;
}) {
  return [
    "Hi STREHË, I came from the website and want to ask about apartment care.",
    "",
    message,
    "",
    `Source: website_${page}`,
    `Language: ${locale}`,
  ].join("\n");
}

export function toWhatsAppHref(phone: string, message: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  const normalized = digits.startsWith("+") ? digits.slice(1) : digits;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

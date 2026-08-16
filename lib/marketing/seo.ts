import type { Metadata, MetadataRoute } from "next";
import {
  marketingContent,
  marketingLocales,
  type MarketingLocale,
} from "@/lib/marketing/content";
import type { CompanyProfile } from "@/lib/marketing/company-profile";

export const PUBLIC_SITE_URL = "https://www.streheprona.com";
export const APP_SITE_HOST = "app.streheprona.com";

export const marketingPageSlugs = [
  "",
  "packages",
  "services",
  "how-it-works",
  "about",
  "contact",
] as const;

export type MarketingPageSlug = (typeof marketingPageSlugs)[number];

type PageMetadataCopy = {
  title: string;
  description: string;
};

const localizedPageMetadata: Record<
  MarketingLocale,
  Record<Exclude<MarketingPageSlug, "">, PageMetadataCopy>
> = {
  sq: {
    packages: {
      title: "Paketat e kujdesit për apartamente | STREHË",
      description:
        "Krahasoni paketat e STREHË për vizita të planifikuara, kontroll të gjendjes, fotografi dhe përditësime për apartamente në Prishtinë dhe Fushë Kosovë.",
    },
    services: {
      title: "Shërbime për kujdesin e apartamentit | STREHË",
      description:
        "Shihni si STREHË ndihmon me kontrolle të planifikuara, përgatitje para ardhjes dhe koordinim praktik për apartamente në Prishtinë dhe Fushë Kosovë.",
    },
    "how-it-works": {
      title: "Si funksionon kujdesi për apartamentin | STREHË",
      description:
        "Nga kontakti i parë te përcaktimi i nevojave, vizitat e planifikuara dhe përditësimet e qarta për pronarët që jetojnë jashtë Kosovës.",
    },
    about: {
      title: "Rreth STREHË | Kujdes lokal për apartamente",
      description:
        "Mësoni pse STREHË është krijuar për pronarët që jetojnë jashtë dhe kanë nevojë për kujdes të organizuar të apartamentit në Prishtinë ose Fushë Kosovë.",
    },
    contact: {
      title: "Kontaktoni STREHË | Kujdes për apartamente",
      description:
        "Na tregoni ku ndodhet apartamenti dhe çfarë mbështetjeje ju duhet në Prishtinë ose Fushë Kosovë. Filloni me një kërkesë të thjeshtë për informacion.",
    },
  },
  en: {
    packages: {
      title: "Apartment-care packages in Prishtina | STREHË",
      description:
        "Compare STREHË packages for scheduled visits, condition checks, photos, and owner updates for apartments in Prishtina and Fushë Kosovë.",
    },
    services: {
      title: "Apartment care services in Prishtina | STREHË",
      description:
        "See how STREHË supports apartment owners with scheduled checks, arrival preparation, documented updates, and practical coordination in Prishtina and Fushë Kosovë.",
    },
    "how-it-works": {
      title: "How STREHË apartment care works",
      description:
        "From the first inquiry and consultation to scheduled visits and clear updates, understand how STREHË supports apartment owners living abroad.",
    },
    about: {
      title: "About STREHË | Local apartment care",
      description:
        "Learn why STREHË is designed for owners living abroad who need organized local care for an apartment in Prishtina or Fushë Kosovë.",
    },
    contact: {
      title: "Contact STREHË about apartment care",
      description:
        "Tell STREHË where your apartment is and what support you need in Prishtina or Fushë Kosovë. Start with a simple request for information.",
    },
  },
  de: {
    packages: {
      title: "Pakete für Wohnungsbetreuung | STREHË",
      description:
        "Vergleichen Sie STREHË-Pakete mit planmäßigen Besuchen, Zustandsprüfungen, Fotos und Updates für Wohnungen in Prishtina und Fushë Kosovë.",
    },
    services: {
      title: "Leistungen für Ihre Wohnung | STREHË",
      description:
        "Erfahren Sie, wie STREHË Eigentümer mit regelmäßigen Kontrollen, Vorbereitung vor der Ankunft, dokumentierten Updates und praktischer Koordination in Prishtina und Fushë Kosovë unterstützt.",
    },
    "how-it-works": {
      title: "So funktioniert die Wohnungsbetreuung | STREHË",
      description:
        "Von der ersten Anfrage und Abstimmung bis zu planmäßigen Besuchen und klaren Updates: So unterstützt STREHË Eigentümer im Ausland.",
    },
    about: {
      title: "Über STREHË | Lokale Wohnungsbetreuung",
      description:
        "Erfahren Sie, warum STREHË für Eigentümer im Ausland entwickelt wurde, die eine organisierte Betreuung ihrer Wohnung in Prishtina oder Fushë Kosovë benötigen.",
    },
    contact: {
      title: "STREHË kontaktieren | Wohnungsbetreuung",
      description:
        "Teilen Sie STREHË mit, wo Ihre Wohnung liegt und welche Unterstützung Sie in Prishtina oder Fushë Kosovë benötigen. Beginnen Sie mit einer einfachen Anfrage.",
    },
  },
};

export function getLocalizedMarketingPath(
  locale: MarketingLocale,
  page: MarketingPageSlug
) {
  return `/${locale}${page ? `/${page}` : ""}`;
}

export function getLocalizedAlternates(page: MarketingPageSlug) {
  return Object.fromEntries(
    marketingLocales.map((locale) => [
      locale,
      `${PUBLIC_SITE_URL}${getLocalizedMarketingPath(locale, page)}`,
    ])
  ) as Record<MarketingLocale, string>;
}

export function buildMarketingMetadata(
  locale: MarketingLocale,
  page: MarketingPageSlug
): Metadata {
  const copy =
    page === ""
      ? {
          title: marketingContent[locale].metaTitle,
          description: marketingContent[locale].metaDescription,
        }
      : localizedPageMetadata[locale][page];
  const canonical = `${PUBLIC_SITE_URL}${getLocalizedMarketingPath(locale, page)}`;

  return {
    metadataBase: new URL(PUBLIC_SITE_URL),
    title: copy.title,
    description: copy.description,
    alternates: {
      canonical,
      languages: getLocalizedAlternates(page),
    },
    openGraph: {
      type: "website",
      url: canonical,
      title: copy.title,
      description: copy.description,
      siteName: "STREHË",
      images: [`${PUBLIC_SITE_URL}/marketing/home-hero-v2.webp`],
    },
  };
}

export function buildPublicSitemap(): MetadataRoute.Sitemap {
  const localizedPages = marketingPageSlugs.flatMap((page) =>
    marketingLocales.map((locale) => ({
      url: `${PUBLIC_SITE_URL}${getLocalizedMarketingPath(locale, page)}`,
      alternates: {
        languages: getLocalizedAlternates(page),
      },
    }))
  );

  return [
    ...localizedPages,
    { url: `${PUBLIC_SITE_URL}/privacy` },
    { url: `${PUBLIC_SITE_URL}/terms` },
    { url: `${PUBLIC_SITE_URL}/data-deletion` },
  ];
}

export function buildStructuredData(company: CompanyProfile) {
  const organization: Record<string, unknown> = {
    "@type": "Organization",
    "@id": `${PUBLIC_SITE_URL}/#organization`,
    name: company.companyName,
    url: PUBLIC_SITE_URL,
    email: company.email,
    telephone: company.phone,
    areaServed: [
      { "@type": "City", name: "Prishtina" },
      { "@type": "City", name: "Fushë Kosovë" },
    ],
  };

  if (company.logoUrl) {
    organization.logo = company.logoUrl;
  }

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${PUBLIC_SITE_URL}/#website`,
        name: "STREHË",
        url: PUBLIC_SITE_URL,
      },
      organization,
    ],
  };
}

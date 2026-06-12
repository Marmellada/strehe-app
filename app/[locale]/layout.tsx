import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { LocaleSwitcher } from "@/components/marketing/LocaleSwitcher";
import { Button } from "@/components/ui/Button";
import { getCompanyProfile } from "@/lib/marketing/company-profile";
import {
  isMarketingLocale,
  marketingContent,
  marketingLocales,
  type MarketingLocale,
} from "@/lib/marketing/content";

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{
    locale: string;
  }>;
};

export async function generateStaticParams() {
  return marketingLocales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  if (!isMarketingLocale(locale)) {
    return {};
  }

  const content = marketingContent[locale];
  const publicSiteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.streheprona.com";

  return {
    metadataBase: new URL(publicSiteUrl),
    title: content.metaTitle,
    description: content.metaDescription,
    alternates: {
      canonical: `/${locale}`,
      languages: {
        en: "/en",
        sq: "/sq",
        de: "/de",
      },
    },
    openGraph: {
      type: "website",
      url: `/${locale}`,
      title: content.metaTitle,
      description: content.metaDescription,
      siteName: "STREHË",
      images: ["/marketing/home-hero.png"],
    },
  };
}

function MarketingNav({ locale }: { locale: MarketingLocale }) {
  const content = marketingContent[locale];

  return (
    <nav className="hidden items-center gap-6 text-sm text-slate-100 md:flex">
      <Link href={`/${locale}`}>{content.nav.home}</Link>
      <Link href={`/${locale}/services`}>{content.nav.services}</Link>
      <Link href={`/${locale}/how-it-works`}>{content.nav.howItWorks}</Link>
      <Link href={`/${locale}/about`}>{content.nav.about}</Link>
      <Link href={`/${locale}/contact`}>{content.nav.contact}</Link>
    </nav>
  );
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;

  if (!isMarketingLocale(locale)) {
    notFound();
  }

  const content = marketingContent[locale];
  const company = await getCompanyProfile();
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://app.streheprona.com";

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div
        aria-hidden="true"
        className="fixed inset-0 bg-[url('/marketing/smart-property-network.jpg')] bg-cover bg-center bg-no-repeat opacity-70"
      />
      <div
        aria-hidden="true"
        className="fixed inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.72)_0%,rgba(2,6,23,0.64)_36%,rgba(2,6,23,0.88)_100%)]"
      />
      <div
        aria-hidden="true"
        className="fixed inset-0 bg-[linear-gradient(110deg,rgba(2,6,23,0.84)_0%,rgba(15,23,42,0.58)_44%,rgba(15,23,42,0.78)_100%)]"
      />

      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/82 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <Link href={`/${locale}`} className="flex min-w-0 shrink-0 items-center gap-3">
            {company.logoUrl ? (
              <Image
                src={company.logoUrl}
                alt={company.companyName}
                width={36}
                height={36}
                unoptimized
                className="h-9 w-9 shrink-0 rounded-md object-contain"
              />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/5 text-sm font-semibold">
                S
              </div>
            )}
            <div className="hidden min-w-0 sm:block">
              <div className="truncate text-sm font-semibold tracking-[0.18em] text-white">
                {company.companyName}
              </div>
              <div className="hidden text-xs text-slate-400 sm:block">
                {content.hero.eyebrow}
              </div>
            </div>
          </Link>

          <MarketingNav locale={locale} />

          <div className="flex items-center gap-3">
            <LocaleSwitcher locale={locale} />
            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
              <Link href={`${appUrl}/auth/login?next=/dashboard`}>
                {content.nav.login}
              </Link>
            </Button>
            <details className="relative md:hidden">
              <summary className="cursor-pointer list-none rounded-md border border-white/15 px-3 py-2 text-sm text-white">
                {content.nav.menu}
              </summary>
              <div className="absolute right-0 top-12 z-50 grid min-w-52 gap-1 rounded-xl border border-white/10 bg-slate-950 p-2 shadow-2xl">
                <Link className="rounded-lg px-3 py-2 text-sm hover:bg-white/10" href={`/${locale}`}>
                  {content.nav.home}
                </Link>
                <Link className="rounded-lg px-3 py-2 text-sm hover:bg-white/10" href={`/${locale}/services`}>
                  {content.nav.services}
                </Link>
                <Link className="rounded-lg px-3 py-2 text-sm hover:bg-white/10" href={`/${locale}/how-it-works`}>
                  {content.nav.howItWorks}
                </Link>
                <Link className="rounded-lg px-3 py-2 text-sm hover:bg-white/10" href={`/${locale}/about`}>
                  {content.nav.about}
                </Link>
                <Link className="rounded-lg px-3 py-2 text-sm hover:bg-white/10" href={`/${locale}/contact`}>
                  {content.nav.contact}
                </Link>
                <Link className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-950" href={`${appUrl}/auth/login?next=/dashboard`}>
                  {content.nav.login}
                </Link>
              </div>
            </details>
          </div>
        </div>
      </header>

      <div className="relative z-10">{children}</div>

      <footer className="relative z-10 border-t border-white/10 bg-slate-950/82 backdrop-blur">
        <div className="mx-auto grid max-w-7xl gap-6 px-6 py-10 md:grid-cols-[1fr_auto] md:items-center">
          <div className="space-y-2">
            <p className="text-lg font-semibold text-white">{company.companyName}</p>
            <p className="max-w-2xl text-sm text-slate-400">{content.footer.line}</p>
            <p className="text-sm text-slate-500">
              {company.city}, {company.country} • {company.email} • {company.phone}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-300">
            <Link href={`/${locale}/services`}>{content.nav.services}</Link>
            <Link href={`/${locale}/contact`}>{content.nav.contact}</Link>
            <Link href={`${appUrl}/auth/login?next=/dashboard`}>
              {content.footer.login}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

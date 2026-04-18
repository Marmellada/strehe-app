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

  return {
    title: content.metaTitle,
    description: content.metaDescription,
  };
}

function MarketingNav({ locale }: { locale: MarketingLocale }) {
  const content = marketingContent[locale];

  return (
    <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
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

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <Link href={`/${locale}`} className="flex items-center gap-3">
            {company.logoUrl ? (
              <Image
                src={company.logoUrl}
                alt={company.companyName}
                width={36}
                height={36}
                unoptimized
                className="h-9 w-9 rounded-md object-contain"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-md border border-white/15 bg-white/5 text-sm font-semibold">
                S
              </div>
            )}
            <div>
              <div className="text-sm font-semibold tracking-[0.18em] text-white">
                {company.companyName}
              </div>
              <div className="text-xs text-slate-400">{content.hero.eyebrow}</div>
            </div>
          </Link>

          <MarketingNav locale={locale} />

          <div className="flex items-center gap-3">
            <LocaleSwitcher locale={locale} />
            <Button asChild variant="outline" size="sm">
              <Link href="/auth/login?next=/dashboard">{content.nav.login}</Link>
            </Button>
          </div>
        </div>
      </header>

      {children}

      <footer className="border-t border-white/10 bg-slate-950">
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
            <Link href="/auth/login?next=/dashboard">{content.footer.login}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

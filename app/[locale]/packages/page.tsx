import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, MessageCircle, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  buildWhatsAppMessage,
  getCompanyProfile,
  toWhatsAppHref,
} from "@/lib/marketing/company-profile";
import { isMarketingLocale, marketingContent } from "@/lib/marketing/content";

type PackagesPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

const accentGradients = [
  "border-amber-200/30 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(18,28,48,0.9))]",
  "border-amber-200/30 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(18,28,48,0.9))]",
  "border-amber-200/40 bg-[linear-gradient(180deg,rgba(28,25,23,0.94),rgba(15,23,42,0.92))]",
] as const;

export default async function PackagesPage({ params }: PackagesPageProps) {
  const { locale } = await params;

  if (!isMarketingLocale(locale)) {
    notFound();
  }

  const content = marketingContent[locale];
  const company = await getCompanyProfile();
  const whatsappHref = toWhatsAppHref(
    company.phone,
    buildWhatsAppMessage({
      page: "packages",
      locale,
      message: content.cta.description,
    })
  );

  const { packagesPage } = content;

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 md:py-12">
      <section className="grid gap-6 rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(28,25,23,0.82))] px-6 py-8 md:px-8 md:py-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)] lg:items-center">
        <div className="max-w-4xl space-y-4">
          <p className="text-sm uppercase tracking-[0.2em] text-amber-200/80">
            {locale === "sq" ? "Paketat" : locale === "de" ? "Pakete" : "Packages"}
          </p>
          <h1 className="text-4xl font-semibold text-white md:text-5xl">
            {packagesPage.introTitle}
          </h1>
          <p className="text-lg leading-8 text-slate-300">{packagesPage.introBody}</p>
        </div>

        <div className="relative min-h-[280px] overflow-hidden rounded-2xl border border-white/10">
          <Image
            src="/marketing/services-lead.png"
            alt="Apartment care packages"
            fill
            priority
            sizes="(min-width: 1024px) 48vw, 100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,14,23,0.12),rgba(9,14,23,0.72)_76%,rgba(9,14,23,0.88))]" />
          <div className="absolute inset-x-0 bottom-0 p-5">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-amber-200/85">
              {packagesPage.packages[0].name}
            </p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-100">
              {packagesPage.packages[0].summary}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-12 grid gap-6 lg:grid-cols-3">
        {packagesPage.packages.map((pkg, index) => (
          <article
            key={pkg.name}
            className={`flex flex-col rounded-2xl border p-6 sm:p-8 ${accentGradients[index]} ${index === 2 ? "lg:border-amber-200/50" : ""}`}
          >
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-amber-200">
                0{index + 1}
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">{pkg.name}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">{pkg.summary}</p>
            </div>

            <div className="mt-6 space-y-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-400">
                  {locale === "sq" ? "6 muaj" : locale === "de" ? "6 Monate" : "6 months"}
                </p>
                <p className="mt-1 text-3xl font-semibold text-white">
                  {pkg.sixMonthPrice}
                </p>
                <p className="text-sm text-slate-400">≈ {pkg.sixMonthMonthly}</p>
              </div>
              <div className="rounded-xl border border-amber-200/30 bg-amber-200/5 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-amber-200/80">
                  {locale === "sq" ? "12 muaj" : locale === "de" ? "12 Monate" : "12 months"}
                </p>
                <p className="mt-1 text-3xl font-semibold text-amber-200">
                  {pkg.twelveMonthPrice}
                </p>
                <p className="text-sm text-amber-200/70">≈ {pkg.twelveMonthMonthly}</p>
              </div>
            </div>

            <div className="mt-7 border-t border-white/10 pt-6">
              <p className="text-sm font-semibold text-white">{pkg.visits}</p>
            </div>

            <div className="mt-5 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                {locale === "sq" ? "Përfshin" : locale === "de" ? "Enthalten" : "Includes"}
              </p>
              <ul className="mt-3 space-y-2.5">
                {pkg.includes.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm leading-6 text-slate-200">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-5 rounded-xl border border-red-200/10 bg-red-200/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-200/70">
                {locale === "sq" ? "Nuk përfshin" : locale === "de" ? "Nicht enthalten" : "Not included"}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{pkg.excludes}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="mt-14 rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-amber-200" />
          <div>
            <h2 className="text-xl font-semibold text-white">
              {packagesPage.exclusions.title}
            </h2>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {packagesPage.exclusions.items.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm leading-6 text-slate-300">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.03)] p-6">
        <p className="text-sm leading-7 text-slate-300">{packagesPage.note}</p>
      </section>

      <section className="mt-12 rounded-[2rem] bg-amber-300 p-7 text-slate-950 sm:p-10">
        <div className="flex flex-col justify-between gap-7 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">{content.cta.title}</h2>
            <p className="mt-3 max-w-2xl leading-7 text-slate-700">{content.cta.description}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-slate-950 text-white hover:bg-slate-800">
              <Link href={whatsappHref} target="_blank" rel="noreferrer">
                <MessageCircle className="h-4 w-4" />
                {content.cta.primary}
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-slate-900/30 bg-transparent text-slate-950 hover:bg-white/50">
              <Link href={`/${locale}/services`}>
                {locale === "sq" ? "Shërbime shtesë" : locale === "de" ? "Zusätzliche Leistungen" : "Additional Services"}
              </Link>
            </Button>
          </div>
        </div>
        {locale === "sq" && (
          <p className="mt-7 max-w-4xl border-t border-slate-900/15 pt-5 text-[0.8125rem] leading-6 text-slate-700">
            STREHË aktualisht po regjistron interesin e pronarëve që jetojnë jashtë Kosovës. Aktivizimi i shërbimit, pranimi i pagesave dhe marrja e çelësave bëhen vetëm pas përfundimit të regjistrimit të biznesit dhe marrëveshjes përkatëse.
          </p>
        )}
      </section>
    </main>
  );
}

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  buildWhatsAppMessage,
  getCompanyProfile,
  toWhatsAppHref,
} from "@/lib/marketing/company-profile";
import { isMarketingLocale, marketingContent } from "@/lib/marketing/content";

type ServicesPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function ServicesPage({ params }: ServicesPageProps) {
  const { locale } = await params;

  if (!isMarketingLocale(locale)) {
    notFound();
  }

  const content = marketingContent[locale];
  const company = await getCompanyProfile();
  const whatsappHref = toWhatsAppHref(
    company.phone,
    buildWhatsAppMessage({
      page: "services",
      locale,
      message: content.servicesPage.introBody,
    })
  );

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 md:py-12">
      <section className="grid gap-6 rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(28,25,23,0.82))] px-6 py-8 md:px-8 md:py-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)] lg:items-center">
        <div className="max-w-4xl space-y-4">
          <p className="text-sm uppercase tracking-[0.2em] text-amber-200/80">
            {content.nav.services}
          </p>
          <h1 className="text-4xl font-semibold text-white md:text-5xl">
            {content.servicesPage.introTitle}
          </h1>
          <p className="text-lg leading-8 text-slate-300">{content.servicesPage.introBody}</p>
        </div>

        <div className="relative min-h-[280px] overflow-hidden rounded-2xl border border-white/10">
          <Image
            src="/marketing/services-lead.png"
            alt="Apartment being prepared with care"
            fill
            priority
            sizes="(min-width: 1024px) 48vw, 100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,14,23,0.12),rgba(9,14,23,0.72)_76%,rgba(9,14,23,0.88))]" />
          <div className="absolute inset-x-0 bottom-0 p-5">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-amber-200/85">
              {content.servicesPage.categories[0].title}
            </p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-100">
              {content.servicesPage.categories[0].outcome}
            </p>
          </div>
        </div>
      </section>

      <section id="service-areas" className="mt-16 border-y border-white/10">
        {content.servicesPage.categories.map((category, index) => (
          <article
            key={category.title}
            className="grid gap-8 border-b border-white/10 py-10 last:border-b-0 md:grid-cols-[0.72fr_1.28fr] md:gap-12 md:py-14"
          >
            <div className={index % 2 === 1 ? "md:order-2" : undefined}>
              <p className="text-xs font-semibold tracking-[0.2em] text-amber-200">
                0{index + 1}
              </p>
              <h2 className="mt-4 text-2xl font-semibold leading-tight text-white sm:text-3xl">
                {category.title}
              </h2>
              <p className="mt-4 max-w-lg leading-7 text-slate-300">
                {category.summary}
              </p>
            </div>
            <div className={`rounded-2xl border border-white/10 bg-slate-950/75 p-6 sm:p-8 ${index % 2 === 1 ? "md:order-1" : ""}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                {locale === "sq" ? "Përfshihet" : content.nav.services}
              </p>
              <ul className="mt-5 grid gap-4 sm:grid-cols-2">
                {category.actions.map((action) => (
                  <li key={action} className="flex items-start gap-3 text-sm leading-6 text-slate-200">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
                    {action}
                  </li>
                ))}
              </ul>
              <p className="mt-7 border-t border-white/10 pt-5 text-sm font-medium leading-6 text-white">
                {category.outcome}
              </p>
            </div>
          </article>
        ))}
      </section>

      <section className="mt-10 rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6">
        <p className="text-sm leading-7 text-slate-300">{content.servicesPage.note}</p>
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
              <Link href="#service-areas">{content.cta.secondary}</Link>
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

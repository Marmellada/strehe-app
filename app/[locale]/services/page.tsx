import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { getCompanyProfile, toWhatsAppHref } from "@/lib/marketing/company-profile";
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
  const whatsappHref = toWhatsAppHref(company.phone, content.servicesPage.introBody);

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
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,14,23,0.12),rgba(9,14,23,0.72)_76%,rgba(9,14,23,0.88))]" />
          <div className="absolute inset-x-0 bottom-0 p-5">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-amber-200/85">
              Practical readiness
            </p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-100">
              The service should feel visible and useful, not abstract.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-12 grid gap-6 xl:grid-cols-2">
        {content.servicesPage.categories.map((category) => (
          <Card
            key={category.title}
            className="border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(12,18,31,0.92))] text-white"
          >
            <CardHeader>
              <CardTitle>{category.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 text-slate-300">
              <p className="leading-7">{category.summary}</p>
              <div className="grid gap-3">
                {category.actions.map((action) => (
                  <div
                    key={action}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6"
                  >
                    {action}
                  </div>
                ))}
              </div>
              <p className="text-sm font-medium text-slate-100">{category.outcome}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-10 rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6">
        <p className="text-sm leading-7 text-slate-300">{content.servicesPage.note}</p>
      </section>

      <section className="mt-12 flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href={whatsappHref} target="_blank" rel="noreferrer">
            {content.cta.primary}
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href={`/${locale}/contact`}>{content.cta.secondary}</Link>
        </Button>
      </section>
    </main>
  );
}

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
    <main className="mx-auto max-w-7xl px-6 py-16">
      <div className="max-w-4xl space-y-4">
        <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
          {content.nav.services}
        </p>
        <h1 className="text-4xl font-semibold text-white md:text-5xl">
          {content.servicesPage.introTitle}
        </h1>
        <p className="text-lg leading-8 text-slate-300">{content.servicesPage.introBody}</p>
      </div>

      <section className="mt-12 grid gap-6 xl:grid-cols-2">
        {content.servicesPage.categories.map((category) => (
          <Card key={category.title} className="border-white/10 bg-slate-900 text-white">
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

      <section className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6">
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

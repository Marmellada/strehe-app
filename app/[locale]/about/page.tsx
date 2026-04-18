import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { getCompanyProfile, toWhatsAppHref } from "@/lib/marketing/company-profile";
import { isMarketingLocale, marketingContent } from "@/lib/marketing/content";

type AboutPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function AboutPage({ params }: AboutPageProps) {
  const { locale } = await params;

  if (!isMarketingLocale(locale)) {
    notFound();
  }

  const content = marketingContent[locale];
  const company = await getCompanyProfile();
  const whatsappHref = toWhatsAppHref(company.phone, content.aboutPage.introBody);

  return (
    <main className="mx-auto max-w-7xl px-6 py-16">
      <div className="max-w-4xl space-y-4">
        <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
          {content.nav.about}
        </p>
        <h1 className="text-4xl font-semibold text-white md:text-5xl">
          {content.aboutPage.introTitle}
        </h1>
        <p className="text-lg leading-8 text-slate-300">{content.aboutPage.introBody}</p>
      </div>

      <section className="mt-12 grid gap-4 lg:grid-cols-3">
        {content.aboutPage.values.map((value) => (
          <Card key={value.title} className="border-white/10 bg-slate-900 text-white">
            <CardHeader>
              <CardTitle>{value.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-7 text-slate-300">
              {value.body}
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6">
        <p className="max-w-3xl text-base leading-8 text-slate-200">
          {content.aboutPage.closing}
        </p>
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

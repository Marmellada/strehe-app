import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { getCompanyProfile, toWhatsAppHref } from "@/lib/marketing/company-profile";
import { isMarketingLocale, marketingContent } from "@/lib/marketing/content";

type HowItWorksPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function HowItWorksPage({ params }: HowItWorksPageProps) {
  const { locale } = await params;

  if (!isMarketingLocale(locale)) {
    notFound();
  }

  const content = marketingContent[locale];
  const company = await getCompanyProfile();
  const whatsappHref = toWhatsAppHref(company.phone, content.howPage.introBody);

  return (
    <main className="mx-auto max-w-7xl px-6 py-16">
      <div className="max-w-4xl space-y-4">
        <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
          {content.nav.howItWorks}
        </p>
        <h1 className="text-4xl font-semibold text-white md:text-5xl">
          {content.howPage.introTitle}
        </h1>
        <p className="text-lg leading-8 text-slate-300">{content.howPage.introBody}</p>
      </div>

      <section className="mt-12 grid gap-4 lg:grid-cols-4">
        {content.howPage.steps.map((step) => (
          <Card key={step.title} className="border-white/10 bg-slate-900 text-white">
            <CardHeader>
              <CardTitle>{step.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-7 text-slate-300">
              {step.body}
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-2xl font-semibold text-white">{content.howPage.expectationsTitle}</h2>
          <div className="mt-5 grid gap-3">
            {content.howPage.expectations.map((item) => (
              <div
                key={item}
                className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm leading-6 text-slate-200"
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900 p-6">
          <h2 className="text-2xl font-semibold text-white">{content.howPage.objectionsTitle}</h2>
          <div className="mt-5 grid gap-4">
            {content.howPage.objections.map((item) => (
              <div key={item.question} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <h3 className="text-base font-medium text-white">{item.question}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-300">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
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

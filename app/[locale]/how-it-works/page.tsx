import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  buildWhatsAppMessage,
  getCompanyProfile,
  toWhatsAppHref,
} from "@/lib/marketing/company-profile";
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
  const whatsappHref = toWhatsAppHref(
    company.phone,
    buildWhatsAppMessage({
      page: "how_it_works",
      locale,
      message: content.howPage.introBody,
    })
  );

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 md:py-12">
      <section className="grid gap-6 rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(28,25,23,0.82))] px-6 py-8 md:px-8 md:py-10 lg:grid-cols-[minmax(0,1.02fr)_minmax(300px,0.98fr)] lg:items-center">
        <div className="max-w-4xl space-y-4">
          <p className="text-sm uppercase tracking-[0.2em] text-amber-200/80">
            {content.nav.howItWorks}
          </p>
          <h1 className="text-4xl font-semibold text-white md:text-5xl">
            {content.howPage.introTitle}
          </h1>
          <p className="text-lg leading-8 text-slate-300">{content.howPage.introBody}</p>
        </div>

        <div className="relative min-h-[280px] overflow-hidden rounded-2xl border border-white/10">
          <Image
            src="/marketing/reporting-lead.png"
            alt="Apartment visit being documented"
            fill
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,14,23,0.12),rgba(9,14,23,0.72)_76%,rgba(9,14,23,0.88))]" />
          <div className="absolute inset-x-0 bottom-0 p-5">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-amber-200/85">
              Clear follow-up
            </p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-100">
              The process should feel documented, understandable, and easy to begin.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-12 grid gap-4 lg:grid-cols-4">
        {content.howPage.steps.map((step) => (
          <Card
            key={step.title}
            className="border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(12,18,31,0.92))] text-white"
          >
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
        <div className="rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6">
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

        <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(12,18,31,0.92))] p-6">
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

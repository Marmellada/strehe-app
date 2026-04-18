import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { getCompanyProfile, toWhatsAppHref } from "@/lib/marketing/company-profile";
import { isMarketingLocale, marketingContent } from "@/lib/marketing/content";

type HomePageProps = {
  params: Promise<{
    locale: string;
  }>;
};

function Section({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-7xl px-6 py-16">
      <div className="mb-8 max-w-3xl space-y-3">
        <h2 className="text-3xl font-semibold text-white md:text-4xl">{title}</h2>
        {intro ? <p className="text-base leading-7 text-slate-300">{intro}</p> : null}
      </div>
      {children}
    </section>
  );
}

export default async function LocalizedHomePage({ params }: HomePageProps) {
  const { locale } = await params;

  if (!isMarketingLocale(locale)) {
    notFound();
  }

  const company = await getCompanyProfile();
  const content = marketingContent[locale];
  const whatsappHref = toWhatsAppHref(
    company.phone,
    content.cta.description
  );

  return (
    <main>
      <section className="mx-auto max-w-7xl px-6 py-6 lg:py-16">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(30,41,59,0.92))] p-5 md:p-10 lg:p-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.14),transparent_38%)]" />
          <div className="relative space-y-5">
            <Badge variant="info" className="bg-white/10 text-white">
              {content.hero.eyebrow}
            </Badge>

            <div className="max-w-4xl space-y-4">
              <h1 className="text-[2rem] font-semibold leading-tight text-white md:text-5xl lg:text-6xl">
                {content.hero.title}
              </h1>
              <p className="max-w-2xl text-[0.95rem] leading-7 text-slate-200 md:text-lg md:leading-8">
                {content.hero.description}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Button asChild size="lg">
                <Link href={whatsappHref} target="_blank" rel="noreferrer">
                  {content.hero.primaryCta}
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href={`/${locale}/services`}>{content.hero.secondaryCta}</Link>
              </Button>
            </div>

            <p className="text-sm text-slate-300">{content.hero.reassurance}</p>

            <div className="grid grid-cols-3 gap-2 pt-1 md:gap-3">
              {content.hero.statLabels.map((label) => (
                <div
                  key={label}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-xs font-medium leading-5 text-white md:min-h-24 md:px-4 md:py-4 md:text-sm md:leading-6"
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Section title={content.problem.title} intro={content.problem.intro}>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
          <div className="grid gap-4 md:grid-cols-2">
            {content.problem.points.map((point) => (
              <Card key={point} className="border-white/10 bg-slate-900 text-white">
                <CardContent className="pt-6 text-base leading-7 text-slate-200">
                  {point}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900 p-6">
            <h3 className="text-xl font-semibold text-white">{content.problem.competitorTitle}</h3>
            <div className="mt-5 grid gap-3">
              {content.problem.competitorPoints.map((point) => (
                <div
                  key={point}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200"
                >
                  {point}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section
        title={content.servicesPreview.title}
        intro={content.servicesPreview.intro}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {content.servicesPreview.items.map((item) => (
            <Card key={item.title} className="border-white/10 bg-slate-900 text-white">
              <CardHeader>
                <CardTitle>{item.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-7 text-slate-300">
                {item.description}
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section title={content.trust.title} intro={content.trust.intro}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {content.trust.items.map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-white/10 bg-slate-900 px-5 py-6 text-sm leading-7 text-slate-200"
            >
              {item}
            </div>
          ))}
        </div>
      </Section>

      <Section title={content.process.title} intro={content.process.intro}>
        <div className="grid gap-4 lg:grid-cols-4">
          {content.process.steps.map((step) => (
            <Card key={step.title} className="border-white/10 bg-slate-900 text-white">
              <CardHeader>
                <CardTitle>{step.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-7 text-slate-300">
                {step.description}
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section title={content.scope.title} intro={content.scope.intro}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {content.scope.bullets.map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-6 text-base text-slate-100"
            >
              {item}
            </div>
          ))}
        </div>
      </Section>

      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className="rounded-2xl border border-white/10 bg-slate-900 px-8 py-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="space-y-3">
              <h2 className="text-3xl font-semibold text-white">{content.cta.title}</h2>
              <p className="max-w-2xl text-base leading-7 text-slate-300">
                {content.cta.description}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href={whatsappHref} target="_blank" rel="noreferrer">
                  {content.cta.primary}
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href={`/${locale}/contact`}>{content.cta.secondary}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

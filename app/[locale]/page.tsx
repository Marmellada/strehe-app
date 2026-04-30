import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  buildWhatsAppMessage,
  getCompanyProfile,
  toWhatsAppHref,
} from "@/lib/marketing/company-profile";
import { isMarketingLocale, marketingContent } from "@/lib/marketing/content";

type HomePageProps = {
  params: Promise<{
    locale: string;
  }>;
};

function Section({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-7xl px-6 py-14 md:py-20">
      <div className="mb-8 max-w-3xl space-y-3 md:mb-10">
        {eyebrow ? (
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-amber-200/80">
            {eyebrow}
          </p>
        ) : null}
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
    buildWhatsAppMessage({
      page: "home",
      locale,
      message: content.cta.description,
    })
  );

  return (
    <main className="pb-12">
      <section className="mx-auto max-w-7xl px-6 py-6 md:py-8">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/28 shadow-2xl shadow-black/30 backdrop-blur-[2px]">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,14,23,0.05)_0%,rgba(9,14,23,0.42)_46%,rgba(9,14,23,0.84)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(9,14,23,0.9)_0%,rgba(9,14,23,0.62)_42%,rgba(9,14,23,0.18)_78%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_82%,rgba(245,158,11,0.2),transparent_32%)]" />

          <div className="relative grid min-h-[640px] items-end gap-8 px-5 py-6 md:min-h-[720px] md:px-8 md:py-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.6fr)] lg:px-12 lg:py-12">
            <div className="max-w-3xl space-y-5">
              <Badge variant="info" className="border border-white/15 bg-black/20 text-white">
                {content.hero.eyebrow}
              </Badge>

              <div className="space-y-4">
                <h1 className="max-w-4xl text-[2.05rem] font-semibold leading-tight text-white md:text-[3.35rem] md:leading-[1.05] lg:text-[4.1rem]">
                  {content.hero.title}
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-100/92 md:text-lg md:leading-8">
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

              <p className="text-sm text-slate-200/88">{content.hero.reassurance}</p>

              <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-3">
                {content.hero.statLabels.map((label) => (
                  <div
                    key={label}
                    className="rounded-xl border border-white/12 bg-black/34 px-4 py-4 text-sm font-medium leading-6 text-white backdrop-blur-sm"
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>

            <div className="hidden lg:block">
              <div className="rounded-2xl border border-white/12 bg-[rgba(10,14,22,0.62)] p-6 backdrop-blur-md">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-amber-200/85">
                  Calm local care
                </p>
                <div className="mt-4 grid gap-3">
                  {[
                    "Regular visits with clear updates",
                    "One local point of contact",
                    "Structured follow-up instead of improvised help",
                  ].map((item) => (
                    <div
                      key={item}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-slate-100"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Section
        eyebrow={content.problem.competitorTitle}
        title={content.problem.title}
        intro={content.problem.intro}
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
          <div className="grid gap-4 md:grid-cols-2">
            {content.problem.points.map((point) => (
              <Card
                key={point}
                className="border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(12,18,31,0.96))] text-white"
              >
                <CardContent className="pt-6 text-base leading-7 text-slate-200">
                  {point}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="space-y-4">
            <div className="relative min-h-[320px] overflow-hidden rounded-2xl border border-white/10">
              <Image
                src="/marketing/check-moment.png"
                alt="Calm apartment check in progress"
                fill
                sizes="(min-width: 1024px) 42vw, 100vw"
                className="object-cover object-center"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,14,23,0.12),rgba(9,14,23,0.58)_72%,rgba(9,14,23,0.88))]" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-amber-200/85">
                  Active care, not passive beauty
                </p>
                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-100">
                  The service should feel like someone responsible is actually paying attention to
                  the apartment.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(28,25,23,0.76),rgba(15,23,42,0.9))] p-6">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-amber-200/85">
                Informal help breaks down
              </p>
              <h3 className="mt-3 text-2xl font-semibold text-white">
                {content.problem.competitorTitle}
              </h3>
              <div className="mt-5 grid gap-3">
                {content.problem.competitorPoints.map((point) => (
                  <div
                    key={point}
                    className="rounded-xl border border-white/10 bg-black/18 px-4 py-3 text-sm leading-6 text-slate-100"
                  >
                    {point}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section
        eyebrow="Practical support"
        title={content.servicesPreview.title}
        intro={content.servicesPreview.intro}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {content.servicesPreview.items.map((item) => (
            <Card
              key={item.title}
              className="border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(11,18,32,0.92))] text-white"
            >
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

      <Section eyebrow="Trust through process" title={content.trust.title} intro={content.trust.intro}>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <p className="text-lg leading-8 text-slate-200">
                Trust should come from regular visits, clear updates, a known service area, and
                one responsible local setup.
              </p>
            </div>
            <div className="relative min-h-[260px] overflow-hidden rounded-2xl border border-white/10">
              <Image
                src="/marketing/key-handling.png"
                alt="Responsible key handling"
                fill
                sizes="(min-width: 1024px) 31vw, 100vw"
                className="object-cover object-center"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,14,23,0.12),rgba(9,14,23,0.72)_76%,rgba(9,14,23,0.9))]" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-amber-200/85">
                  Access handled carefully
                </p>
                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-100">
                  We can show secure key handling now in a brand-neutral way and later replace it
                  with the real cabinet setup you choose.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {content.trust.items.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-white/10 bg-slate-900 px-5 py-6 text-sm leading-7 text-slate-200"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section eyebrow="Simple steps" title={content.process.title} intro={content.process.intro}>
        <div className="grid gap-4 lg:grid-cols-4">
          {content.process.steps.map((step, index) => (
            <Card
              key={step.title}
              className="border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(12,18,31,0.92))] text-white"
            >
              <CardHeader>
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-amber-200/85">
                  Step {index + 1}
                </p>
                <CardTitle>{step.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-7 text-slate-300">
                {step.description}
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section eyebrow="Focused launch" title={content.scope.title} intro={content.scope.intro}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {content.scope.bullets.map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] px-5 py-6 text-base text-slate-100"
            >
              {item}
            </div>
          ))}
        </div>
      </Section>

      <section className="mx-auto max-w-7xl px-6 pb-20 pt-2">
        <div className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(28,25,23,0.86))] px-6 py-8 md:px-8 md:py-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-amber-200/85">
                First contact should feel easy
              </p>
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

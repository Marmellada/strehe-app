import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  CalendarCheck,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Home,
  KeyRound,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  buildWhatsAppMessage,
  getCompanyProfile,
  toWhatsAppHref,
} from "@/lib/marketing/company-profile";
import {
  isMarketingLocale,
  marketingContent,
  type MarketingLocale,
} from "@/lib/marketing/content";

type HomePageProps = {
  params: Promise<{
    locale: string;
  }>;
};

const homeUi: Record<
  MarketingLocale,
  {
    visitProof: string;
    proofTitle: string;
    proofIntro: string;
    proofItems: string[];
    serviceEyebrow: string;
    processEyebrow: string;
    trustEyebrow: string;
    faqEyebrow: string;
    coverage: string;
    response: string;
    visualAlt: string;
    inspectionAlt: string;
  }
> = {
  sq: {
    visitProof: "Nga vizita te prova",
    proofTitle: "Pas çdo vizite e dini çfarë u kontrollua.",
    proofIntro:
      "Jo vetëm një mesazh se gjithçka është në rregull. Merrni një përmbledhje të qartë që mund ta shihni edhe nga larg.",
    proofItems: [
      "Foto nga pikat e kontrolluara",
      "Listë e shkurtër e gjendjes",
      "Çështje që kërkojnë vendim ose ndjekje",
    ],
    serviceEyebrow: "Kujdes praktik",
    processEyebrow: "Fillim i thjeshtë",
    trustEyebrow: "Besim me proces",
    faqEyebrow: "Pyetje të zakonshme",
    coverage: "Prishtinë & Fushë Kosovë",
    response: "Përgjigje zakonisht brenda ditës",
    visualAlt: "Apartament i mirëmbajtur dhe i ajrosur pas një kontrolli",
    inspectionAlt: "Kontroll profesional i dritares dhe radiatorit",
  },
  en: {
    visitProof: "From visit to proof",
    proofTitle: "After every visit, you know what was checked.",
    proofIntro:
      "Not just a message saying everything is fine. You receive a clear update you can understand from abroad.",
    proofItems: [
      "Photos from the checked areas",
      "A short condition checklist",
      "Issues that need a decision or follow-up",
    ],
    serviceEyebrow: "Practical care",
    processEyebrow: "A simple start",
    trustEyebrow: "Trust through process",
    faqEyebrow: "Common questions",
    coverage: "Prishtina & Fushë Kosovë",
    response: "We usually reply the same day",
    visualAlt: "A well-kept apartment aired after a scheduled check",
    inspectionAlt: "A professional checking a window and radiator",
  },
  de: {
    visitProof: "Vom Besuch zum Nachweis",
    proofTitle: "Nach jedem Besuch wissen Sie, was geprüft wurde.",
    proofIntro:
      "Nicht nur eine Nachricht, dass alles in Ordnung ist. Sie erhalten ein klares Update, das Sie auch aus dem Ausland nachvollziehen können.",
    proofItems: [
      "Fotos der kontrollierten Bereiche",
      "Eine kurze Zustandscheckliste",
      "Punkte, die eine Entscheidung oder Nachverfolgung brauchen",
    ],
    serviceEyebrow: "Praktische Betreuung",
    processEyebrow: "Ein einfacher Start",
    trustEyebrow: "Vertrauen durch klare Abläufe",
    faqEyebrow: "Häufige Fragen",
    coverage: "Prishtina & Fushë Kosovë",
    response: "Antwort meist noch am selben Tag",
    visualAlt: "Eine gepflegte Wohnung nach einer geplanten Kontrolle",
    inspectionAlt: "Professionelle Kontrolle von Fenster und Heizkörper",
  },
};

const serviceIcons = [Home, CalendarCheck, Wrench, KeyRound] as const;

export default async function LocalizedHomePage({ params }: HomePageProps) {
  const { locale } = await params;

  if (!isMarketingLocale(locale)) {
    notFound();
  }

  const company = await getCompanyProfile();
  const content = marketingContent[locale];
  const ui = homeUi[locale];
  const whatsappHref = toWhatsAppHref(
    company.phone,
    buildWhatsAppMessage({
      page: "home",
      locale,
      message: content.cta.description,
    })
  );

  return (
    <main className="pb-16">
      <section className="mx-auto max-w-7xl px-4 py-4 sm:px-6 md:py-8">
        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#f1eee7] shadow-2xl shadow-black/35">
          <div className="grid lg:min-h-[660px] lg:grid-cols-[1.05fr_0.95fr]">
            <div className="relative z-10 flex flex-col justify-center px-6 py-12 text-slate-950 sm:px-10 lg:px-14 lg:py-16">
              <div className="mb-8 flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                <span className="rounded-full border border-slate-300 bg-white/70 px-3 py-1.5">
                  {content.hero.eyebrow}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-amber-700" />
                  {ui.coverage}
                </span>
              </div>

              <h1 className="max-w-2xl text-[2.5rem] font-semibold leading-[1.04] tracking-[-0.045em] text-slate-950 sm:text-5xl lg:text-[3.5rem]">
                {content.hero.title}
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
                {content.hero.description}
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button asChild size="lg">
                  <Link href={whatsappHref} target="_blank" rel="noreferrer">
                    <MessageCircle className="h-4 w-4" />
                    {content.hero.primaryCta}
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-slate-300 bg-transparent text-slate-900 hover:bg-white"
                >
                  <Link href={`/${locale}/how-it-works`}>
                    {content.hero.secondaryCta}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>

              <p className="mt-4 inline-flex items-center gap-2 text-sm text-slate-500">
                <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                {ui.response}
              </p>
            </div>

            <div className="relative min-h-[430px] lg:min-h-full">
              <Image
                src="/marketing/home-hero-v2.webp"
                alt={ui.visualAlt}
                fill
                priority
                sizes="(min-width: 1024px) 58vw, 100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,rgba(2,6,23,0.62))] lg:bg-[linear-gradient(90deg,rgba(241,238,231,0.38),transparent_22%,transparent_70%,rgba(2,6,23,0.18))]" />
              <div className="absolute inset-x-5 bottom-5 grid grid-cols-3 gap-2 sm:inset-x-8 sm:bottom-8 sm:gap-3">
                {content.hero.statLabels.map((label, index) => {
                  const Icon = [Camera, MapPin, ShieldCheck][index] || ShieldCheck;
                  return (
                    <div
                      key={label}
                      className="rounded-2xl border border-white/20 bg-slate-950/74 p-3 text-white shadow-lg backdrop-blur-md sm:p-4"
                    >
                      <Icon className="h-4 w-4 text-amber-300" />
                      <p className="mt-2 text-[0.68rem] font-medium leading-4 sm:text-xs sm:leading-5">
                        {label}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-20">
        <div className="grid overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/90 lg:grid-cols-[1.04fr_0.96fr]">
          <div className="relative min-h-[420px]">
            <Image
              src="/marketing/apartment-check-v2.webp"
              alt={ui.inspectionAlt}
              fill
              sizes="(min-width: 1024px) 52vw, 100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,rgba(2,6,23,0.78))]" />
            <div className="absolute bottom-6 left-6 rounded-full border border-white/20 bg-slate-950/75 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-200 backdrop-blur sm:bottom-8 sm:left-8">
              {ui.visitProof}
            </div>
          </div>

          <div className="flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-12">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
              {ui.visitProof}
            </p>
            <h2 className="mt-4 max-w-xl text-3xl font-semibold leading-tight text-white sm:text-4xl">
              {ui.proofTitle}
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
              {ui.proofIntro}
            </p>
            <div className="mt-8 grid gap-4">
              {ui.proofItems.map((item, index) => {
                const Icon = [Camera, ClipboardCheck, Wrench][index];
                return (
                  <div key={item} className="flex items-start gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-300 text-slate-950">
                      <Icon className="h-5 w-5" />
                    </span>
                    <p className="pt-2 text-sm font-medium leading-6 text-slate-100">
                      {item}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f1eee7] text-slate-950">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-800">
              {ui.serviceEyebrow}
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">
              {content.servicesPreview.title}
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              {content.servicesPreview.intro}
            </p>
          </div>

          <div className="mt-10 grid gap-px overflow-hidden rounded-[1.75rem] border border-slate-200 bg-slate-200 md:grid-cols-2 xl:grid-cols-4">
            {content.servicesPreview.items.map((item, index) => {
              const Icon = serviceIcons[index] || Home;
              return (
                <article
                  key={item.title}
                  className="group min-h-64 bg-white p-7 transition-colors hover:bg-amber-50"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-amber-200">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-8 text-xl font-semibold">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    {item.description}
                  </p>
                </article>
              );
            })}
          </div>

          <div className="mt-8">
            <Button
              asChild
              variant="outline"
              className="border-slate-300 bg-transparent text-slate-950 hover:bg-white"
            >
              <Link href={`/${locale}/services`}>
                {content.nav.services}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24">
        <div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
              {ui.processEyebrow}
            </p>
            <h2 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">
              {content.process.title}
            </h2>
            <p className="mt-4 max-w-md text-base leading-7 text-slate-300">
              {content.process.intro}
            </p>
          </div>

          <ol className="grid gap-4 sm:grid-cols-2">
            {content.process.steps.map((step, index) => (
              <li
                key={step.title}
                className="rounded-2xl border border-white/10 bg-slate-950/70 p-6"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold tracking-[0.18em] text-amber-200">
                    0{index + 1}
                  </span>
                  <CheckCircle2 className="h-5 w-5 text-slate-600" />
                </div>
                <h3 className="mt-6 text-lg font-semibold text-white">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 md:py-14">
        <div className="rounded-[2rem] border border-amber-200/20 bg-[linear-gradient(135deg,rgba(120,53,15,0.35),rgba(15,23,42,0.94)_55%)] p-7 sm:p-10">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
                {ui.trustEyebrow}
              </p>
              <h2 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">
                {content.trust.title}
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-300">
                {content.trust.intro}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {content.trust.items.slice(0, 4).map((item) => (
                <div
                  key={item}
                  className="flex gap-3 rounded-2xl border border-white/10 bg-black/15 p-4 text-sm leading-6 text-slate-100"
                >
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 md:py-24">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
            {ui.faqEyebrow}
          </p>
          <h2 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">
            {content.howPage.objectionsTitle}
          </h2>
        </div>
        <div className="mt-10 divide-y divide-white/10 rounded-2xl border border-white/10 bg-slate-950/70 px-6">
          {content.howPage.objections.map((item) => (
            <details key={item.question} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-white">
                {item.question}
                <span className="text-xl text-amber-200 transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="max-w-3xl pb-1 pt-3 text-sm leading-7 text-slate-400">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6">
        <div className="overflow-hidden rounded-[2rem] bg-amber-300 p-7 text-slate-950 sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h2 className="max-w-3xl text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
                {content.cta.title}
              </h2>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-700">
                {content.cta.description}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="bg-slate-950 text-white hover:bg-slate-800"
              >
                <Link href={whatsappHref} target="_blank" rel="noreferrer">
                  <MessageCircle className="h-4 w-4" />
                  {content.cta.primary}
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-slate-900/30 bg-transparent text-slate-950 hover:bg-white/50"
              >
                <Link href={`/${locale}/contact`}>
                  {content.cta.secondary}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

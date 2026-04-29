import Image from "next/image";
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
    <main className="mx-auto max-w-7xl px-6 py-8 md:py-12">
      <section className="grid gap-6 rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(28,25,23,0.82))] px-6 py-8 md:px-8 md:py-10 lg:grid-cols-[minmax(0,1.02fr)_minmax(300px,0.98fr)] lg:items-center">
        <div className="max-w-4xl space-y-4">
          <p className="text-sm uppercase tracking-[0.2em] text-amber-200/80">
            {content.nav.about}
          </p>
          <h1 className="text-4xl font-semibold text-white md:text-5xl">
            {content.aboutPage.introTitle}
          </h1>
          <p className="text-lg leading-8 text-slate-300">{content.aboutPage.introBody}</p>
        </div>

        <div className="relative min-h-[280px] overflow-hidden rounded-2xl border border-white/10">
          <Image
            src="/marketing/about-lead.png"
            alt="Grounded local care moment"
            fill
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,14,23,0.1),rgba(9,14,23,0.72)_78%,rgba(9,14,23,0.9))]" />
          <div className="absolute inset-x-0 bottom-0 p-5">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-amber-200/85">
              Local, respectful, accountable
            </p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-100">
              The business should feel human and serious without becoming promotional.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-12 grid gap-4 lg:grid-cols-3">
        {content.aboutPage.values.map((value) => (
          <Card
            key={value.title}
            className="border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(12,18,31,0.92))] text-white"
          >
            <CardHeader>
              <CardTitle>{value.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-7 text-slate-300">
              {value.body}
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-10 rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6">
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

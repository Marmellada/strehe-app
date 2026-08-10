import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContactRequestForm } from "@/components/marketing/ContactRequestForm";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  buildWhatsAppMessage,
  getCompanyProfile,
  toWhatsAppHref,
} from "@/lib/marketing/company-profile";
import { isMarketingLocale, marketingContent } from "@/lib/marketing/content";

type ContactPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function ContactPage({ params }: ContactPageProps) {
  const { locale } = await params;

  if (!isMarketingLocale(locale)) {
    notFound();
  }

  const content = marketingContent[locale];
  const company = await getCompanyProfile();
  const pricingLine = locale === "sq"
    ? "Paketat fillojnë nga €450 për 6 muaj (≈ €75/muaj) ose €840 për 12 muaj (≈ €70/muaj). Zgjedhja e duhur varet nga sa shpesh dëshironi të vizitohet apartamenti."
    : locale === "de"
    ? "Pakete ab €450 für 6 Monate (≈ €75/Monat) oder €840 für 12 Monate (≈ €70/Monat). Die richtige Wahl hängt von der gewünschten Besuchshäufigkeit ab."
    : "Packages from €450 for 6 months (≈ €75/month) or €840 for 12 months (≈ €70/month). The right setup depends on the visit frequency and support your apartment needs.";
  const whatsappHref = toWhatsAppHref(
    company.phone,
    buildWhatsAppMessage({
      page: "contact",
      locale,
      message: content.contactPage.introBody,
    })
  );

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 md:py-12">
      <section className="grid gap-6 rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(28,25,23,0.82))] px-6 py-8 md:px-8 md:py-10 lg:grid-cols-[minmax(0,1.02fr)_minmax(300px,0.98fr)] lg:items-center">
        <div className="max-w-4xl space-y-4">
          <p className="text-sm uppercase tracking-[0.2em] text-amber-200/80">
            {content.nav.contact}
          </p>
          <h1 className="text-4xl font-semibold text-white md:text-5xl">
            {content.contactPage.introTitle}
          </h1>
          <p className="text-lg leading-8 text-slate-300">{content.contactPage.introBody}</p>
        </div>

        <div className="relative min-h-[280px] overflow-hidden rounded-2xl border border-white/10">
          <Image
            src="/marketing/key-handling.png"
            alt="Careful key and access handling"
            fill
            priority
            sizes="(min-width: 1024px) 48vw, 100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,14,23,0.1),rgba(9,14,23,0.72)_78%,rgba(9,14,23,0.9))]" />
          <div className="absolute inset-x-0 bottom-0 p-5">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-amber-200/85">
              {content.contactPage.methodsTitle}
            </p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-100">
              {content.contactPage.methods[0].description}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-6">
            <h2 className="text-2xl font-semibold text-white">
              {content.contactPage.methodsTitle}
            </h2>
            <div className="mt-5 grid gap-4">
              {content.contactPage.methods.map((method) => (
                <Card
                  key={method.title}
                  className="border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(12,18,31,0.92))] text-white"
                >
                  <CardHeader>
                    <CardTitle>{method.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm leading-7 text-slate-300">
                    {method.description}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(12,18,31,0.92))] p-6">
            <p className="text-lg font-semibold text-white">{company.companyName}</p>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              <p>{company.email}</p>
              <p>{company.phone}</p>
              <p>
                {company.city}, {company.country}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild>
                <Link href={whatsappHref} target="_blank" rel="noreferrer">
                  {content.cta.primary}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <a href={`mailto:${company.email}`}>{content.nav.contact}</a>
              </Button>
            </div>
          </div>
        </div>

        <ContactRequestForm
          email={company.email}
          title={content.contactPage.formTitle}
          description={content.contactPage.formBody}
          pricingLine={pricingLine}
          labels={content.contactPage.formLabels}
          options={content.contactPage.formOptions}
          helper={content.contactPage.helper}
          feedback={content.contactPage.feedback}
          locale={locale}
        />
      </section>
    </main>
  );
}

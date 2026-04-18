import Link from "next/link";
import { notFound } from "next/navigation";
import { ContactRequestForm } from "@/components/marketing/ContactRequestForm";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { getCompanyProfile, toWhatsAppHref } from "@/lib/marketing/company-profile";
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
  const whatsappHref = toWhatsAppHref(company.phone, content.contactPage.introBody);

  return (
    <main className="mx-auto max-w-7xl px-6 py-16">
      <div className="max-w-4xl space-y-4">
        <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
          {content.nav.contact}
        </p>
        <h1 className="text-4xl font-semibold text-white md:text-5xl">
          {content.contactPage.introTitle}
        </h1>
        <p className="text-lg leading-8 text-slate-300">{content.contactPage.introBody}</p>
      </div>

      <section className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-semibold text-white">
              {content.contactPage.methodsTitle}
            </h2>
            <div className="mt-5 grid gap-4">
              {content.contactPage.methods.map((method) => (
                <Card key={method.title} className="border-white/10 bg-slate-900 text-white">
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

          <div className="rounded-2xl border border-white/10 bg-slate-900 p-6">
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
          labels={content.contactPage.formLabels}
          options={content.contactPage.formOptions}
          helper={content.contactPage.helper}
        />
      </section>
    </main>
  );
}

import Link from "next/link";

export type LegalSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export type LegalDocument = {
  title: string;
  effectiveDate: string;
  albanian: LegalSection[];
  english: LegalSection[];
};

function LanguageSections({
  label,
  sections,
}: {
  label: string;
  sections: LegalSection[];
}) {
  return (
    <section className="space-y-8" aria-label={label}>
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-300">
        {label}
      </p>
      {sections.map((section) => (
        <section key={section.title} className="space-y-3">
          <h2 className="text-xl font-semibold text-white">{section.title}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="leading-7 text-slate-300">{paragraph}</p>
          ))}
          {section.bullets ? (
            <ul className="list-disc space-y-2 pl-5 leading-7 text-slate-300">
              {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
            </ul>
          ) : null}
        </section>
      ))}
    </section>
  );
}

export function LegalPage({ document }: { document: LegalDocument }) {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-slate-950/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Link href="/sq" className="text-lg font-semibold tracking-wide text-white">STREHË</Link>
          <nav className="flex flex-wrap gap-4 text-sm text-slate-300" aria-label="Legal navigation">
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <Link href="/data-deletion" className="hover:text-white">Data deletion</Link>
          </nav>
        </div>
      </header>
      <article className="mx-auto max-w-4xl space-y-12 px-6 py-14 md:py-20">
        <header className="space-y-3 border-b border-white/10 pb-10">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-300">STREHË Prona</p>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">{document.title}</h1>
          <p className="text-slate-400">Data e hyrjes në fuqi / Effective date: {document.effectiveDate}</p>
        </header>
        <LanguageSections label="Shqip" sections={document.albanian} />
        <div className="border-t border-white/10" />
        <LanguageSections label="English" sections={document.english} />
      </article>
      <footer className="border-t border-white/10 px-6 py-8 text-center text-sm text-slate-400">
        © STREHË Prona · <a className="hover:text-white" href="mailto:info@streheprona.com">info@streheprona.com</a>
      </footer>
    </main>
  );
}

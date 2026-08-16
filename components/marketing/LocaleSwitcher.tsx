"use client";

import { usePathname } from "next/navigation";
import { marketingContent, marketingLocales, type MarketingLocale } from "@/lib/marketing/content";

type LocaleSwitcherProps = {
  locale: MarketingLocale;
};

export function LocaleSwitcher({ locale }: LocaleSwitcherProps) {
  const pathname = usePathname() || `/${locale}`;
  const segments = pathname.split("/").filter(Boolean);
  const path = segments.length <= 1 ? "" : `/${segments.slice(1).join("/")}`;

  return (
    <div className="flex items-center gap-2">
      {marketingLocales.map((candidate) => {
        const active = candidate === locale;

        return (
          <a
            key={candidate}
            href={`/${candidate}${path}`}
            className={[
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              active
                ? "border-white/30 bg-white text-slate-950"
                : "border-white/15 !text-slate-300 hover:border-white/30 hover:!text-white",
            ].join(" ")}
          >
            {marketingContent[candidate].localeLabel}
          </a>
        );
      })}
    </div>
  );
}

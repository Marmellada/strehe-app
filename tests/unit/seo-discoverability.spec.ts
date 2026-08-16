import { expect, test } from "@playwright/test";
import { NextRequest } from "next/server";
import { buildRobotsPolicy, PRIVATE_ROUTE_PREFIXES } from "@/lib/marketing/indexing";
import {
  APP_SITE_HOST,
  PUBLIC_SITE_URL,
  buildMarketingMetadata,
  buildPublicSitemap,
  buildStructuredData,
  getLocalizedMarketingPath,
  marketingPageSlugs,
} from "@/lib/marketing/seo";
import { marketingLocales } from "@/lib/marketing/content";
import { isInvalidPublicPath, proxy } from "@/proxy";

test.describe("AI and search discoverability", () => {
  test("defines the exact 21-URL public sitemap without fabricated lastmod", () => {
    const sitemap = buildPublicSitemap();
    const expectedUrls = [
      ...marketingPageSlugs.flatMap((page) =>
        marketingLocales.map(
          (locale) =>
            `${PUBLIC_SITE_URL}${getLocalizedMarketingPath(locale, page)}`
        )
      ),
      `${PUBLIC_SITE_URL}/privacy`,
      `${PUBLIC_SITE_URL}/terms`,
      `${PUBLIC_SITE_URL}/data-deletion`,
    ];

    expect(sitemap).toHaveLength(21);
    expect(sitemap.map(({ url }) => url).sort()).toEqual(expectedUrls.sort());
    expect(sitemap.every(({ lastModified }) => lastModified === undefined)).toBe(true);
    expect(
      sitemap.some(({ url }) =>
        /\/(auth|api|dashboard|billing|clients|tasks|properties)(\/|$)/.test(url)
      )
    ).toBe(false);
  });

  test("builds self canonicals and equivalent hreflang URLs for all 18 pages", () => {
    const titlesByLocale = new Map<string, Set<string>>();

    for (const locale of marketingLocales) {
      const titles = new Set<string>();

      for (const page of marketingPageSlugs) {
        const metadata = buildMarketingMetadata(locale, page);
        const path = getLocalizedMarketingPath(locale, page);
        const expectedCanonical = `${PUBLIC_SITE_URL}${path}`;

        expect(metadata.alternates?.canonical).toBe(expectedCanonical);
        expect(metadata.alternates?.languages).toEqual(
          Object.fromEntries(
            marketingLocales.map((candidate) => [
              candidate,
              `${PUBLIC_SITE_URL}${getLocalizedMarketingPath(candidate, page)}`,
            ])
          )
        );
        expect(typeof metadata.title).toBe("string");
        expect(typeof metadata.description).toBe("string");
        titles.add(metadata.title as string);
      }

      titlesByLocale.set(locale, titles);
    }

    for (const titles of titlesByLocale.values()) {
      expect(titles.size).toBe(marketingPageSlugs.length);
    }
  });

  test("allows public crawlers while keeping application routes out of scope", () => {
    const publicPolicy = buildRobotsPolicy("www.streheprona.com");
    const publicRules = Array.isArray(publicPolicy.rules)
      ? publicPolicy.rules
      : [publicPolicy.rules];

    expect(publicPolicy.sitemap).toBe(`${PUBLIC_SITE_URL}/sitemap.xml`);
    expect(publicRules.some(({ userAgent }) => userAgent === "OAI-SearchBot")).toBe(true);
    expect(
      publicRules.some(
        ({ userAgent }) => Array.isArray(userAgent) && userAgent.includes("Googlebot") && userAgent.includes("Bingbot")
      )
    ).toBe(true);
    expect(publicRules.some(({ userAgent }) => userAgent === "*")).toBe(true);
    expect(publicRules.some(({ userAgent }) => userAgent === "GPTBot")).toBe(false);
    expect(
      publicRules.every(({ disallow }) =>
        PRIVATE_ROUTE_PREFIXES.every((path) =>
          Array.isArray(disallow) ? disallow.includes(path) : false
        )
      )
    ).toBe(true);

    const appPolicy = buildRobotsPolicy(APP_SITE_HOST);
    expect(appPolicy.rules).toEqual({ userAgent: "*", disallow: "/" });
    expect(appPolicy.sitemap).toBeUndefined();
  });

  test("structured data contains only verified WebSite and Organization fields", () => {
    const data = buildStructuredData({
      companyName: "STREHË",
      email: "info@streheprona.com",
      phone: "+383 44 800 047",
      city: "Prishtina",
      country: "Kosovo",
      logoUrl: null,
    });
    const serialized = JSON.stringify(data);

    expect(JSON.parse(serialized)).toEqual(data);
    expect(data["@graph"].map((entry) => entry["@type"])).toEqual([
      "WebSite",
      "Organization",
    ]);
    expect(serialized).not.toMatch(
      /Review|AggregateRating|Offer|LocalBusiness|openingHours|foundingDate|employee/
    );
  });

  test("separates invalid public paths from legitimate application roots", () => {
    for (const path of [
      "/fr",
      "/en/not-a-real-page",
      "/sq/not-a-real-page",
      "/de/not-a-real-page",
    ]) {
      expect(isInvalidPublicPath(path)).toBe(true);
    }

    for (const path of [
      "/en/services",
      "/sq/packages",
      "/privacy",
      "/auth/login",
      "/dashboard",
      "/billing/123",
      "/inspection-lab/bathroom-base-shot",
    ]) {
      expect(isInvalidPublicPath(path)).toBe(false);
    }
  });

  test("proxy preserves public 404 fallthrough, locale headers, and app noindex", async () => {
    const invalidResponse = await proxy(
      new NextRequest("https://www.streheprona.com/en/not-a-real-page")
    );
    expect(invalidResponse.headers.get("location")).toBeNull();
    expect(
      invalidResponse.headers.get("x-middleware-request-x-strehe-surface")
    ).toBe("public");
    expect(
      invalidResponse.headers.get("x-middleware-request-x-strehe-locale")
    ).toBe("en");

    const albanianResponse = await proxy(
      new NextRequest("https://www.streheprona.com/sq/services")
    );
    expect(
      albanianResponse.headers.get("x-middleware-request-x-strehe-locale")
    ).toBe("sq");

    const appLoginResponse = await proxy(
      new NextRequest("https://app.streheprona.com/auth/login")
    );
    expect(appLoginResponse.headers.get("x-robots-tag")).toBe(
      "noindex, nofollow"
    );
  });
});

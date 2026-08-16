import { expect, test, type Page } from "@playwright/test";

const contactAttributionFields = [
  "source_detail",
  "campaign_name",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "click_id",
  "landing_locale",
  "landing_page",
] as const;

async function submittedContactAttribution(page: Page) {
  return page.locator("form").evaluate((form, fields) => {
    const formData = new FormData(form as HTMLFormElement);
    return Object.fromEntries(
      fields.map((field) => [field, formData.get(field)])
    );
  }, contactAttributionFields);
}

const locales = [
  {
    code: "sq",
    homeHeading: /Apartamenti juaj në Kosovë/i,
    packagesHeading: /Tri paketa të qarta/i,
    servicesHeading: /Shërbime shtesë për apartamentin/i,
    howHeading: /Një proces i thjeshtë/i,
    aboutHeading: /Shërbim lokal për pronarët/i,
    contactHeading: /Filloni me një pyetje të thjeshtë/i,
    ctaName: "Na shkruani në WhatsApp",
    submitName: "Dërgo kërkesën",
    fallbackName: "Dërgo me email",
    packagesLinkName: "Paketat",
  },
  {
    code: "en",
    homeHeading: /Trusted local care for your apartment/i,
    packagesHeading: /Three clear packages/i,
    servicesHeading: /Additional services for your apartment/i,
    howHeading: /A simple process/i,
    aboutHeading: /A local service for owners/i,
    contactHeading: /Start with a simple question/i,
    ctaName: "Ask us a quick question on WhatsApp",
    submitName: "Send request",
    fallbackName: "Send by email",
    packagesLinkName: "Packages",
  },
  {
    code: "de",
    homeHeading: /Verlässliche lokale Betreuung/i,
    packagesHeading: /Drei klare Pakete/i,
    servicesHeading: /Zusätzliche Leistungen/i,
    howHeading: /Ein einfacher Ablauf/i,
    aboutHeading: /Ein lokaler Service für Eigentümer/i,
    contactHeading: /Beginnen Sie mit einer einfachen Frage/i,
    ctaName: "Schreiben Sie uns kurz auf WhatsApp",
    submitName: "Anfrage senden",
    fallbackName: "Per E-Mail senden",
    packagesLinkName: "Pakete",
  },
] as const;

test.describe("public website launch smoke", () => {
  test("root opens Albanian first with SEO metadata", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL(/\/sq$/);

    await expect(page.getByRole("heading", { name: locales[0].homeHeading })).toBeVisible();
    await expect(page).toHaveTitle(/STREHË/);

    const description = await page
      .locator('meta[name="description"]')
      .getAttribute("content");
    expect(description || "").toContain("apartament");
  });

  for (const locale of locales) {
    test(`${locale.code} routes, WhatsApp CTA, login path, and contact form render`, async ({
      page,
    }) => {
      await page.goto(`/${locale.code}`);
      await expect(page.getByRole("heading", { name: locale.homeHeading })).toBeVisible();

      const whatsappLink = page.getByRole("link", { name: locale.ctaName }).first();
      await expect(whatsappLink).toBeVisible();
      const whatsappHref = decodeURIComponent(
        (await whatsappLink.getAttribute("href")) || ""
      );
      expect(whatsappHref).toContain("https://wa.me/");
      expect(whatsappHref).toContain("Source: website_home");
      expect(whatsappHref).toContain(`Language: ${locale.code}`);

      await expect(page.getByRole("link", { name: /Portal|Hyrja|Login/ }).first()).toHaveAttribute(
        "href",
        "https://app.streheprona.com/auth/login?next=/dashboard"
      );

      await page.goto(`/${locale.code}/packages`);
      await expect(page.getByRole("heading", { name: locale.packagesHeading })).toBeVisible();

      await page.goto(`/${locale.code}/services`);
      await expect(page.getByRole("heading", { name: locale.servicesHeading })).toBeVisible();

      await page.goto(`/${locale.code}/how-it-works`);
      await expect(page.getByRole("heading", { name: locale.howHeading })).toBeVisible();

      await page.goto(`/${locale.code}/about`);
      await expect(page.getByRole("heading", { name: locale.aboutHeading })).toBeVisible();

      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/${locale.code}/contact`);
      await expect(page.getByRole("heading", { name: locale.contactHeading })).toBeVisible();
      await expect(page.getByRole("button", { name: locale.submitName })).toBeVisible();

      const emailFallback = page.getByRole("link", { name: locale.fallbackName });
      await expect(emailFallback).toBeVisible();
      await expect(emailFallback).toHaveAttribute("href", /^mailto:/);
    });
  }

  test("language switcher performs locale-correct full-document navigation", async ({ page }) => {
    const transitions = [
      { from: "/en", to: "/sq", label: "SQ", lang: "sq", heading: locales[0].homeHeading },
      { from: "/sq", to: "/de", label: "DE", lang: "de", heading: locales[2].homeHeading },
      { from: "/de", to: "/en", label: "EN", lang: "en", heading: locales[1].homeHeading },
      { from: "/en/services", to: "/sq/services", label: "SQ", lang: "sq", heading: locales[0].servicesHeading },
      { from: "/sq/packages", to: "/de/packages", label: "DE", lang: "de", heading: locales[2].packagesHeading },
      { from: "/de/how-it-works", to: "/en/how-it-works", label: "EN", lang: "en", heading: locales[1].howHeading },
    ] as const;

    for (const transition of transitions) {
      await page.goto(transition.from);

      const [documentResponse] = await Promise.all([
        page.waitForResponse(
          (response) =>
            response.request().resourceType() === "document" &&
            new URL(response.url()).pathname === transition.to
        ),
        page.getByRole("link", { name: transition.label, exact: true }).first().click(),
      ]);

      expect(documentResponse.status()).toBe(200);
      await expect(page).toHaveURL(new RegExp(`${transition.to}$`));
      await expect(page.locator("html")).toHaveAttribute("lang", transition.lang);
      await expect(page.getByRole("heading", { name: transition.heading })).toBeVisible();
    }
  });

  test("localized pages expose unique metadata, equivalent hreflang, and document language", async ({
    browser,
    baseURL,
  }) => {
    const pagePaths = ["", "/packages", "/services", "/how-it-works", "/about", "/contact"];

    for (const locale of locales) {
      const titles = new Set<string>();

      for (const pagePath of pagePaths) {
        const path = `/${locale.code}${pagePath}`;
        const context = await browser.newContext();
        const page = await context.newPage();

        try {
          const response = await page.goto(new URL(path, baseURL).toString());
          expect(response?.status()).toBe(200);
          await expect(page.locator("html")).toHaveAttribute("lang", locale.code);

          const title = await page.title();
          const description = await page.locator('meta[name="description"]').getAttribute("content");
          expect(title).toContain("STREHË");
          expect(description?.trim().length).toBeGreaterThan(60);
          titles.add(title);

          await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
            "href",
            `https://www.streheprona.com${path}`
          );

          for (const alternate of locales) {
            await expect(
              page.locator(`link[rel="alternate"][hreflang="${alternate.code}"]`)
            ).toHaveAttribute(
              "href",
              `https://www.streheprona.com/${alternate.code}${pagePath}`
            );
          }
        } finally {
          await context.close();
        }
      }

      expect(titles.size).toBe(pagePaths.length);
    }
  });

  test("robots, sitemap, legal canonicals, and structured data are valid", async ({
    page,
    request,
  }) => {
    const robotsResponse = await request.get("/robots.txt");
    expect(robotsResponse.status()).toBe(200);
    const robots = await robotsResponse.text();
    expect(robots).toContain("User-Agent: OAI-SearchBot");
    expect(robots).toContain("User-Agent: Googlebot");
    expect(robots).toContain("User-Agent: Bingbot");
    expect(robots).toContain("User-Agent: *");
    expect(robots).toContain("Sitemap: https://www.streheprona.com/sitemap.xml");

    const sitemapResponse = await request.get("/sitemap.xml");
    expect(sitemapResponse.status()).toBe(200);
    const sitemap = await sitemapResponse.text();
    const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      (match) => match[1]
    );
    expect(sitemapUrls).toHaveLength(21);
    expect(new Set(sitemapUrls).size).toBe(21);
    expect(sitemap).not.toContain("<lastmod>");
    expect(sitemap).not.toMatch(/\/(auth|api|dashboard|billing|tasks|properties)(\/|<)/);

    for (const legalPath of ["/privacy", "/terms", "/data-deletion"]) {
      await page.goto(legalPath);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        `https://www.streheprona.com${legalPath}`
      );
    }

    await page.goto("/en");
    const jsonLd = await page.locator('script[type="application/ld+json"]').textContent();
    const structuredData = JSON.parse(jsonLd || "{}");
    expect(structuredData["@graph"].map((entry: { "@type": string }) => entry["@type"])).toEqual([
      "WebSite",
      "Organization",
    ]);
    expect(jsonLd).not.toMatch(/Review|AggregateRating|Offer|LocalBusiness|openingHours/);
  });

  test("invalid public routes are real 404s and app-host responses are noindex", async ({
    page,
    request,
  }) => {
    for (const path of [
      "/fr",
      "/en/not-a-real-page",
      "/sq/not-a-real-page",
      "/de/not-a-real-page",
    ]) {
      const response = await page.goto(path);
      const status = response?.status();
      expect([200, 404, 410]).toContain(status);

      if (status === 200) {
        const metaRobots = await page
          .locator('meta[name="robots"]')
          .getAttribute("content");
        const headerRobots = response?.headers()["x-robots-tag"] ?? "";
        expect(`${metaRobots ?? ""} ${headerRobots}`).toMatch(/noindex/i);
      }

      expect(page.url()).not.toContain("/auth/login");
    }

    for (const path of ["/auth/login", "/dashboard"]) {
      const response = await request.get(path, {
        headers: { "x-forwarded-host": "app.streheprona.com" },
        maxRedirects: 0,
      });
      expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow");
    }

    const appRobotsResponse = await request.get("/robots.txt", {
      headers: { "x-forwarded-host": "app.streheprona.com" },
    });
    expect(await appRobotsResponse.text()).toContain("Disallow: /");
  });

  test("contact attribution survives controlled rerenders and validation feedback", async ({
    page,
  }) => {
    const landingPage =
      "/sq/contact?utm_source=production-smoke-test&utm_medium=controlled-deployment&utm_campaign=b1-notification";
    const expectedAttribution = {
      source_detail: "https://partner.example/campaign",
      campaign_name: "b1-notification",
      utm_source: "production-smoke-test",
      utm_medium: "controlled-deployment",
      utm_campaign: "b1-notification",
      utm_content: "",
      utm_term: "",
      click_id: "",
      landing_locale: "sq",
      landing_page: landingPage,
    };

    await page.goto(landingPage, {
      referer: expectedAttribution.source_detail,
    });
    await expect(page.locator('input[name="landing_page"]')).toHaveValue(
      landingPage
    );

    await page.getByLabel("Emri", { exact: true }).fill("STREHE Attribution Test");
    await page
      .getByLabel("Email ose telefon", { exact: true })
      .fill("attribution-test@example.com");
    await page.getByLabel("A jetoni jashtë?", { exact: true }).selectOption("yes");
    await page
      .getByLabel("Shteti ku jetoni", { exact: true })
      .fill("Regression test");
    await page
      .getByLabel("Zona e apartamentit", { exact: true })
      .fill("First controlled edit");
    await page
      .getByLabel("Mesazhi", { exact: true })
      .fill("Attribution must survive every rerender.");

    expect(await submittedContactAttribution(page)).toEqual(
      expectedAttribution
    );

    await page
      .getByLabel("Zona e apartamentit", { exact: true })
      .fill("Second controlled edit");
    await page
      .getByLabel("Mesazhi", { exact: true })
      .fill("Attribution still survives multiple edits.");

    expect(await submittedContactAttribution(page)).toEqual(
      expectedAttribution
    );

    await page.getByLabel("Emri", { exact: true }).fill("---");
    await page.getByRole("button", { name: "Dërgo kërkesën" }).click();
    await expect(
      page.getByText(
        "Ju lutemi shkruani një emër dhe email ose telefon të vlefshëm."
      )
    ).toBeVisible();

    expect(await submittedContactAttribution(page)).toEqual(
      expectedAttribution
    );
  });

  test("contact form without UTM parameters retains locale and landing page", async ({
    page,
  }) => {
    await page.goto("/sq/contact");
    await expect(page.locator('input[name="landing_page"]')).toHaveValue(
      "/sq/contact"
    );

    await page.getByLabel("Emri", { exact: true }).fill("STREHE No UTM Test");
    await page
      .getByLabel("Email ose telefon", { exact: true })
      .fill("no-utm-test@example.com");
    await page.getByLabel("A jetoni jashtë?", { exact: true }).selectOption("no");
    await page
      .getByLabel("Shteti ku jetoni", { exact: true })
      .fill("No campaign");
    await page
      .getByLabel("Zona e apartamentit", { exact: true })
      .fill("No UTM landing");
    await page
      .getByLabel("Mesazhi", { exact: true })
      .fill("No attribution parameters are expected.");

    expect(await submittedContactAttribution(page)).toEqual({
      source_detail: "",
      campaign_name: "",
      utm_source: "",
      utm_medium: "",
      utm_campaign: "",
      utm_content: "",
      utm_term: "",
      click_id: "",
      landing_locale: "sq",
      landing_page: "/sq/contact",
    });
  });

  test("Albanian conversion sections show concrete service and visit-report details", async ({
    page,
  }) => {
    await page.goto("/sq");

    await expect(
      page.getByRole("heading", {
        name: /Dikush kujdeset për apartamentin tuaj/i,
      })
    ).toBeVisible();
    await expect(page.getByText("Shembull ilustrues i raportit")).toBeVisible();
    await expect(page.getByText("18 korrik 2026")).toBeVisible();
    await expect(page.getByText(/Rrjedhje e lehtë nën lavaman/i)).toBeVisible();
    await expect(page.getByText(/aktualisht po regjistron interesin/i)).toBeVisible();

    await page.goto("/sq/packages");
    await expect(page.getByRole("heading", { name: "Essential Check" })).toBeVisible();
    await expect(page.getByText("€450")).toBeVisible();
    await expect(page.getByText("€840")).toBeVisible();

    await page.goto("/sq/services");
    await expect(page.getByRole("heading", { name: "Home Refresh" })).toBeVisible();
    await expect(page.getByText(/Lyhje & Rifreskim Muresh/i)).toBeVisible();
    await expect(page.getByRole("link", { name: "Na shkruani në WhatsApp" })).toBeVisible();
  });

  test("public legal routes render bilingual legal content and app surfaces remain protected", async ({
    page,
  }) => {
    const legalRoutes = [
      { path: "/privacy", documentHeading: "Politika e Privatësisë / Privacy Policy" },
      { path: "/terms", documentHeading: "Kushtet e Përdorimit / Terms of Use" },
      { path: "/data-deletion", documentHeading: "Fshirja e të Dhënave / Data Deletion Instructions" },
    ];

    for (const legalRoute of legalRoutes) {
      const response = await page.goto(legalRoute.path);
      expect(response?.status()).toBe(200);

      const main = page.locator("main");
      await expect(main.getByRole("heading", { level: 1 })).toHaveText(
        legalRoute.documentHeading
      );
      await expect(main).toContainText("Data e hyrjes në fuqi / Effective date: 15 August 2026");

      const languageSections = main.locator("article > section[aria-label]");
      await expect(languageSections).toHaveCount(2);
      await expect(languageSections.nth(0)).toHaveAttribute("aria-label", "Shqip");
      await expect(languageSections.nth(1)).toHaveAttribute("aria-label", "English");
    }

    for (const protectedPath of ["/dashboard", "/subscriptions", "/clients"]) {
      await page.goto(protectedPath);
      await expect(page).toHaveURL(new RegExp(`/auth/login\\?next=${encodeURIComponent(protectedPath)}`));
    }
  });
});

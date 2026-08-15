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

  test("language switcher preserves the current marketing page", async ({ page }) => {
    await page.goto("/sq/services");
    await expect(page.getByRole("heading", { name: locales[0].servicesHeading })).toBeVisible();

    await page.getByRole("link", { name: "EN", exact: true }).click();
    await page.waitForURL(/\/en\/services$/);
    await expect(page.getByRole("heading", { name: locales[1].servicesHeading })).toBeVisible();

    await page.getByRole("link", { name: "DE", exact: true }).click();
    await page.waitForURL(/\/de\/services$/);
    await expect(page.getByRole("heading", { name: locales[2].servicesHeading })).toBeVisible();
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
      { path: "/privacy", albanianHeading: "Politika e Privatësisë", englishHeading: "Privacy Policy" },
      { path: "/terms", albanianHeading: "Kushtet e Përdorimit", englishHeading: "Terms of Use" },
      { path: "/data-deletion", albanianHeading: "Fshirja e të Dhënave", englishHeading: "Data Deletion" },
    ];

    for (const legalRoute of legalRoutes) {
      const response = await page.goto(legalRoute.path);
      expect(response?.status()).toBe(200);

      const main = page.locator("main");
      await expect(main).toContainText("Data e hyrjes në fuqi / Effective date: 15 August 2026");
      await expect(main).toContainText("Milot Berisha");

      const languageSections = main.locator("article > section[aria-label]");
      await expect(languageSections).toHaveCount(2);
      await expect(languageSections.nth(0)).toHaveAttribute("aria-label", "Shqip");
      await expect(languageSections.nth(1)).toHaveAttribute("aria-label", "English");
      await expect(languageSections.nth(0)).toContainText(legalRoute.albanianHeading);
      await expect(languageSections.nth(1)).toContainText(legalRoute.englishHeading);
    }

    for (const protectedPath of ["/dashboard", "/subscriptions", "/clients"]) {
      await page.goto(protectedPath);
      await expect(page).toHaveURL(new RegExp(`/auth/login\\?next=${encodeURIComponent(protectedPath)}`));
    }
  });
});

import { expect, test } from "@playwright/test";

const locales = [
  {
    code: "sq",
    homeHeading: /Apartamenti juaj në Kosovë/i,
    servicesHeading: /Kujdes i rregullt për apartamentin tuaj/i,
    howHeading: /Një proces i thjeshtë/i,
    aboutHeading: /Shërbim lokal për pronarët/i,
    contactHeading: /Filloni me një pyetje të thjeshtë/i,
    ctaName: "Na shkruani në WhatsApp",
    submitName: "Dërgo kërkesën",
    fallbackName: "Dërgo me email",
  },
  {
    code: "en",
    homeHeading: /Trusted local care for your apartment/i,
    servicesHeading: /Practical support for apartments/i,
    howHeading: /A simple process/i,
    aboutHeading: /A local service for owners/i,
    contactHeading: /Start with a simple question/i,
    ctaName: "Ask us a quick question on WhatsApp",
    submitName: "Send request",
    fallbackName: "Send by email",
  },
  {
    code: "de",
    homeHeading: /Verlässliche lokale Betreuung/i,
    servicesHeading: /Praktische Unterstützung für Wohnungen/i,
    howHeading: /Ein einfacher Ablauf/i,
    aboutHeading: /Ein lokaler Service für Eigentümer/i,
    contactHeading: /Beginnen Sie mit einer einfachen Frage/i,
    ctaName: "Schreiben Sie uns kurz auf WhatsApp",
    submitName: "Anfrage senden",
    fallbackName: "Per E-Mail senden",
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

    await page.goto("/sq/services");
    await expect(page.getByRole("heading", { name: "Vizita të rregullta dhe raportim" })).toBeVisible();
    await expect(page.getByText("Kontroll për shenja lagështie ose dëmtimi")).toBeVisible();
    await expect(page.getByRole("link", { name: "Na shkruani në WhatsApp" })).toBeVisible();
  });
});

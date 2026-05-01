import { expect, test } from "@playwright/test";
import { createSmokeValue, selectOptionContainingText } from "./utils";

test.describe.serial("leads CRM smoke", () => {
  test.setTimeout(180_000);

  const seed = createSmokeValue("leads");
  const leadName = `Lead Client ${seed}`;
  const leadEmail = `${seed}@example.com`;
  const websiteLeadName = `Website Lead ${seed}`;
  const websiteLeadContact = `${seed}.website@example.com`;
  const whatsappLeadName = `WhatsApp Lead ${seed}`;
  const convertedPropertyTitle = `Converted Property ${seed}`;
  const note = `Lead follow-up note ${seed}`;
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const laterFollowUp = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  test("capture a public contact request as a lead", async ({ page }) => {
    await page.goto("/en");
    const whatsappLink = page.getByRole("link", {
      name: "Ask us a quick question on WhatsApp",
    }).first();
    await expect(whatsappLink).toBeVisible();
    const whatsappHref = await whatsappLink.getAttribute("href");
    expect(decodeURIComponent(whatsappHref || "")).toContain("Source: website_home");
    expect(decodeURIComponent(whatsappHref || "")).toContain("Language: en");

    await page.goto("/en/contact");
    await expect(
      page.getByRole("heading", { name: "Start with a simple question" })
    ).toBeVisible();

    await page.getByLabel("Name").fill(websiteLeadName);
    await page.getByLabel("Email or phone").fill(websiteLeadContact);
    await page.getByLabel("Apartment area").fill("Fushe Kosove");
    await page.getByLabel("Message").fill("Website CRM capture smoke request");
    await page.getByRole("button", { name: "Send request" }).click();

    await expect(page.getByText("now in our lead list")).toBeVisible({
      timeout: 15000,
    });

    await page.goto("/leads");
    await expect(page.getByRole("heading", { name: "Leads" })).toBeVisible();
    await page.getByLabel("Search").fill(websiteLeadName);
    await page.getByRole("button", { name: "Apply" }).click();
    const websiteLeadRow = page.getByRole("row").filter({ hasText: websiteLeadName });
    await expect(websiteLeadRow).toBeVisible();
    await expect(websiteLeadRow).toContainText("Website");
  });

  test("quick-create a WhatsApp lead with defaults", async ({ page }) => {
    await page.goto("/leads/new?source=whatsapp");
    await expect(page.getByRole("heading", { name: "New Lead" })).toBeVisible();
    await expect(page.getByLabel("Source")).toHaveValue("whatsapp");
    await expect(page.getByLabel("Preferred Contact")).toHaveValue("whatsapp");

    await page.getByLabel("Full Name").fill(whatsappLeadName);
    await page.getByLabel("Phone").fill("+38344111999");
    await page.getByRole("button", { name: "Create Lead" }).click();

    await page.waitForURL(/\/leads\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: whatsappLeadName })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText("Whatsapp").first()).toBeVisible();
  });

  test("create, update, note, and convert a lead", async ({ page }) => {
    await page.goto("/leads/new");
    await expect(page.getByRole("heading", { name: "New Lead" })).toBeVisible();

    await page.getByLabel("Full Name").fill(leadName);
    await page.getByLabel("Phone").fill("+38344111777");
    await page.getByLabel("Email").fill(leadEmail);
    await page.getByLabel("City").fill("Prishtina");
    await page.getByLabel("Source").selectOption("whatsapp");
    await page.getByLabel("Preferred Contact").selectOption("whatsapp");
    await page.getByLabel("Service Interest").selectOption("care_plus");
    await page.getByLabel("Estimated Monthly Value").fill("89.00");
    await page.getByLabel("Priority").selectOption("high");
    await page.getByLabel("Next Follow-up Date").fill(tomorrow);
    await page.getByLabel("Property Count").fill("2");
    await selectOptionContainingText(page.getByLabel("Assigned User"), "Playwright Admin");
    await page.getByLabel("Notes").fill("Asked about monthly apartment care.");
    await page.getByRole("button", { name: "Create Lead" }).click();

    await page.waitForURL(/\/leads\/[0-9a-f-]{36}$/);
    const leadUrl = new URL(page.url()).pathname;
    await expect(page.getByRole("heading", { name: leadName })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText("High")).toBeVisible();
    await expect(page.getByText("Care Plus")).toBeVisible();
    await expect(page.getByText("€89.00")).toBeVisible();
    await expect(page.getByText("Playwright Admin").first()).toBeVisible();

    await page.getByRole("link", { name: "Edit" }).click();
    await page.waitForURL(/\/leads\/[0-9a-f-]{36}\/edit$/);
    await page.getByLabel("Status").selectOption("interested");
    await page.getByRole("button", { name: "Update Lead" }).click();

    await expect(page).toHaveURL(new RegExp(`${leadUrl.replace(/\//g, "\\/")}$`), {
      timeout: 15000,
    });
    await expect(page.getByText("Interested").first()).toBeVisible();

    await page.getByLabel("Type", { exact: true }).selectOption("call");
    await page.getByLabel("Summary").fill(note);
    await page.getByLabel("Next Follow-up Date").fill(laterFollowUp);
    await page.getByRole("button", { name: "Add Note" }).click();
    await expect(page).toHaveURL(new RegExp(`${leadUrl.replace(/\//g, "\\/")}$`), {
      timeout: 15000,
    });
    await expect(page.getByText(note, { exact: true })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText("Call").first()).toBeVisible();
    await expect(page.getByText("Timeline")).toBeVisible();
    await expect(page.getByText("Status changed to interested")).toBeVisible();

    await page.getByLabel("Create Draft Property").selectOption("yes");
    await page.getByLabel("Property Title").fill(convertedPropertyTitle);
    await page.getByLabel("Property Address").fill("Converted Address 1");
    await page.getByRole("button", { name: "Convert with Options" }).click();
    await page.waitForURL(/\/properties\/[^/]+$/);
    await expect(page.getByRole("heading", { name: convertedPropertyTitle })).toBeVisible({
      timeout: 15000,
    });

    await page.goto("/leads");
    await expect(page.getByRole("heading", { name: "Leads" })).toBeVisible();
    await expect(page.getByRole("link", { name: leadName, exact: true })).toBeVisible();
    await page.getByLabel("Search").fill(leadName);
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByRole("link", { name: leadName, exact: true })).toBeVisible();
  });

  test("show CRM dashboard, follow-ups, and reports", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("CRM Follow-ups")).toBeVisible();
    await expect(page.getByText("New Leads").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Website Leads" })).toBeVisible();
    await expect(page.getByRole("link", { name: "New WhatsApp Lead" })).toBeVisible();

    await page.goto("/leads/follow-ups");
    await expect(page.getByRole("heading", { name: "Lead Follow-ups" })).toBeVisible();
    await expect(page.getByText("No Follow-up Set")).toBeVisible();

    await page.goto("/leads/reports");
    await expect(page.getByRole("heading", { name: "Lead Reports" })).toBeVisible();
    await expect(page.getByText("By Source")).toBeVisible();
  });
});

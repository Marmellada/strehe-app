import { expect, test } from "@playwright/test";
import { createSmokeValue, selectOptionContainingText } from "./utils";

test.describe.serial("leads CRM smoke", () => {
  test.setTimeout(90_000);

  const seed = createSmokeValue("leads");
  const leadName = `Lead Client ${seed}`;
  const leadEmail = `${seed}@example.com`;
  const note = `Lead follow-up note ${seed}`;
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  test("create, update, note, and convert a lead", async ({ page }) => {
    await page.goto("/leads/new");
    await expect(page.getByRole("heading", { name: "New Lead" })).toBeVisible();

    await page.getByLabel("Full Name").fill(leadName);
    await page.getByLabel("Phone").fill("+38344111777");
    await page.getByLabel("Email").fill(leadEmail);
    await page.getByLabel("City").fill("Prishtina");
    await page.getByLabel("Source").selectOption("whatsapp");
    await page.getByLabel("Priority").selectOption("high");
    await page.getByLabel("Next Follow-up Date").fill(tomorrow);
    await selectOptionContainingText(page.getByLabel("Assigned User"), "Playwright Admin");
    await page.getByLabel("Notes").fill("Asked about monthly apartment care.");
    await page.getByRole("button", { name: "Create Lead" }).click();

    await page.waitForURL(/\/leads\/[0-9a-f-]{36}$/);
    const leadUrl = new URL(page.url()).pathname;
    await expect(page.getByRole("heading", { name: leadName })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText("High")).toBeVisible();
    await expect(page.getByText("Playwright Admin").first()).toBeVisible();

    await page.getByRole("link", { name: "Edit" }).click();
    await page.waitForURL(/\/leads\/[0-9a-f-]{36}\/edit$/);
    await page.getByLabel("Status").selectOption("interested");
    await page.getByRole("button", { name: "Update Lead" }).click();

    await expect(page).toHaveURL(new RegExp(`${leadUrl.replace(/\//g, "\\/")}$`), {
      timeout: 15000,
    });
    await expect(page.getByText("Interested").first()).toBeVisible();

    await page.getByLabel("Type").selectOption("call");
    await page.getByLabel("Summary").fill(note);
    await page.getByRole("button", { name: "Add Note" }).click();
    await expect(page).toHaveURL(new RegExp(`${leadUrl.replace(/\//g, "\\/")}$`), {
      timeout: 15000,
    });
    await expect(page.getByText(note)).toBeVisible();
    await expect(page.getByText("Call").first()).toBeVisible();

    await page.getByRole("button", { name: "Convert to Client" }).click();
    await page.waitForURL(/\/clients\/[^/]+$/);
    await expect(page.getByRole("heading", { name: leadName })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(leadEmail).first()).toBeVisible();

    await page.goto("/leads");
    await expect(page.getByRole("heading", { name: "Leads" })).toBeVisible();
    await expect(page.getByRole("link", { name: leadName })).toBeVisible();
  });
});

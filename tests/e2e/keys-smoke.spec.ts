import { expect, test } from "@playwright/test";
import {
  createSmokeValue,
  selectFirstRealOption,
  selectOptionContainingText,
} from "./utils";

test.describe.serial("key custody smoke", () => {
  test.setTimeout(120_000);

  const seed = createSmokeValue("keys");
  const clientName = `Keys Client ${seed}`;
  const clientEmail = `${seed}@example.com`;
  const propertyTitle = `Keys Property ${seed}`;
  const keyName = `Keys Smoke Key ${seed}`;
  const assignNote = `Assigned during key smoke ${seed}`;
  const returnNote = `Returned during key smoke ${seed}`;
  const damagedNote = `Damaged during key smoke ${seed}`;

  let propertyUrl = "";
  let keyUrl = "";

  test("create property key and verify status history", async ({ page }) => {
    await page.goto("/clients/new");
    await expect(
      page.getByRole("heading", { name: /New Individual Client|Edit Client/ })
    ).toBeVisible();
    await page.getByLabel("Full Name").fill(clientName);
    await page.getByLabel("Phone").fill("+38344111444");
    await page.getByLabel("Email").fill(clientEmail);
    await selectFirstRealOption(page.getByLabel("Municipality"));
    const clientLocationSelect = page.getByLabel("Neighborhood / Village");
    if (!(await clientLocationSelect.isDisabled())) {
      await selectFirstRealOption(clientLocationSelect);
    }
    await page.getByLabel("Address Line 1").fill("Keys Smoke Street 1");
    await page.getByRole("button", { name: "Create Client" }).click();
    await page.waitForURL(/\/clients$/);

    await page.goto("/properties/new");
    await expect(
      page.getByRole("heading", { name: "New Property" })
    ).toBeVisible();
    await page.locator('input[name="title"]').fill(propertyTitle);
    await selectOptionContainingText(
      page.locator('select[name="owner_client_id"]'),
      clientName
    );
    await selectFirstRealOption(page.locator('select[name="municipality_id"]'));
    await selectFirstRealOption(page.locator('select[name="location_id"]'));
    await page
      .locator('input[name="address_line_1"]')
      .fill("Keys Smoke Property Address 1");
    await page.locator('select[name="property_type"]').selectOption("apartment");
    await page.getByRole("button", { name: "Save Property" }).click();

    await page.waitForURL(/\/properties$/);
    await page.getByLabel("Search").fill(propertyTitle);
    await page.getByRole("button", { name: "Apply" }).click();
    const propertyRow = page.getByRole("row").filter({ hasText: propertyTitle });
    await expect(propertyRow).toBeVisible();
    propertyUrl =
      (await propertyRow.getByRole("link", { name: "View" }).getAttribute("href")) ||
      "";

    if (!/^\/properties\/[0-9a-f-]{36}$/.test(propertyUrl)) {
      throw new Error(`Unexpected property href: ${propertyUrl}`);
    }

    await page.goto(propertyUrl);
    await expect(page.getByRole("heading", { name: propertyTitle })).toBeVisible();

    await page.goto(`${propertyUrl}/keys/new`);
    await expect(page.getByRole("heading", { name: "Add Key" })).toBeVisible();
    await page.locator('input[name="key_type"]').fill("Main door");
    await page.locator('input[name="storage_location"]').fill("Office Safe / Keys Smoke");
    await page.locator('input[name="name"]').fill(keyName);
    await page.locator('textarea[name="description"]').fill("Keys smoke description");
    await page.getByRole("button", { name: "Save Key" }).click();

    await page.waitForURL(/\/properties\/[^/]+\/keys$/);
    const keyRow = page.getByRole("row").filter({ hasText: keyName });
    await expect(keyRow).toBeVisible();
    await expect(keyRow).toContainText(/available/i);
    await Promise.all([
      page.waitForURL(/\/keys\/[^/]+$/),
      keyRow.getByRole("link", { name: "View" }).click(),
    ]);
    keyUrl = new URL(page.url()).pathname;
    await expect(page.getByRole("heading", { name: keyName })).toBeVisible();
    await expect(page.getByText("created", { exact: true })).toBeVisible();

    const assignForm = page.locator("form").filter({
      has: page.getByRole("button", { name: "Assign Key" }),
    });
    await selectFirstRealOption(assignForm.getByLabel("Assign To"));
    await assignForm.getByLabel("Note").fill(assignNote);
    await assignForm.getByRole("button", { name: "Assign Key" }).click();

    await page.waitForURL(keyUrl);
    await expect(page.getByText("assigned", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(assignNote)).toBeVisible();

    const returnForm = page.locator("form").filter({
      has: page.getByRole("button", { name: "Return Key" }),
    });
    await returnForm.locator('textarea[name="notes"]').fill(returnNote);
    await returnForm.getByRole("button", { name: "Return Key" }).click();

    await page.waitForURL(keyUrl);
    await expect(page.getByText("returned", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(returnNote)).toBeVisible();

    const damagedForm = page.locator("form").filter({
      has: page.getByRole("button", { name: "Mark as Damaged" }),
    });
    await damagedForm.locator('textarea[name="notes"]').fill(damagedNote);
    await damagedForm.getByRole("button", { name: "Mark as Damaged" }).click();

    await page.waitForURL(keyUrl);
    await expect(page.getByText("damaged", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(damagedNote)).toBeVisible();
  });
});

import { expect, test } from "@playwright/test";
import {
  createSmokeValue,
  selectFirstRealOption,
  selectOptionContainingText,
} from "./utils";

test.describe.serial("property integrity smoke", () => {
  test.setTimeout(60_000);

  const seed = createSmokeValue("property");
  const clientName = `Property Client ${seed}`;
  const clientEmail = `${seed}@example.com`;
  const propertyTitle = `Property Integrity ${seed}`;
  const updatedPropertyTitle = `Property Integrity Updated ${seed}`;
  const addressLine1 = `Property Address ${seed}`;
  const addressLine2 = `Apt ${seed.slice(-4)}`;
  const updatedAddressLine1 = `Updated Property Address ${seed}`;

  let propertyUrl = "";
  let municipalityLabel = "";
  let locationLabel = "";

  test("owner, location fields, and status lifecycle are visible", async ({
    page,
  }) => {
    await page.goto("/clients/new");
    await page.getByLabel("Full Name").fill(clientName);
    await page.getByLabel("Phone").fill("+38344111993");
    await page.getByLabel("Email").fill(clientEmail);
    await selectFirstRealOption(page.getByLabel("Municipality"));
    const clientLocationSelect = page.getByLabel("Neighborhood / Village");
    if (!(await clientLocationSelect.isDisabled())) {
      await selectFirstRealOption(clientLocationSelect);
    }
    await page.getByLabel("Address Line 1").fill("Owner Street 1");
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

    const municipalityValue = await selectFirstRealOption(
      page.locator('select[name="municipality_id"]')
    );
    municipalityLabel = await page
      .locator('select[name="municipality_id"]')
      .evaluate((node, value) => {
        if (!(node instanceof HTMLSelectElement)) return "";
        return Array.from(node.options).find((option) => option.value === value)
          ?.textContent || "";
      }, municipalityValue);

    const propertyLocationSelect = page.locator('select[name="location_id"]');
    await expect(propertyLocationSelect).toBeEnabled();
    const locationValue = await selectFirstRealOption(propertyLocationSelect);
    locationLabel = await propertyLocationSelect.evaluate((node, value) => {
      if (!(node instanceof HTMLSelectElement)) return "";
      return Array.from(node.options).find((option) => option.value === value)
        ?.textContent || "";
    }, locationValue);

    await page.locator('input[name="address_line_1"]').fill(addressLine1);
    await page.locator('input[name="address_line_2"]').fill(addressLine2);
    await page.locator('select[name="property_type"]').selectOption("apartment");
    await page.getByRole("button", { name: "Save Property" }).click();

    await page.waitForURL(/\/properties$/);
    await page.getByLabel("Search").fill(propertyTitle);
    await page.getByRole("button", { name: "Apply" }).click();

    const propertyRow = page.getByRole("row").filter({ hasText: propertyTitle });
    await expect(propertyRow).toBeVisible();
    await propertyRow.getByRole("link", { name: "View" }).click();

    await page.waitForURL(/\/properties\/[^/]+$/);
    propertyUrl = page.url();
    await expect(
      page.getByRole("heading", { name: propertyTitle })
    ).toBeVisible();
    await expect(page.getByText(clientName).first()).toBeVisible();
    await expect(page.getByText(municipalityLabel.trim()).first()).toBeVisible();
    await expect(page.getByText(locationLabel.trim()).first()).toBeVisible();
    await expect(page.getByText(addressLine1).first()).toBeVisible();
    await expect(page.getByText(addressLine2).first()).toBeVisible();
    await expect(page.getByText(/active/i).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "View Owner" })).toBeVisible();

    await page.goto(`${propertyUrl}/edit`);
    await expect(
      page.getByRole("heading", { name: "Edit Property" })
    ).toBeVisible();
    await page.locator('input[name="title"]').fill(updatedPropertyTitle);
    await page.locator('input[name="address_line_1"]').fill(updatedAddressLine1);
    await page.locator('select[name="status"]').selectOption("vacant");
    await page.getByRole("button", { name: "Save Changes" }).click();

    await page.waitForURL(propertyUrl);
    await expect(
      page.getByRole("heading", { name: updatedPropertyTitle })
    ).toBeVisible();
    await expect(page.getByText(updatedAddressLine1).first()).toBeVisible();
    await expect(page.getByText(/vacant/i).first()).toBeVisible();
  });
});

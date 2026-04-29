import { expect, test } from "@playwright/test";
import {
  createSmokeValue,
  selectFirstRealOption,
  selectOptionContainingText,
} from "./utils";

test.describe.serial("contract integrity smoke", () => {
  test.setTimeout(90_000);

  const seed = createSmokeValue("contract");
  const clientName = `Contract Client ${seed}`;
  const clientEmail = `${seed}@example.com`;
  const propertyTitle = `Contract Property ${seed}`;
  const today = new Date().toISOString().split("T")[0];

  let selectedPackageName = "";

  test("contract lifecycle, snapshots, and one-active-property guard work", async ({
    page,
  }) => {
    await page.goto("/clients/new");
    await page.getByLabel("Full Name").fill(clientName);
    await page.getByLabel("Phone").fill("+38344111992");
    await page.getByLabel("Email").fill(clientEmail);
    await selectFirstRealOption(page.getByLabel("Municipality"));
    const clientLocationSelect = page.getByLabel("Neighborhood / Village");
    if (!(await clientLocationSelect.isDisabled())) {
      await selectFirstRealOption(clientLocationSelect);
    }
    await page.getByLabel("Address Line 1").fill("Contract Street 1");
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
    const propertyLocationSelect = page.locator('select[name="location_id"]');
    await expect(propertyLocationSelect).toBeEnabled();
    await selectFirstRealOption(propertyLocationSelect);
    await page
      .locator('input[name="address_line_1"]')
      .fill("Contract Property 1");
    await page.locator('select[name="property_type"]').selectOption("apartment");
    await page.getByRole("button", { name: "Save Property" }).click();
    await page.waitForURL(/\/properties$/);

    await page.goto("/subscriptions/create");
    await expect(
      page.getByRole("heading", { name: "New Contract" })
    ).toBeVisible();
    await selectOptionContainingText(page.getByLabel("Client *"), clientName);
    await selectOptionContainingText(page.getByLabel("Property *"), propertyTitle);

    const packageSelect = page.getByLabel("Package *");
    selectedPackageName = await packageSelect.evaluate((node) => {
      if (!(node instanceof HTMLSelectElement)) {
        throw new Error("Package locator is not attached to a select element.");
      }

      const option = Array.from(node.options).find(
        (candidate) => !candidate.disabled && candidate.value
      );

      return option?.text.replace(/\s+\(€.*\)$/, "").trim() || "";
    });
    await selectFirstRealOption(packageSelect);
    await page.getByLabel("Start Date *").fill(today);
    await page.getByRole("button", { name: "Create Contract" }).click();

    await page.waitForURL(
      (url) =>
        /^\/subscriptions\/[^/]+$/.test(url.pathname) &&
        !url.pathname.endsWith("/create")
    );
    await expect(page.getByRole("heading", { name: "Contract" })).toBeVisible();
    await expect(page.getByText(clientName).first()).toBeVisible();
    await expect(page.getByText(propertyTitle).first()).toBeVisible();
    await expect(page.getByText(selectedPackageName).first()).toBeVisible();
    await expect(page.getByText("Awaiting paper confirmation")).toBeVisible();
    await expect(page.getByText("Draft").first()).toBeVisible();

    const confirmFiledButton = page.getByRole("button", {
      name: "Confirm Signed & Filed",
    });
    await expect(confirmFiledButton).toBeVisible();
    await confirmFiledButton.click();
    await expect(confirmFiledButton).toHaveCount(0);
    await expect(page.getByText("Active").first()).toBeVisible();

    await page.goto("/subscriptions/create");
    await selectOptionContainingText(page.getByLabel("Client *"), clientName);
    await expect(page.getByLabel("Property *")).toBeDisabled();
    await expect(
      page.getByText("This client has no free properties available for a new contract.")
    ).toBeVisible();
  });
});

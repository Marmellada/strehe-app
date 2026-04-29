import { expect, test } from "@playwright/test";
import {
  createSmokeValue,
  selectFirstRealOption,
  selectOptionContainingText,
  selectRadixOption,
} from "./utils";

test.describe.serial("finance overview smoke", () => {
  test.setTimeout(90_000);

  const seed = createSmokeValue("finance");
  const clientName = `Finance Client ${seed}`;
  const clientEmail = `${seed}@example.com`;
  const propertyTitle = `Finance Property ${seed}`;
  const companyAccountName = `Finance Cash ${seed}`;
  const invoiceLineDescription = `Finance invoice ${seed}`;
  const today = new Date().toISOString().split("T")[0];

  let invoiceUrl = "";

  test("paid invoice appears in finance overview totals", async ({ page }) => {
    await page.goto("/settings/banking/new");
    await expect(
      page.getByRole("heading", { name: "Add Company Account" })
    ).toBeVisible();
    await page.locator('select[name="account_type"]').selectOption("cash");
    await page.getByLabel("Account Name").fill(companyAccountName);
    await page
      .locator('input[name="bank_name_snapshot"]')
      .fill(companyAccountName);
    await page.getByRole("button", { name: "Add Account" }).click();
    await page.waitForURL(/\/settings\/banking$/);
    await expect(
      page.getByRole("row").filter({ hasText: companyAccountName })
    ).toBeVisible();

    await page.goto("/clients/new");
    await page.getByLabel("Full Name").fill(clientName);
    await page.getByLabel("Phone").fill("+38344111991");
    await page.getByLabel("Email").fill(clientEmail);
    await selectFirstRealOption(page.getByLabel("Municipality"));
    const clientLocationSelect = page.getByLabel("Neighborhood / Village");
    if (!(await clientLocationSelect.isDisabled())) {
      await selectFirstRealOption(clientLocationSelect);
    }
    await page.getByLabel("Address Line 1").fill("Finance Street 1");
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
      .fill("Finance Property 1");
    await page.locator('select[name="property_type"]').selectOption("apartment");
    await page.getByRole("button", { name: "Save Property" }).click();
    await page.waitForURL(/\/properties$/);

    await page.goto("/subscriptions/create");
    await expect(
      page.getByRole("heading", { name: "New Contract" })
    ).toBeVisible();
    await selectOptionContainingText(page.getByLabel("Client *"), clientName);
    await selectOptionContainingText(page.getByLabel("Property *"), propertyTitle);
    await selectFirstRealOption(page.getByLabel("Package *"));
    await page.getByLabel("Start Date *").fill(today);
    await page.getByRole("button", { name: "Create Contract" }).click();

    await page.waitForURL(
      (url) =>
        /^\/subscriptions\/[^/]+$/.test(url.pathname) &&
        !url.pathname.endsWith("/create")
    );
    await expect(page.getByRole("heading", { name: "Contract" })).toBeVisible();

    const confirmFiledButton = page.getByRole("button", {
      name: "Confirm Signed & Filed",
    });

    if (await confirmFiledButton.isVisible().catch(() => false)) {
      await confirmFiledButton.click();
      await expect(confirmFiledButton).toHaveCount(0);
    }

    await page.goto("/billing/new");
    await expect(
      page.getByRole("heading", { name: "New Invoice" })
    ).toBeVisible();
    await selectRadixOption(page, "Client*", clientName);
    await selectRadixOption(page, "Property*", propertyTitle);
    await page.getByLabel("Description").fill(invoiceLineDescription);
    await page.getByLabel("Unit Price (€)").fill("50");
    await page.getByRole("button", { name: "Create Invoice" }).click();

    await page.waitForURL(/\/billing$/);
    const invoiceRow = page
      .getByRole("row")
      .filter({ hasText: clientName })
      .first();
    await expect(invoiceRow).toBeVisible();
    await invoiceRow.getByRole("link", { name: "View" }).click();
    await page.waitForURL(/\/billing\/[^/]+$/);
    invoiceUrl = new URL(page.url()).pathname;

    await page.getByRole("button", { name: "Mark as Issued" }).click();
    await expect(
      page.getByText("Invoice marked as issued", { exact: true })
    ).toBeVisible();

    await page.goto(`${invoiceUrl}/payment`);
    await expect(
      page.getByRole("heading", { name: "Record Payment" })
    ).toBeVisible();
    await page.getByLabel("Payment Method").selectOption("cash");
    await selectOptionContainingText(
      page.locator('select[name="company_account_id"]'),
      companyAccountName
    );
    await page.getByRole("button", { name: "Save Payment" }).click();

    await page.waitForURL(invoiceUrl);
    await expect(page.getByText(/paid/i).first()).toBeVisible();

    await page.goto(`/finance?dateFrom=${today}&dateTo=${today}`);
    await expect(
      page.getByRole("heading", { name: "Finance Overview" })
    ).toBeVisible();
    await selectOptionContainingText(page.getByLabel("Client"), clientName);
    await selectOptionContainingText(page.getByLabel("Property"), propertyTitle);
    await page.getByRole("button", { name: "Apply Filters" }).click();
    await expect(
      page.getByRole("heading", { name: "Finance Overview" })
    ).toBeVisible();
    await expect(page.getByText("Payments Collected")).toBeVisible();
    await expect(page.getByText("€59.00").first()).toBeVisible();
    await expect(page.getByText("Settled Invoices")).toBeVisible();
    await expect(page.getByText(invoiceLineDescription)).toHaveCount(0);
  });
});

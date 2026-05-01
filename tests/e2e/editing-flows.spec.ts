import { expect, test } from "@playwright/test";
import {
  createSmokeValue,
  selectFirstRealOption,
  selectOptionContainingText,
  selectRadixOption,
} from "./utils";

test.describe.serial("editing flows smoke", () => {
  test.setTimeout(120_000);

  const seed = createSmokeValue("edit");
  const clientName = `Edit Client ${seed}`;
  const updatedClientName = `Edited Client ${seed}`;
  const clientEmail = `${seed}@example.com`;
  const propertyTitle = `Edit Property ${seed}`;
  const updatedPropertyTitle = `Edited Property ${seed}`;
  const categoryName = `Edit Category ${seed}`;
  const updatedCategoryName = `Edited Category ${seed}`;
  const vendorName = `Edit Vendor ${seed}`;
  const updatedVendorName = `Edited Vendor ${seed}`;
  const taskTitle = `Edit Task ${seed}`;
  const updatedTaskTitle = `Edited Task ${seed}`;
  const invoiceLineDescription = `Edit Invoice ${seed}`;
  const updatedInvoiceLineDescription = `Edited Invoice ${seed}`;
  const contractNotes = `Edited contract notes ${seed}`;
  const clientNotes = `Edited client notes ${seed}`;
  const propertyAddress = `Edited Property Address ${seed}`;
  const vendorNotes = `Edited vendor notes ${seed}`;
  const categoryDescription = `Edited category description ${seed}`;
  const today = new Date().toISOString().split("T")[0];

  let clientUrl = "";
  let propertyUrl = "";
  let subscriptionUrl = "";
  let taskUrl = "";
  let invoiceUrl = "";

  test("create and edit expense category", async ({ page }) => {
    await page.goto("/settings/expense-categories/new");

    await expect(
      page.getByRole("heading", { name: "New Expense Category" })
    ).toBeVisible();

    await page.locator('input[name="name"]').fill(categoryName);
    await page.locator('textarea[name="description"]').fill("Original category description");
    await page.locator('input[name="sort_order"]').fill("11");
    await page.getByRole("button", { name: "Create Category" }).click();

    await page.waitForURL(/\/settings\/expense-categories$/);
    const categoryRow = page.getByRole("row").filter({ hasText: categoryName });
    await expect(categoryRow).toBeVisible();
    await Promise.all([
      page.waitForURL(/\/settings\/expense-categories\/[^/]+\/edit$/),
      categoryRow.getByRole("link", { name: "Edit" }).click(),
    ]);

    await expect(
      page.getByRole("button", { name: "Save Category" })
    ).toBeVisible();

    await page.locator('input[name="name"]').fill(updatedCategoryName);
    await page.locator('textarea[name="description"]').fill(categoryDescription);
    await page.locator('input[name="sort_order"]').fill("12");
    await page.locator('select[name="is_active"]').selectOption("false");
    await page.getByRole("button", { name: "Save Category" }).click();

    await page.waitForURL(/\/settings\/expense-categories$/);
    const updatedRow = page
      .getByRole("row")
      .filter({ hasText: updatedCategoryName });
    await expect(updatedRow).toBeVisible();
    await expect(updatedRow).toContainText(/inactive/i);
    await expect(updatedRow).toContainText("12");
  });

  test("create and edit vendor", async ({ page }) => {
    await page.goto("/settings/vendors/new");

    await expect(
      page.getByRole("heading", { name: "New Vendor" })
    ).toBeVisible();

    await page.locator('input[name="name"]').fill(vendorName);
    await page.locator('input[name="contact_person"]').fill("Original Contact");
    await page.locator('input[name="email"]').fill(`${seed}-vendor@example.com`);
    await page.locator('input[name="phone"]').fill("+38344111999");
    await page.locator('textarea[name="address"]').fill("Original vendor address");
    await page.locator('textarea[name="notes"]').fill("Original vendor notes");
    await page.getByRole("button", { name: "Create Vendor" }).click();

    await page.waitForURL(/\/settings\/vendors$/);
    const vendorRow = page.getByRole("row").filter({ hasText: vendorName });
    await expect(vendorRow).toBeVisible();
    await Promise.all([
      page.waitForURL(/\/settings\/vendors\/[^/]+\/edit$/),
      vendorRow.getByRole("link", { name: "Edit" }).click(),
    ]);

    await expect(
      page.getByRole("button", { name: "Save Vendor" })
    ).toBeVisible();

    await page.locator('input[name="name"]').fill(updatedVendorName);
    await page.locator('input[name="contact_person"]').fill("Edited Contact");
    await page.locator('textarea[name="notes"]').fill(vendorNotes);
    await page.locator('select[name="is_active"]').selectOption("false");
    await page.getByRole("button", { name: "Save Vendor" }).click();

    await page.waitForURL(/\/settings\/vendors$/);
    const updatedRow = page.getByRole("row").filter({ hasText: updatedVendorName });
    await expect(updatedRow).toBeVisible();
    await expect(updatedRow).toContainText(/inactive/i);
    await expect(updatedRow).toContainText("Edited Contact");
  });

  test("create client", async ({ page }) => {
    await page.goto("/clients/new");

    await expect(
      page.getByRole("heading", { name: /New Individual Client|Edit Client/ })
    ).toBeVisible();

    await page.getByLabel("Full Name").fill(clientName);
    await page.getByLabel("Phone").fill("+38344111222");
    await page.getByLabel("Email").fill(clientEmail);
    await selectFirstRealOption(page.getByLabel("Municipality"));
    const clientLocationSelect = page.getByLabel("Neighborhood / Village");
    if (!(await clientLocationSelect.isDisabled())) {
      await selectFirstRealOption(clientLocationSelect);
    }
    await page.getByLabel("Address Line 1").fill("Edit Street 1");
    await page.getByRole("button", { name: "Create Client" }).click();

    await page.waitForURL(/\/clients$/);
    await Promise.all([
      page.waitForURL(/\/clients\/[^/]+$/),
      page.getByRole("link", { name: clientName }).click(),
    ]);
    clientUrl = page.url();
    await expect(page.getByRole("heading", { name: clientName })).toBeVisible();
  });

  test("create property", async ({ page }) => {
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

    await page.locator('input[name="address_line_1"]').fill("Edit Property Address 1");
    await page.locator('select[name="property_type"]').selectOption("apartment");
    await page.getByRole("button", { name: "Save Property" }).click();

    await page.waitForURL(/\/properties$/);
    await page.getByLabel("Search").fill(propertyTitle);
    await page.getByRole("button", { name: "Apply" }).click();

    const propertyRow = page.getByRole("row").filter({ hasText: propertyTitle });
    await expect(propertyRow).toBeVisible();
    const propertyHref =
      (await propertyRow.getByRole("link", { name: "View" }).getAttribute("href")) ||
      "";

    if (!/^\/properties\/[0-9a-f-]{36}$/.test(propertyHref)) {
      throw new Error(`Unexpected property href: ${propertyHref}`);
    }

    await page.goto(propertyHref);
    propertyUrl = page.url();
    await expect(page.getByRole("heading", { name: propertyTitle })).toBeVisible();
  });

  test("create and activate contract", async ({ page }) => {
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
    subscriptionUrl = page.url();

    const confirmFiledButton = page.getByRole("button", {
      name: "Confirm Signed & Filed",
    });
    if (await confirmFiledButton.isVisible().catch(() => false)) {
      await confirmFiledButton.click();
    }

    await expect(page.getByText(/active/i)).toBeVisible();
  });

  test("create manual task", async ({ page }) => {
    await page.goto("/tasks/create");

    await expect(
      page.getByRole("heading", { name: "Create Task" })
    ).toBeVisible();

    await page.getByLabel("Title").fill(taskTitle);
    await page.getByLabel("Description").fill("Original task description");
    await page.getByLabel("Due Date").fill(today);
    await selectOptionContainingText(page.getByLabel("Property"), propertyTitle);
    await page.getByRole("button", { name: "Create Task" }).click();

    await page.waitForURL(/\/tasks$/);
    await Promise.all([
      page.waitForURL(/\/tasks\/[^/]+$/),
      page.getByRole("link", { name: taskTitle }).click(),
    ]);
    taskUrl = page.url();
    await expect(page.getByRole("heading", { name: taskTitle })).toBeVisible();
  });

  test("create draft invoice", async ({ page }) => {
    await page.goto("/billing/new");

    await expect(
      page.getByRole("heading", { name: "New Invoice" })
    ).toBeVisible();

    await selectRadixOption(page, "Client*", clientName);
    await selectRadixOption(page, "Property*", propertyTitle);
    await page.getByLabel("Description").fill(invoiceLineDescription);
    await page.getByLabel("Unit Price (€)").fill("120");
    await page.getByRole("button", { name: "Create Invoice" }).click();

    await page.waitForURL(/\/billing$/);
    const invoiceRow = page.getByRole("row").filter({ hasText: clientName }).first();
    await expect(invoiceRow).toBeVisible();
    await Promise.all([
      page.waitForURL(/\/billing\/[^/]+$/),
      invoiceRow.getByRole("link", { name: "View" }).click(),
    ]);
    invoiceUrl = page.url();
    await expect(page.getByText(invoiceLineDescription)).toBeVisible();
  });

  test("edit invoice draft", async ({ page }) => {
    await page.goto(`${invoiceUrl}/edit`);

    await expect(
      page.getByRole("heading", { name: "Edit Invoice" })
    ).toBeVisible();

    await page.getByLabel("Description").fill(updatedInvoiceLineDescription);
    await page.getByLabel("Notes").fill(`Edited invoice notes ${seed}`);
    await page.getByRole("button", { name: "Save Changes" }).click();

    await page.waitForURL(invoiceUrl);
    await expect(page.getByText(updatedInvoiceLineDescription)).toBeVisible();
    await expect(page.getByText(`Edited invoice notes ${seed}`)).toBeVisible();
  });

  test("edit task", async ({ page }) => {
    await page.goto(`${taskUrl}/edit`);

    await expect(
      page.getByRole("heading", { name: "Edit Task" })
    ).toBeVisible();

    await page.getByLabel("Title").fill(updatedTaskTitle);
    await page.getByLabel("Status").selectOption("escalated");
    await page
      .getByLabel("Escalation Reason")
      .fill(`Edited escalation reason ${seed}`);
    await page.getByRole("button", { name: "Save Changes" }).click();

    await page.waitForURL(taskUrl);
    await expect(page.getByRole("heading", { name: updatedTaskTitle })).toBeVisible();
    await expect(
      page.getByText(`Edited escalation reason ${seed}`).first()
    ).toBeVisible();
  });

  test("edit contract", async ({ page }) => {
    await page.goto(`${subscriptionUrl}/edit`);

    await expect(
      page.getByRole("heading", { name: "Edit Contract" })
    ).toBeVisible();

    await page.getByLabel("Monthly Price *").fill("155");
    await page.getByLabel("Status").selectOption("paused");
    await page.getByLabel("Notes").fill(contractNotes);
    await page.getByRole("button", { name: "Save Changes" }).click();

    await page.waitForURL(subscriptionUrl);
    await expect(page.getByText(contractNotes)).toBeVisible();
    await expect(page.getByText(/paused/i).first()).toBeVisible();
    await expect(page.getByText("€155.00").first()).toBeVisible();
  });

  test("edit property", async ({ page }) => {
    await page.goto(`${propertyUrl}/edit`);

    await expect(
      page.getByRole("heading", { name: "Edit Property" })
    ).toBeVisible();

    await page.locator('input[name="title"]').fill(updatedPropertyTitle);
    await page.locator('input[name="address_line_1"]').fill(propertyAddress);
    await page.locator('select[name="status"]').selectOption("vacant");
    await page.getByRole("button", { name: "Save Changes" }).click();

    await page.waitForURL(propertyUrl);
    await expect(
      page.getByRole("heading", { name: updatedPropertyTitle })
    ).toBeVisible();
    await expect(page.getByText(propertyAddress)).toBeVisible();
    await expect(page.getByText(/vacant/i).first()).toBeVisible();
  });

  test("edit client", async ({ page }) => {
    await page.goto(`${clientUrl}/edit`);

    await expect(
      page.getByRole("heading", { name: "Edit Client" })
    ).toBeVisible();

    await page.getByLabel("Full Name").fill(updatedClientName);
    await page.getByLabel("Phone").fill("+38344111777");
    await page.getByLabel("Notes").fill(clientNotes);
    await page.getByLabel("Status").selectOption("inactive");
    await page.getByRole("button", { name: "Update Client" }).click();

    await page.waitForURL(clientUrl);
    await expect(
      page.getByRole("heading", { name: updatedClientName })
    ).toBeVisible();
    await expect(page.getByText(clientNotes)).toBeVisible();
    await expect(page.getByText(/inactive/i).first()).toBeVisible();
  });
});

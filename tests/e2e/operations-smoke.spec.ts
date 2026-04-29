import { expect, test } from "@playwright/test";
import {
  createSmokeValue,
  selectFirstRealOption,
  selectOptionContainingText,
} from "./utils";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64"
);

test.describe.serial("operations smoke", () => {
  const seed = createSmokeValue("ops");
  const packageName = `Ops Package ${seed}`;
  const packageNameEdited = `Ops Package Edited ${seed}`;
  const serviceName = `Ops Service ${seed}`;
  const serviceNameEdited = `Ops Service Edited ${seed}`;
  const workerName = `Ops Worker ${seed}`;
  const workerEmail = `${seed}-worker@example.com`;
  const categoryName = `Ops Expense Category ${seed}`;
  const vendorName = `Ops Vendor ${seed}`;
  const clientName = `Ops Client ${seed}`;
  const clientEmail = `${seed}@example.com`;
  const propertyTitle = `Ops Property ${seed}`;
  const expenseDescription = `Ops Expense ${seed}`;
  const taskTitle = `Ops Attachment Task ${seed}`;
  const reportNotes = `Ops attachment report ${seed}`;
  const attachmentName = `ops-attachment-${seed}.png`;
  const today = new Date().toISOString().split("T")[0];

  test("create and edit package and service records", async ({ page }) => {
    await page.goto("/packages/create");
    await expect(page.getByRole("heading", { name: "New Package" })).toBeVisible();
    await page.getByLabel("Package Name *").fill(packageName);
    await page.getByLabel("Monthly Price").fill("79");
    await page.getByLabel("Description").fill("Ops package description");
    await page.getByRole("button", { name: "Create Package" }).click();

    await page.waitForURL(/\/packages\/[^/]+$/);
    await expect(page.getByRole("heading", { name: packageName })).toBeVisible();
    await page.getByRole("link", { name: "Edit" }).click();
    await page.waitForURL(/\/packages\/[^/]+\/edit$/);
    await page.getByLabel("Package Name *").fill(packageNameEdited);
    await page.getByLabel("Monthly Price").fill("89");
    await page.getByRole("button", { name: "Save Changes" }).click();

    await page.waitForURL(/\/packages\/[^/]+$/);
    await expect(page.getByRole("heading", { name: packageNameEdited })).toBeVisible();
    await expect(page.getByText("€89.00").first()).toBeVisible();

    await page.goto("/services/create");
    await expect(page.getByRole("heading", { name: "New Service" })).toBeVisible();
    await page.getByLabel("Name *").fill(serviceName);
    await page.getByLabel("Category *").selectOption("inspection");
    await page.getByLabel("Base Price").fill("35");
    await page.getByLabel("Default Priority").selectOption("high");
    await page.getByLabel("Default Task Title").fill(`Default ${serviceName}`);
    await page.getByLabel("Description", { exact: true }).fill("Ops service description");
    await page.getByRole("button", { name: "Create Service" }).click();

    await page.waitForURL(/\/services$/);
    const serviceRow = page.getByRole("row").filter({ hasText: serviceName });
    await expect(serviceRow).toBeVisible();
    await serviceRow.getByRole("link", { name: "Open" }).click();

    await page.waitForURL(/\/services\/[^/]+$/);
    await expect(page.getByRole("heading", { name: serviceName })).toBeVisible();
    await page.getByRole("link", { name: "Edit" }).click();
    await page.waitForURL(/\/services\/[^/]+\/edit$/);
    await page.getByLabel("Name *").fill(serviceNameEdited);
    await page.getByLabel("Base Price").fill("42");
    await page.getByRole("button", { name: "Save Changes" }).click();

    await page.waitForURL(/\/services\/[^/]+$/);
    await expect(page.getByRole("heading", { name: serviceNameEdited })).toBeVisible();
    await expect(page.getByText("€42.00").first()).toBeVisible();
  });

  test("create worker and expense entry", async ({ page }) => {
    await page.goto("/workers/new");
    await expect(page.getByRole("heading", { name: "New staff record" })).toBeVisible();
    await page.getByLabel("Full name").fill(workerName);
    await page.getByLabel("Email").fill(workerEmail);
    await page.getByLabel("Phone").fill("+38344111666");
    await page.getByLabel("Role title").fill("Operations Assistant");
    await page.getByLabel("Worker type").selectOption("contractor");
    await page.getByLabel("Start date").fill(today);
    await page.getByLabel("Base salary").fill("250");
    await page.getByLabel("Payment frequency").selectOption("monthly");
    await page.getByLabel("Payment method").selectOption("cash");
    await page.getByLabel("Notes").fill("Ops worker smoke notes");
    await page.getByRole("button", { name: "Create staff record" }).click();

    await page.waitForURL(/\/workers\/[^/]+$/);
    await expect(page.getByRole("heading", { name: workerName })).toBeVisible();

    await page.goto("/settings/expense-categories/new");
    await page.locator('input[name="name"]').fill(categoryName);
    await page.locator('input[name="sort_order"]').fill("902");
    await page.getByRole("button", { name: "Create Category" }).click();
    await page.waitForURL(/\/settings\/expense-categories$/);
    await expect(page.getByRole("row").filter({ hasText: categoryName })).toBeVisible();

    await page.goto("/settings/vendors/new");
    await page.locator('input[name="name"]').fill(vendorName);
    await page.locator('input[name="email"]').fill(`${seed}-vendor@example.com`);
    await page.locator('input[name="phone"]').fill("+38344111777");
    await page.getByRole("button", { name: "Create Vendor" }).click();
    await page.waitForURL(/\/settings\/vendors$/);
    await expect(page.getByRole("row").filter({ hasText: vendorName })).toBeVisible();

    await page.goto("/expenses/new");
    await expect(page.getByRole("heading", { name: "New Expense" })).toBeVisible();
    await page.locator('input[name="expense_date"]').fill(today);
    await page.locator('input[name="amount"]').fill("18.50");
    await page.locator('input[name="description"]').fill(expenseDescription);
    await selectOptionContainingText(page.locator('select[name="expense_category_id"]'), categoryName);
    await selectOptionContainingText(page.locator('select[name="vendor_id"]'), vendorName);
    await page.locator('textarea[name="notes"]').fill("Ops expense smoke notes");
    await page.getByRole("button", { name: "Create Expense" }).click();

    await page.waitForURL(
      (url) => /^\/expenses\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith("/new")
    );
    await expect(page.getByRole("heading", { name: "Expense Detail" })).toBeVisible();
    await expect(page.getByText(expenseDescription)).toBeVisible();
    await expect(page.getByText("€18.50")).toBeVisible();
    await expect(page.getByText(vendorName)).toBeVisible();
  });

  test("submit task report with attachment", async ({ page }) => {
    await page.goto("/clients/new");
    await page.getByLabel("Full Name").fill(clientName);
    await page.getByLabel("Phone").fill("+38344111888");
    await page.getByLabel("Email").fill(clientEmail);
    await selectFirstRealOption(page.getByLabel("Municipality"));
    const clientLocationSelect = page.getByLabel("Neighborhood / Village");
    if (!(await clientLocationSelect.isDisabled())) {
      await selectFirstRealOption(clientLocationSelect);
    }
    await page.getByLabel("Address Line 1").fill("Ops Attachment Street 1");
    await page.getByRole("button", { name: "Create Client" }).click();
    await page.waitForURL(/\/clients$/);

    await page.goto("/properties/new");
    await page.locator('input[name="title"]').fill(propertyTitle);
    await selectOptionContainingText(
      page.locator('select[name="owner_client_id"]'),
      clientName
    );
    await selectFirstRealOption(page.locator('select[name="municipality_id"]'));
    await selectFirstRealOption(page.locator('select[name="location_id"]'));
    await page.locator('input[name="address_line_1"]').fill("Ops Attachment Property 1");
    await page.locator('select[name="property_type"]').selectOption("apartment");
    await page.getByRole("button", { name: "Save Property" }).click();
    await page.waitForURL(/\/properties$/);

    await page.goto("/tasks/create");
    await page.getByLabel("Title").fill(taskTitle);
    await page.getByLabel("Description").fill("Ops attachment task description");
    await page.getByLabel("Due Date").fill(today);
    await selectOptionContainingText(page.getByLabel("Property"), propertyTitle);
    await page.getByRole("button", { name: "Create Task" }).click();

    await page.waitForURL(/\/tasks$/);
    await page.getByRole("link", { name: taskTitle }).click();
    await page.waitForURL(/\/tasks\/[^/]+$/);
    const taskUrl = new URL(page.url()).pathname;

    await page.getByRole("link", { name: "Add Report" }).click();
    await page.waitForURL(/\/tasks\/[^/]+\/report$/);
    await page.locator('select[name="report_type"]').selectOption("visit");
    await page.locator('textarea[name="notes"]').fill(reportNotes);
    await page.locator('input[name="photos"]').setInputFiles({
      name: attachmentName,
      mimeType: "image/png",
      buffer: tinyPng,
    });
    await page.getByRole("button", { name: "Submit Report" }).click();

    await page.waitForURL(taskUrl);
    await expect(page.getByText(reportNotes)).toBeVisible();
    await expect(page.getByAltText(attachmentName)).toBeVisible();
  });
});

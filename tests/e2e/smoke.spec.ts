import { test, expect } from "@playwright/test";
import {
  createSmokeValue,
  selectFirstRealOption,
  selectOptionContainingText,
  selectRadixOption,
} from "./utils";

test.describe.serial("STREHE smoke suite", () => {
  const seed = createSmokeValue("smoke");
  const clientName = `Smoke Client ${seed}`;
  const clientEmail = `${seed}@example.com`;
  const propertyTitle = `Smoke Property ${seed}`;
  const taskTitle = `Smoke Task ${seed}`;
  const taskReportNotes = `Smoke report ${seed}`;
  const invoiceLineDescription = `Smoke invoice ${seed}`;
  const today = new Date().toISOString().split("T")[0];

  let taskUrl = "";

  test("create client", async ({ page }) => {
    await page.goto("/clients/new");

    await expect(
      page.getByRole("heading", { name: /New Individual Client|Edit Client/ })
    ).toBeVisible();

    await page.getByLabel("Full Name").fill(clientName);
    await page.getByLabel("Phone").fill("+38344111222");
    await page.getByLabel("Email").fill(clientEmail);
    await selectFirstRealOption(page.getByLabel("Municipality"));
    await selectFirstRealOption(page.getByLabel("Neighborhood / Village"));
    await page.getByLabel("Address Line 1").fill("Smoke Street 1");
    await page.getByRole("button", { name: "Create Client" }).click();

    await page.waitForURL(/\/clients$/);
    await expect(page.getByRole("link", { name: clientName })).toBeVisible();
  });

  test("create property", async ({ page }) => {
    await page.goto("/properties/new");

    await expect(
      page.getByRole("heading", { name: "New Property" })
    ).toBeVisible();

    await page.getByLabel("Title").fill(propertyTitle);
    await selectOptionContainingText(page.getByLabel("Owner"), clientName);
    await selectFirstRealOption(page.getByLabel("Municipality"));
    await selectFirstRealOption(page.getByLabel("Neighborhood / Village"));
    await page.getByLabel("Address Line 1").fill("Smoke Property Address 1");
    await page.getByLabel("Property Type").selectOption("apartment");
    await page.getByRole("button", { name: "Save Property" }).click();

    await page.waitForURL(/\/properties$/);

    await page.getByLabel("Search").fill(propertyTitle);
    await page.getByRole("button", { name: "Apply" }).click();

    const propertyRow = page.getByRole("row").filter({ hasText: propertyTitle });
    await expect(propertyRow).toBeVisible();
  });

  test("create and cancel subscription", async ({ page }) => {
    await page.goto("/subscriptions/create");

    await expect(
      page.getByRole("heading", { name: "New Contract" })
    ).toBeVisible();

    await selectOptionContainingText(page.getByLabel("Client *"), clientName);
    await selectOptionContainingText(page.getByLabel("Property *"), propertyTitle);
    await selectFirstRealOption(page.getByLabel("Package *"));
    await page.getByLabel("Start Date *").fill(today);
    await page.getByRole("button", { name: "Create Contract" }).click();

    await page.waitForURL(/\/subscriptions\/[^/]+$/);

    await expect(
      page.getByRole("heading", { name: "Contract" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Cancel Contract" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Open PDF" })
    ).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Cancel Contract" }).click();
    await page.waitForURL(/\/subscriptions$/);
    await expect(
      page.getByRole("heading", { name: "Contracts" })
    ).toBeVisible();
  });

  test("create, report, and cancel task", async ({ page }) => {
    await page.goto("/tasks/create");

    await expect(
      page.getByRole("heading", { name: "Create Task" })
    ).toBeVisible();

    await page.getByLabel("Title").fill(taskTitle);
    await page.getByLabel("Description").fill("Smoke task description");
    await page.getByLabel("Due Date").fill(today);
    await selectOptionContainingText(page.getByLabel("Property"), propertyTitle);
    await page.getByRole("button", { name: "Create Task" }).click();

    await page.waitForURL(/\/tasks$/);
    await page.getByRole("link", { name: taskTitle }).click();

    await page.waitForURL(/\/tasks\/[^/]+$/);
    taskUrl = page.url();

    await page.getByRole("link", { name: /Add Report/ }).click();
    await page.waitForURL(/\/tasks\/[^/]+\/report$/);

    await page.getByLabel("Report Type").selectOption("update");
    await page.getByLabel("Notes").fill(taskReportNotes);
    await page.getByRole("button", { name: "Submit Report" }).click();

    await page.waitForURL(taskUrl);
    await expect(page.getByText(taskReportNotes)).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Cancel Task" }).click();

    await page.waitForURL(taskUrl);
    await expect(
      page.getByRole("heading", { name: taskTitle })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Cancel Task" })
    ).not.toBeVisible();
  });

  test("create invoice and open PDF", async ({ page, request }) => {
    await page.goto("/billing/new");

    await expect(
      page.getByRole("heading", { name: "New Invoice" })
    ).toBeVisible();

    await selectRadixOption(page, "Client *", clientName);
    await selectRadixOption(page, "Property *", propertyTitle);

    await page.getByLabel("Description").fill(invoiceLineDescription);
    await page.getByLabel("Unit Price (€)").fill("120");
    await page.getByRole("button", { name: "Create Invoice" }).click();

    await page.waitForURL(/\/billing$/);

    const invoiceRow = page.getByRole("row").filter({ hasText: clientName });
    await expect(invoiceRow).toBeVisible();
    await invoiceRow.getByRole("link", { name: "View" }).click();

    await page.waitForURL(/\/billing\/[^/]+$/);
    await expect(page.getByRole("link", { name: "Open PDF" })).toBeVisible();

    const pdfHref = await page.getByRole("link", { name: "Open PDF" }).getAttribute("href");
    if (!pdfHref) {
      throw new Error("Invoice PDF link is missing.");
    }

    const pdfResponse = await request.get(pdfHref);
    expect(pdfResponse.ok()).toBeTruthy();
    expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");

    const [pdfPage] = await Promise.all([
      page.waitForEvent("popup"),
      page.getByRole("link", { name: "Open PDF" }).click(),
    ]);

    await pdfPage.waitForURL(/\/billing\/[^/]+\/pdf/);
    await pdfPage.close();
  });
});

import { test, expect } from "@playwright/test";
import {
  createSmokeValue,
  selectFirstRealOption,
  selectOptionContainingText,
  selectRadixOption,
} from "./utils";

test.describe.serial("STREHE smoke suite", () => {
  const seed = createSmokeValue("smoke");
  const compactSeed = seed.replace(/[^a-zA-Z0-9]/g, "").slice(-10).toUpperCase();
  const clientName = `Smoke Client ${seed}`;
  const clientEmail = `${seed}@example.com`;
  const propertyTitle = `Smoke Property ${seed}`;
  const companyAccountName = `Smoke Cash ${seed}`;
  const companyBankDisplayName = `Smoke Cash ${seed}`;
  const keyName = `Smoke Key ${seed}`;
  const packageCampaignName = `Smoke Package Promo ${seed}`;
  const serviceCampaignName = `Smoke Service Promo ${seed}`;
  const packagePromotionCode = `SMKPKG${compactSeed}`;
  const servicePromotionCode = `SMKSVC${compactSeed}`;
  const taskTitle = `Smoke Task ${seed}`;
  const taskReportNotes = `Smoke report ${seed}`;
  const invoiceLineDescription = `Smoke invoice ${seed}`;
  const creditNoteInvoiceLineDescription = `Smoke credit note invoice ${seed}`;
  const creditNoteReason = `Smoke credit note ${seed}`;
  const today = new Date().toISOString().split("T")[0];

  let propertyUrl = "";
  let subscriptionUrl = "";
  let taskUrl = "";
  let invoiceUrl = "";

  test("create company cash account", async ({ page }) => {
    await page.goto("/settings/banking/new");

    await expect(
      page.getByRole("heading", { name: "Add Company Account" })
    ).toBeVisible();

    const accountTypeSelect = page.locator('select[name="account_type"]');
    await accountTypeSelect.selectOption("cash");
    await expect(accountTypeSelect).toHaveValue("cash");
    await page.getByLabel("Account Name").fill(companyAccountName);
    await page.locator('input[name="bank_name_snapshot"]').fill(
      companyBankDisplayName
    );
    await page.getByRole("button", { name: "Add Account" }).click();

    await page.waitForURL(/\/settings\/banking$/);
    const accountRow = page.getByRole("row").filter({ hasText: companyAccountName });
    await expect(accountRow).toBeVisible();
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
      .fill("Smoke Property Address 1");
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

  test("create property key", async ({ page }) => {
    await page.goto(`${propertyUrl}/keys/new`);

    await expect(
      page.getByRole("heading", { name: "Add Key" })
    ).toBeVisible();

    await page.locator('input[name="key_type"]').fill("Main door");
    await page
      .locator('input[name="storage_location"]')
      .fill("Office Safe / Smoke Slot");
    await page.locator('input[name="name"]').fill(keyName);
    await page.locator('textarea[name="description"]').fill("Smoke key description");
    await page.getByRole("button", { name: "Save Key" }).click();

    await page.waitForURL(/\/properties\/[^/]+\/keys$/);
    const keyRow = page.getByRole("row").filter({ hasText: keyName });
    await expect(keyRow).toBeVisible();
    await expect(keyRow).toContainText(/available/i);
  });

  test("create promotion campaigns and codes", async ({ page }) => {
    await page.goto("/settings/promotions");

    await expect(
      page.getByRole("heading", { name: "Promotions" })
    ).toBeVisible();

    const campaignForm = page.locator("form").filter({
      has: page.getByRole("button", { name: "Create Campaign" }),
    });

    await campaignForm.getByLabel("Campaign Name *").fill(packageCampaignName);
    await campaignForm.getByLabel("Description").fill("Smoke package campaign");
    await campaignForm.getByLabel("Discount Type").selectOption("percent");
    await campaignForm.getByLabel("Applies To").selectOption("package_fee");
    await campaignForm.getByLabel("Percent").fill("10");
    await campaignForm.getByRole("button", { name: "Create Campaign" }).click();

    await expect(page.getByRole("row").filter({ hasText: packageCampaignName })).toBeVisible();

    const issueCodeForm = page.locator("form").filter({
      has: page.getByRole("button", { name: "Create Code" }),
    });

    await issueCodeForm.getByLabel("Assigned Name").fill(clientName);
    await issueCodeForm.getByLabel("Assigned Email").fill(clientEmail);
    await issueCodeForm.getByLabel("Source").selectOption("survey");
    await issueCodeForm.getByLabel("Auto Code Prefix").fill("SMOKE-PKG");
    await issueCodeForm.getByLabel("Custom Code").fill(packagePromotionCode);
    await issueCodeForm.getByRole("button", { name: "Create Code" }).click();

    await expect(page.getByRole("row").filter({ hasText: packagePromotionCode })).toBeVisible();

    await campaignForm.getByLabel("Campaign Name *").fill(serviceCampaignName);
    await campaignForm.getByLabel("Description").fill("Smoke service campaign");
    await campaignForm.getByLabel("Discount Type").selectOption("percent");
    await campaignForm.getByLabel("Applies To").selectOption("service_lines");
    await campaignForm.getByLabel("Percent").fill("15");
    await campaignForm.getByRole("button", { name: "Create Campaign" }).click();

    await expect(page.getByRole("row").filter({ hasText: serviceCampaignName })).toBeVisible();

    await issueCodeForm.getByLabel("Assigned Name").fill(clientName);
    await issueCodeForm.getByLabel("Assigned Email").fill(clientEmail);
    await issueCodeForm.getByLabel("Source").selectOption("survey");
    await issueCodeForm.getByLabel("Auto Code Prefix").fill("SMOKE-SVC");
    await issueCodeForm.getByLabel("Custom Code").fill(servicePromotionCode);
    await issueCodeForm.getByRole("button", { name: "Create Code" }).click();

    await expect(page.getByRole("row").filter({ hasText: servicePromotionCode })).toBeVisible();
  });

  test("create subscription with promotion and verify PDF", async ({ page, request }) => {
    await page.goto("/subscriptions/create");

    await expect(
      page.getByRole("heading", { name: "New Contract" })
    ).toBeVisible();

    await selectOptionContainingText(page.getByLabel("Client *"), clientName);
    await selectOptionContainingText(page.getByLabel("Property *"), propertyTitle);
    await selectFirstRealOption(page.getByLabel("Package *"));
    await page.getByLabel("Promotion Code").fill(packagePromotionCode);
    await expect(page.getByText("Code ready")).toBeVisible();
    await page.getByLabel("Start Date *").fill(today);
    await page.getByRole("button", { name: "Create Contract" }).click();

    await page.waitForURL(
      (url) =>
        /^\/subscriptions\/[^/]+$/.test(url.pathname) &&
        !url.pathname.endsWith("/create")
    );
    subscriptionUrl = page.url();

    await expect(page.getByRole("heading", { name: "Contract" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel Contract" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open PDF" })).toBeVisible();
    await expect(
      page.getByText(packagePromotionCode, { exact: true })
    ).toBeVisible();

    const confirmFiledButton = page.getByRole("button", {
      name: "Confirm Signed & Filed",
    });

    if (await confirmFiledButton.isVisible().catch(() => false)) {
      await confirmFiledButton.click();
      await expect(page.getByText(/active/i)).toBeVisible();
      await expect(confirmFiledButton).toHaveCount(0);
    }

    const pdfHref = await page.getByRole("link", { name: "Open PDF" }).getAttribute("href");
    if (!pdfHref) {
      throw new Error("Contract PDF link is missing.");
    }

    const pdfResponse = await request.get(pdfHref);
    expect(pdfResponse.ok()).toBeTruthy();
    expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
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
    await Promise.all([
      page.waitForURL(/\/tasks\/[^/]+$/),
      page.getByRole("link", { name: taskTitle }).click(),
    ]);
    taskUrl = page.url();

    await page.getByRole("link", { name: /Add Report/ }).click();
    await page.waitForURL(/\/tasks\/[^/]+\/report$/);

    await page.locator('select[name="report_type"]').selectOption("update");
    await page.locator('textarea[name="notes"]').fill(taskReportNotes);
    await page.getByRole("button", { name: "Submit Report" }).click();

    await page.waitForURL(taskUrl);
    await expect(page.getByText(taskReportNotes)).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Cancel Task" }).click();

    await page.waitForURL(taskUrl);
    await expect(page.getByRole("heading", { name: taskTitle })).toBeVisible();
  });

  test("create invoice with service promotion, issue it, and verify PDF", async ({ page, request }) => {
    await page.goto("/billing/new");

    await expect(
      page.getByRole("heading", { name: "New Invoice" })
    ).toBeVisible();

    await selectRadixOption(page, "Client*", clientName);
    await selectRadixOption(page, "Property*", propertyTitle);

    await page.getByLabel("Description").fill(invoiceLineDescription);
    await page.getByLabel("Unit Price (€)").fill("120");
    await page.getByLabel("Service Promotion Code").fill(servicePromotionCode);
    await expect(page.getByText(servicePromotionCode)).toBeVisible();
    await page.getByRole("button", { name: "Create Invoice" }).click();

    await page.waitForURL(/\/billing$/);

    const invoiceRow = page.getByRole("row").filter({ hasText: clientName });
    await expect(invoiceRow).toBeVisible();
    await Promise.all([
      page.waitForURL(/\/billing\/[^/]+$/),
      invoiceRow.getByRole("link", { name: "View" }).click(),
    ]);
    invoiceUrl = page.url();
    await expect(page.getByRole("link", { name: "Open PDF" })).toBeVisible();
    await expect(page.getByText(servicePromotionCode)).toBeVisible();

    await page.getByRole("button", { name: "Mark as Issued" }).click();
    await expect(
      page.getByText("Invoice marked as issued", { exact: true })
    ).toBeVisible();
    const recordPaymentLinks = page.getByRole("link", { name: "Record Payment" });
    await expect(recordPaymentLinks.first()).toBeVisible();

    const pdfHref = await page.getByRole("link", { name: "Open PDF" }).getAttribute("href");
    if (!pdfHref) {
      throw new Error("Invoice PDF link is missing.");
    }

    const pdfResponse = await request.get(pdfHref);
    expect(pdfResponse.ok()).toBeTruthy();
    expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
  });

  test("record invoice payment", async ({ page }) => {
    await page.goto(`${invoiceUrl}/payment`);

    await expect(
      page.getByRole("heading", { name: "Record Payment" })
    ).toBeVisible();

    await selectFirstRealOption(page.locator('select[name="company_account_id"]'));
    await page.getByRole("button", { name: "Save Payment" }).click();

    await page.waitForURL(invoiceUrl);
    await expect(page.getByRole("link", { name: "Record Payment" })).toHaveCount(0);
    await expect(page.getByRole("row").filter({ hasText: /bank transfer/i })).toBeVisible();
  });

  test("create and issue a credit note, then verify original invoice settlement", async ({ page, request }) => {
    await page.goto("/billing/new");

    await expect(
      page.getByRole("heading", { name: "New Invoice" })
    ).toBeVisible();

    await selectRadixOption(page, "Client*", clientName);
    await selectRadixOption(page, "Property*", propertyTitle);

    await page.getByLabel("Description").fill(creditNoteInvoiceLineDescription);
    await page.getByLabel("Unit Price (€)").fill("120");
    await page.getByRole("button", { name: "Create Invoice" }).click();

    await page.waitForURL(/\/billing$/);

    const latestInvoiceRow = page
      .getByRole("row")
      .filter({ hasText: clientName })
      .first();
    await expect(latestInvoiceRow).toBeVisible();
    await Promise.all([
      page.waitForURL(/\/billing\/[^/]+$/),
      latestInvoiceRow.getByRole("link", { name: "View" }).click(),
    ]);
    const creditNoteSourceInvoiceUrl = page.url();

    await page.getByRole("button", { name: "Mark as Issued" }).click();
    await expect(
      page.getByText("Invoice marked as issued", { exact: true })
    ).toBeVisible();

    await page.getByRole("link", { name: "Create Credit Note" }).first().click();

    await page.waitForURL(/\/billing\/[^/]+\/credit-note\/new$/);
    await expect(
      page.getByRole("heading", { name: "New Credit Note" })
    ).toBeVisible();

    await page.getByLabel("Unit Price (€)").fill("20");
    await page.getByLabel("Notes").fill(creditNoteReason);
    await page.getByRole("button", { name: "Create Credit Note" }).click();

    await page.waitForURL(/\/billing\/[^/]+$/);
    await expect(
      page.getByRole("heading", { name: /Draft Credit Note|Credit Note/ })
    ).toBeVisible();
    await expect(page.getByText(creditNoteReason)).toBeVisible();

    await page.getByRole("button", { name: "Mark as Issued" }).click();
    await expect(
      page.getByText("Invoice marked as issued", { exact: true })
    ).toBeVisible();

    const creditNotePdfHref = await page
      .getByRole("link", { name: "Open PDF" })
      .getAttribute("href");
    if (!creditNotePdfHref) {
      throw new Error("Credit note PDF link is missing.");
    }

    const creditNotePdfResponse = await request.get(creditNotePdfHref);
    expect(creditNotePdfResponse.ok()).toBeTruthy();
    expect(creditNotePdfResponse.headers()["content-type"]).toContain("application/pdf");

    await page.goto(creditNoteSourceInvoiceUrl);
    await expect(page.getByRole("heading", { name: /INV-/ })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: /CN-|Credit Note/ }).first()).toBeVisible();
    await expect(page.getByText("-€23.60").first()).toBeVisible();
    await expect(page.getByText("€118.00").first()).toBeVisible();
  });

  test("cancel subscription", async ({ page }) => {
    await page.goto(subscriptionUrl);

    await expect(
      page.getByRole("heading", { name: "Contract" })
    ).toBeVisible();

    const cancelButton = page.getByRole("button", { name: "Cancel Contract" });

    if (await cancelButton.isVisible().catch(() => false)) {
      page.once("dialog", (dialog) => dialog.accept());
      await cancelButton.click();
      await page.waitForURL(/\/subscriptions$/);
      await expect(
        page.getByRole("heading", { name: "Contracts" })
      ).toBeVisible();
    }
  });
});

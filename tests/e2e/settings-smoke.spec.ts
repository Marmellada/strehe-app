import { expect, test } from "@playwright/test";
import { createSmokeValue } from "./utils";

test.describe.serial("STREHE settings smoke suite", () => {
  const seed = createSmokeValue("settings");
  const categoryName = `Smoke Category ${seed}`;
  const vendorName = `Smoke Vendor ${seed}`;
  const vendorContact = `Smoke Contact ${seed}`;

  test("settings landing and general settings load", async ({ page }) => {
    await page.goto("/settings");

    await expect(
      page.getByRole("heading", { name: "System Settings" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Open General Settings" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Manage Users" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Manage Categories" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Manage Vendors" })
    ).toBeVisible();

    await page.getByRole("link", { name: "Open General Settings" }).click();

    await page.waitForURL(/\/settings\/general$/);
    await expect(
      page.getByRole("heading", { name: "General Settings" })
    ).toBeVisible();
    await expect(page.locator('input[name="company_name"]')).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save Settings" })
    ).toBeVisible();
  });

  test("create, disable, and re-enable expense category", async ({ page }) => {
    await page.goto("/settings/expense-categories/new");

    await expect(
      page.getByRole("heading", { name: "New Expense Category" })
    ).toBeVisible();

    await page.getByLabel("Category name").fill(categoryName);
    await page.getByLabel("Description").fill(`Description ${seed}`);
    await page.getByLabel("Sort order").fill("901");
    await page.getByLabel("Status").selectOption("true");
    await page.getByRole("button", { name: "Create category" }).click();

    await page.waitForURL(/\/settings\/expense-categories$/);

    const categoryRow = page.getByRole("row").filter({ hasText: categoryName });
    await expect(categoryRow).toBeVisible();
    await expect(categoryRow.getByText("Active")).toBeVisible();

    await categoryRow.getByRole("button", { name: "Disable" }).click();
    await expect(categoryRow.getByRole("button", { name: "Enable" })).toBeVisible();
    await expect(categoryRow.getByText("Inactive")).toBeVisible();

    await categoryRow.getByRole("button", { name: "Enable" }).click();
    await expect(categoryRow.getByRole("button", { name: "Disable" })).toBeVisible();
    await expect(categoryRow.getByText("Active")).toBeVisible();
  });

  test("create, disable, and re-enable vendor", async ({ page }) => {
    await page.goto("/settings/vendors/new");

    await expect(
      page.getByRole("heading", { name: "New Vendor" })
    ).toBeVisible();

    await page.getByLabel("Vendor name").fill(vendorName);
    await page.getByLabel("Contact person").fill(vendorContact);
    await page.getByLabel("Email").fill(`${seed}@example.com`);
    await page.getByLabel("Phone").fill("+38344111000");
    await page.getByLabel("Address").fill("Smoke Vendor Street 1");
    await page.getByLabel("Notes").fill(`Vendor notes ${seed}`);
    await page.getByLabel("Status").selectOption("true");
    await page.getByRole("button", { name: "Create vendor" }).click();

    await page.waitForURL(/\/settings\/vendors$/);

    const vendorRow = page.getByRole("row").filter({ hasText: vendorName });
    await expect(vendorRow).toBeVisible();
    await expect(vendorRow.getByText("Active")).toBeVisible();

    await vendorRow.getByRole("button", { name: "Disable" }).click();
    await expect(vendorRow.getByRole("button", { name: "Enable" })).toBeVisible();
    await expect(vendorRow.getByText("Inactive")).toBeVisible();

    await vendorRow.getByRole("button", { name: "Enable" }).click();
    await expect(vendorRow.getByRole("button", { name: "Disable" })).toBeVisible();
    await expect(vendorRow.getByText("Active")).toBeVisible();
  });

  test("users page loads", async ({ page }) => {
    await page.goto("/settings/users");

    await expect(
      page.getByRole("heading", { name: "User Access Management" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Create Test User" })
    ).toBeVisible();

    const createTestUserForm = page
      .locator("form")
      .filter({ has: page.getByRole("button", { name: "Create Test User" }) });

    await expect(
      createTestUserForm.locator('input[name="full_name"]')
    ).toBeVisible();
    await expect(
      createTestUserForm.locator('input[name="email"]')
    ).toBeVisible();
    await expect(
      createTestUserForm.locator('input[name="password"]')
    ).toBeVisible();
    await expect(
      createTestUserForm.locator('select[name="role"]')
    ).toBeVisible();
  });
});

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

    await page.locator('input[name="name"]').fill(categoryName);
    await page.locator('textarea[name="description"]').fill(`Description ${seed}`);
    await page.locator('input[name="sort_order"]').fill("901");
    await page.locator('select[name="is_active"]').selectOption("true");
    await page.getByRole("button", { name: "Create Category" }).click();

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

    await page.locator('input[name="name"]').fill(vendorName);
    await page.locator('input[name="contact_person"]').fill(vendorContact);
    await page.locator('input[name="email"]').fill(`${seed}@example.com`);
    await page.locator('input[name="phone"]').fill("+38344111000");
    await page.locator('textarea[name="address"]').fill("Smoke Vendor Street 1");
    await page.locator('textarea[name="notes"]').fill(`Vendor notes ${seed}`);
    await page.locator('select[name="is_active"]').selectOption("true");
    await page.getByRole("button", { name: "Create Vendor" }).click();

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
      page.getByText("Manual Fallback")
    ).toBeVisible();

    const createTestUserForm = page
      .locator("form")
      .filter({ has: page.getByRole("button", { name: "Create Direct User" }) });

    await expect(
      createTestUserForm.locator('input[name="full_name"]')
    ).toBeVisible();
    await expect(
      createTestUserForm.locator('input[name="email"]')
    ).toBeVisible();
    await expect(
      createTestUserForm.locator('input[name="username"]')
    ).toBeVisible();
    await expect(
      createTestUserForm.locator('input[name="password"]')
    ).toBeVisible();
    await expect(
      createTestUserForm.locator('select[name="role"]')
    ).toBeVisible();
  });
});

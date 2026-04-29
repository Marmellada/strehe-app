import { expect, test } from "@playwright/test";
import {
  createSmokeValue,
  selectFirstRealOption,
  selectOptionContainingText,
} from "./utils";

test.describe.serial("task assignment smoke", () => {
  const seed = createSmokeValue("tasks");
  const clientName = `Tasks Client ${seed}`;
  const clientEmail = `${seed}@example.com`;
  const propertyTitle = `Tasks Property ${seed}`;
  const taskTitle = `Assigned Task ${seed}`;
  const taskReportNotes = `Task assignment smoke report ${seed}`;
  const today = new Date().toISOString().split("T")[0];

  let taskUrl = "";

  test("create assigned task and verify assignment workflow", async ({ page }) => {
    await page.goto("/clients/new");
    await expect(
      page.getByRole("heading", { name: /New Individual Client|Edit Client/ })
    ).toBeVisible();
    await page.getByLabel("Full Name").fill(clientName);
    await page.getByLabel("Phone").fill("+38344111555");
    await page.getByLabel("Email").fill(clientEmail);
    await selectFirstRealOption(page.getByLabel("Municipality"));
    const clientLocationSelect = page.getByLabel("Neighborhood / Village");
    if (!(await clientLocationSelect.isDisabled())) {
      await selectFirstRealOption(clientLocationSelect);
    }
    await page.getByLabel("Address Line 1").fill("Tasks Smoke Street 1");
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
      .fill("Tasks Smoke Property Address 1");
    await page.locator('select[name="property_type"]').selectOption("apartment");
    await page.getByRole("button", { name: "Save Property" }).click();
    await page.waitForURL(/\/properties$/);

    await page.goto("/tasks/create");
    await expect(page.getByRole("heading", { name: "Create Task" })).toBeVisible();
    await page.getByLabel("Title").fill(taskTitle);
    await page.getByLabel("Description").fill("Task assignment smoke description");
    await page.getByLabel("Status").selectOption("open");
    await page.getByLabel("Priority").selectOption("high");
    await selectOptionContainingText(page.getByLabel("Assign To"), "Playwright Admin");
    await page.getByLabel("Due Date").fill(today);
    await selectOptionContainingText(page.getByLabel("Property"), propertyTitle);
    await page.getByRole("button", { name: "Create Task" }).click();

    await page.waitForURL(/\/tasks$/);
    await page.getByRole("link", { name: taskTitle }).click();

    await page.waitForURL(/\/tasks\/[^/]+$/);
    taskUrl = new URL(page.url()).pathname;
    await expect(page.getByRole("heading", { name: taskTitle })).toBeVisible();
    await expect(page.getByText("Playwright Admin").first()).toBeVisible();
    await expect(page.getByText("High Priority")).toBeVisible();

    await page.getByRole("button", { name: "Unassign" }).click();
    await page.waitForURL(taskUrl);
    await expect(page.getByText("Unassigned").first()).toBeVisible();

    await page.getByRole("button", { name: "Assign to Me" }).click();
    await page.waitForURL(taskUrl);
    await expect(page.getByText("Playwright Admin").first()).toBeVisible();
    await expect(page.getByText("My Task")).toBeVisible();

    await page.getByRole("button", { name: "Mark In Progress" }).click();
    await page.waitForURL(taskUrl);
    await expect(page.getByText("In Progress").first()).toBeVisible();

    await page.getByRole("link", { name: "Add Report" }).click();
    await page.waitForURL(/\/tasks\/[^/]+\/report$/);
    await page.locator('select[name="report_type"]').selectOption("update");
    await page.locator('textarea[name="notes"]').fill(taskReportNotes);
    await page.getByRole("button", { name: "Submit Report" }).click();

    await page.waitForURL(taskUrl);
    await expect(page.getByText(taskReportNotes)).toBeVisible();
  });
});

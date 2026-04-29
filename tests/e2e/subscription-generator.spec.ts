import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  createSmokeValue,
  selectFirstRealOption,
  selectOptionContainingText,
} from "./utils";

function readEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env.local");

  if (!fs.existsSync(envPath)) {
    return new Map<string, string>();
  }

  const content = fs.readFileSync(envPath, "utf8");
  const values = new Map<string, string>();

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");

    values.set(key, value);
  }

  return values;
}

const envFileValues = readEnvFile();

function getConfigValue(name: string) {
  return process.env[name]?.trim() || envFileValues.get(name)?.trim() || "";
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

test.describe.serial("subscription task generator smoke", () => {
  const seed = createSmokeValue("generator");
  const clientName = `Generator Client ${seed}`;
  const clientEmail = `${seed}@example.com`;
  const propertyTitle = `Generator Property ${seed}`;
  const startDate = (() => {
    const date = new Date();
    date.setDate(date.getDate() + 3);
    return formatLocalDate(date);
  })();

  let subscriptionUrl = "";

  test("generate subscription tasks and avoid duplicates on rerun", async ({ page, request }) => {
    const cronSecret = getConfigValue("CRON_SECRET");

    if (!cronSecret) {
      throw new Error("Missing CRON_SECRET in environment or .env.local.");
    }

    await page.goto("/clients/new");
    await expect(
      page.getByRole("heading", { name: /New Individual Client|Edit Client/ })
    ).toBeVisible();
    await page.getByLabel("Full Name").fill(clientName);
    await page.getByLabel("Phone").fill("+38344111333");
    await page.getByLabel("Email").fill(clientEmail);
    await selectFirstRealOption(page.getByLabel("Municipality"));
    const clientLocationSelect = page.getByLabel("Neighborhood / Village");
    if (!(await clientLocationSelect.isDisabled())) {
      await selectFirstRealOption(clientLocationSelect);
    }
    await page.getByLabel("Address Line 1").fill("Generator Street 1");
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
    await page.locator('input[name="address_line_1"]').fill("Generator Property Address 1");
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
    await page.getByLabel("Start Date *").fill(startDate);
    await page.getByRole("button", { name: "Create Contract" }).click();

    await page.waitForURL(
      (url) =>
        /^\/subscriptions\/[^/]+$/.test(url.pathname) &&
        !url.pathname.endsWith("/create")
    );
    subscriptionUrl = page.url();

    await expect(page.getByRole("heading", { name: "Contract" })).toBeVisible();

    const noServicesLinked = page.getByText("No services linked");
    if (await noServicesLinked.isVisible().catch(() => false)) {
      throw new Error(
        "Selected package has no included services, so generator smoke cannot prove recurring task creation."
      );
    }

    const confirmFiledButton = page.getByRole("button", {
      name: "Confirm Signed & Filed",
    });

    if (await confirmFiledButton.isVisible().catch(() => false)) {
      await confirmFiledButton.click();
      await expect(page.getByText(/active/i)).toBeVisible();
      await expect(confirmFiledButton).toHaveCount(0);
    }

    const firstRunResponse = await request.get("/api/cron/generate-tasks", {
      headers: {
        authorization: `Bearer ${cronSecret}`,
      },
    });
    expect(firstRunResponse.ok()).toBeTruthy();
    const firstRunJson = await firstRunResponse.json();
    expect(firstRunJson.ok).toBeTruthy();
    expect(firstRunJson.result?.createdCount).toBeGreaterThan(0);

    await page.goto(subscriptionUrl);
    await expect(page.getByRole("heading", { name: "Contract" })).toBeVisible();
    await expect(page.getByText("No tasks linked yet")).toHaveCount(0);

    const taskLinks = page.locator('a[href^="/tasks/"]');
    const firstRunTaskCount = await taskLinks.count();
    expect(firstRunTaskCount).toBeGreaterThan(0);

    await taskLinks.first().click();
    await page.waitForURL(/\/tasks\/[^/]+$/);
    await expect(
      page.getByText("Auto-generated subscription task", { exact: true })
    ).toBeVisible();

    const secondRunResponse = await request.get("/api/cron/generate-tasks", {
      headers: {
        authorization: `Bearer ${cronSecret}`,
      },
    });
    expect(secondRunResponse.ok()).toBeTruthy();
    const secondRunJson = await secondRunResponse.json();
    expect(secondRunJson.ok).toBeTruthy();

    await page.goto(subscriptionUrl);
    await expect(page.getByRole("heading", { name: "Contract" })).toBeVisible();
    const secondRunTaskCount = await page.locator('a[href^="/tasks/"]').count();
    expect(secondRunTaskCount).toBe(firstRunTaskCount);
  });
});

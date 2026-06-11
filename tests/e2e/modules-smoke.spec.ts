import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

function getServiceConfig() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  const values = new Map<string, string>();

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;

    values.set(
      trimmed.slice(0, separatorIndex).trim(),
      trimmed
        .slice(separatorIndex + 1)
        .trim()
        .replace(/^['"]|['"]$/g, "")
    );
  }

  return {
    supabaseUrl:
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      values.get("NEXT_PUBLIC_SUPABASE_URL") ||
      "",
    serviceRoleKey:
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      values.get("SUPABASE_SERVICE_ROLE_KEY") ||
      "",
  };
}

test.describe("STREHË private module foundations", () => {
  test("household dashboard loads for an admin owner", async ({ page }) => {
    await page.goto("/household");

    await expect(
      page.getByRole("heading", { name: "Household", exact: true })
    ).toBeVisible();
    await expect(page.getByText("Local-first finance", { exact: true })).toBeVisible();
    await expect(page.getByText("Household Projects", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Temporary Agent Inbox", { exact: true })
    ).toBeVisible();
  });

  test("agent workspace loads without provisioned agents", async ({ page }) => {
    await page.goto("/agents");

    await expect(
      page.getByRole("heading", { name: "Agent Workspace", exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("No shared agent account", { exact: true })
    ).toBeVisible();
    await expect(page.getByText("Agent Registry", { exact: true })).toBeVisible();
    await expect(page.getByText("Recent Jobs", { exact: true })).toBeVisible();
  });

  test("household project can be created and edited", async ({ page }) => {
    const title = `Playwright Household ${Date.now()}`;
    const updatedTitle = `${title} Updated`;
    let projectId = "";

    try {
      await page.goto("/household/projects/new");

      await page.getByLabel("Project title").fill(title);
      await page
        .getByLabel("Shared notes and decisions")
        .fill("Initial shared decision.");
      await page.getByLabel("Target date").fill("2026-12-31");
      await page.getByRole("button", { name: "Create Project" }).click();

      await page.waitForURL(/\/household\/projects\/[^/]+$/);
      projectId = new URL(page.url()).pathname.split("/").pop() || "";

      await expect(
        page.getByRole("heading", { name: title, exact: true })
      ).toBeVisible();

      await page.getByLabel("Project title").fill(updatedTitle);
      await page
        .getByLabel("Shared notes and decisions")
        .fill("Updated shared decision.");
      await page.getByLabel("Status").selectOption("active");
      await page.getByRole("button", { name: "Save Project" }).click();

      await expect(
        page.getByRole("heading", { name: updatedTitle, exact: true })
      ).toBeVisible();
      await expect(page.getByLabel("Status")).toHaveValue("active");
    } finally {
      if (projectId) {
        const { supabaseUrl, serviceRoleKey } = getServiceConfig();
        const admin = createClient(supabaseUrl, serviceRoleKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        });

        await admin.from("household_projects").delete().eq("id", projectId);
      }
    }
  });
});

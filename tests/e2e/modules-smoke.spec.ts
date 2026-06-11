import { expect, test } from "@playwright/test";

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
});

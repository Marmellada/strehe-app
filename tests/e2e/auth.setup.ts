import { test as setup, expect } from "@playwright/test";
import { AUTH_FILE, requireEnv } from "./utils";

setup("login and save auth state", async ({ page }) => {
  const email = requireEnv("E2E_EMAIL");
  const password = requireEnv("E2E_PASSWORD");

  await page.goto("/auth/login");

  await expect(
    page.getByRole("heading", { name: "Sign in" })
  ).toBeVisible();

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.waitForURL((url) => !url.pathname.startsWith("/auth/login"));
  await page.goto("/clients");
  await expect(page.getByRole("heading", { name: "Clients" })).toBeVisible();

  await page.context().storageState({ path: AUTH_FILE });
});

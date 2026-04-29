import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { test as setup, expect } from "@playwright/test";
import { AUTH_FILE } from "./utils";

const DEFAULT_E2E_EMAIL = "playwright.admin@example.com";
const DEFAULT_E2E_USERNAME = "playwright.admin";
const DEFAULT_E2E_PASSWORD = "Playwright123!";

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

async function ensureE2EUser() {
  const supabaseUrl = getConfigValue("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getConfigValue("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase admin credentials for Playwright bootstrap. Expected NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  const email = getConfigValue("E2E_EMAIL") || DEFAULT_E2E_EMAIL;
  const username = getConfigValue("E2E_IDENTIFIER") || DEFAULT_E2E_USERNAME;
  const password = getConfigValue("E2E_PASSWORD") || DEFAULT_E2E_PASSWORD;
  const fullName = "Playwright Admin";

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  let existingAuthUserId: string | null = null;
  const { data: existingAppUser } = await admin
    .from("app_users")
    .select("id")
    .or(`email.eq.${email},username.eq.${username.toLowerCase()}`)
    .maybeSingle();

  if (existingAppUser?.id) {
    existingAuthUserId = existingAppUser.id;
  }

  let page = 1;

  while (!existingAuthUserId) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      throw new Error(`Playwright auth bootstrap failed: ${error.message}`);
    }

    const existingAuthUser = data.users.find(
      (user) => user.email?.toLowerCase() === email.toLowerCase()
    );

    if (existingAuthUser) {
      existingAuthUserId = existingAuthUser.id;
      break;
    }

    if (!data.nextPage) {
      break;
    }

    page = data.nextPage;
  }

  if (existingAuthUserId) {
    const { error } = await admin.auth.admin.updateUserById(existingAuthUserId, {
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

    if (error) {
      throw new Error(`Playwright auth update failed: ${error.message}`);
    }
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

    if (error || !data.user) {
      throw new Error(
        `Playwright auth bootstrap failed: ${error?.message || "Unknown user creation error."}`
      );
    }

    existingAuthUserId = data.user.id;
  }

  const { error: appUserError } = await admin.from("app_users").upsert(
    {
      id: existingAuthUserId,
      email,
      username: username.toLowerCase(),
      full_name: fullName,
      role: "admin",
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "id",
    }
  );

  if (appUserError) {
    throw new Error(`Playwright app user bootstrap failed: ${appUserError.message}`);
  }

  return {
    identifier: username,
    password,
  };
}

setup("login and save auth state", async ({ page }) => {
  const { identifier, password } = await ensureE2EUser();

  await page.goto("/clients");

  if (page.url().includes("/auth/login")) {
    await expect(
      page.getByRole("heading", { name: "Sign in" })
    ).toBeVisible();

    await page.getByLabel("Username or Email").fill(identifier);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
  }

  await page.waitForURL((url) => !url.pathname.startsWith("/auth/login"));
  await page.goto("/clients");
  await expect(page.getByRole("heading", { name: "Clients" })).toBeVisible();

  await page.context().storageState({ path: AUTH_FILE });
});

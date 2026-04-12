import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const APP_DIR = process.cwd();
const BASE_URL = process.env.MANUAL_BASE_URL || "http://127.0.0.1:3100";
const PORT = Number(new URL(BASE_URL).port || "3100");
const SCREENSHOT_DIR = path.join(APP_DIR, "docs", "manuals", "screenshots");
const ENV_PATH = path.join(APP_DIR, ".env.local");
const VIEWPORT = { width: 1440, height: 1080 };
const SHOULD_START_SERVER = !process.env.MANUAL_BASE_URL && BASE_URL.startsWith("http://127.0.0.1");
const ONLY_OUTPUTS = new Set(
  (process.env.MANUAL_ONLY || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);

function parseEnvFile(content) {
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      })
  );
}

async function loadEnv() {
  const content = await fs.readFile(ENV_PATH, "utf8");
  return parseEnvFile(content);
}

async function waitForServer(url, timeoutMs = 120_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status < 500) {
        return;
      }
    } catch {
      // server still starting
    }

    await delay(1_000);
  }

  throw new Error(`Timed out waiting for dev server at ${url}`);
}

function startDevServer() {
  const child =
    process.platform === "win32"
      ? spawn(
          process.env.ComSpec || "cmd.exe",
          [
            "/c",
            "npm",
            "run",
            "dev",
            "--",
            "--hostname",
            "127.0.0.1",
            "--port",
            String(PORT),
          ],
          {
            cwd: APP_DIR,
            stdio: ["ignore", "pipe", "pipe"],
            env: {
              ...process.env,
              PORT: String(PORT),
            },
          }
        )
      : spawn(
          "npm",
          ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(PORT)],
          {
            cwd: APP_DIR,
            stdio: ["ignore", "pipe", "pipe"],
            env: {
              ...process.env,
              PORT: String(PORT),
            },
          }
        );

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[dev] ${chunk}`);
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[dev] ${chunk}`);
  });

  return child;
}

function stopDevServer(child) {
  if (!child || child.killed) return;

  if (process.platform === "win32") {
    child.kill("SIGTERM");
  } else {
    child.kill("SIGTERM");
  }
}

async function createAdminClient(env) {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function createAnonClient(env) {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getFirstId(client, table) {
  const { data, error } = await client.from(table).select("id").limit(1);
  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }

  return data?.[0]?.id || null;
}

async function getSampleData(client) {
  const tables = {
    clientId: "clients",
    propertyId: "properties",
    taskId: "tasks",
    keyId: "keys",
    subscriptionId: "subscriptions",
    invoiceId: "invoices",
    expenseId: "expenses",
    serviceId: "services",
    packageId: "packages",
    workerId: "workers",
    vendorId: "vendors",
    expenseCategoryId: "expense_categories",
    bankAccountId: "company_bank_accounts",
    bankId: "banks",
    bankRuleId: "bank_identifiers",
  };

  const entries = await Promise.all(
    Object.entries(tables).map(async ([key, table]) => [key, await getFirstId(client, table)])
  );

  const sampleData = Object.fromEntries(entries);

  const { data: roles, error: rolesError } = await client
    .from("app_users")
    .select("email, role, is_active")
    .eq("is_active", true);

  if (rolesError) {
    throw new Error(`app_users: ${rolesError.message}`);
  }

  sampleData.adminEmail =
    roles?.find((row) => row.role === "admin" && row.email)?.email || null;
  sampleData.fieldEmail =
    roles?.find((row) => (row.role === "field" || row.role === "contractor") && row.email)?.email ||
    null;

  return sampleData;
}

async function generateLink(client, type, email, redirectTo) {
  const { data, error } = await client.auth.admin.generateLink({
    type,
    email,
    options: { redirectTo },
  });

  if (error) {
    throw new Error(`${type} link for ${email}: ${error.message}`);
  }

  const actionLink = data?.properties?.action_link;
  if (!actionLink) {
    throw new Error(`${type} link for ${email}: missing action link`);
  }

  return actionLink;
}

function getAuthCookieName(supabaseUrl) {
  return `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
}

function serializeSessionCookie(session) {
  return `base64-${Buffer.from(JSON.stringify(session), "utf8").toString("base64")}`;
}

async function createSessionFromLink(env, adminClient, email, type) {
  const anonClient = createAnonClient(env);
  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type,
    email,
    options: { redirectTo: `${BASE_URL}/` },
  });

  if (linkError) {
    throw new Error(`${type} link for ${email}: ${linkError.message}`);
  }

  const tokenHash = linkData?.properties?.hashed_token;
  if (!tokenHash) {
    throw new Error(`${type} link for ${email}: missing hashed token`);
  }

  const { data, error } = await anonClient.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error || !data.session) {
    throw new Error(`${type} verify for ${email}: ${error?.message || "missing session"}`);
  }

  return data.session;
}

async function waitForPageReady(page, expectedHeading) {
  await page.waitForLoadState("domcontentloaded");

  if (expectedHeading) {
    await page
      .getByRole("heading", { name: expectedHeading, exact: false })
      .first()
      .waitFor({ state: "visible", timeout: 20_000 });
  } else {
    const heading = page.locator("h1").first();
    if ((await heading.count()) > 0) {
      await heading.waitFor({ state: "visible", timeout: 20_000 });
    } else {
      await page.locator("body").waitFor({ state: "visible", timeout: 20_000 });
    }
  }

  await delay(800);
}

async function captureRoute(page, outputName, route, expectedHeading) {
  const absoluteUrl = route.startsWith("http") ? route : `${BASE_URL}${route}`;
  console.log(`Capturing ${outputName} <- ${absoluteUrl}`);
  await page.goto(absoluteUrl, { waitUntil: "load", timeout: 30_000 });
  await waitForPageReady(page, expectedHeading);
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, outputName),
    fullPage: true,
  });
}

async function signInWithSession(browser, env, session, landingPath = "/") {
  const context = await browser.newContext({ viewport: VIEWPORT });
  const base = new URL(BASE_URL);
  await context.addCookies([
    {
      name: getAuthCookieName(env.NEXT_PUBLIC_SUPABASE_URL),
      value: serializeSessionCookie(session),
      domain: base.hostname,
      path: "/",
      expires: session.expires_at || Math.floor(Date.now() / 1000) + 3600,
      httpOnly: false,
      secure: base.protocol === "https:",
      sameSite: "Lax",
    },
  ]);
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(30_000);

  if (landingPath) {
    await page.goto(`${BASE_URL}${landingPath}`, { waitUntil: "load", timeout: 30_000 });
    await delay(1_000);
  }

  return { context, page };
}

function routeIfSample(outputName, routeBuilder, expectedHeading, sampleKey) {
  return { outputName, routeBuilder, expectedHeading, sampleKey };
}

async function main() {
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });

  const env = await loadEnv();
  const client = await createAdminClient(env);
  const sample = await getSampleData(client);

  if (!sample.adminEmail) {
    throw new Error("No active admin email found in app_users.");
  }

  const server = SHOULD_START_SERVER ? startDevServer() : null;
  const browser = await chromium.launch({ headless: true });

  try {
    if (SHOULD_START_SERVER) {
      await waitForServer(BASE_URL);
    }

    const loginContext = await browser.newContext({ viewport: VIEWPORT });
    const loginPage = await loginContext.newPage();
    await captureRoute(loginPage, "auth-login.png", "/auth/login", "Sign in");
    await loginContext.close();

    const recoverySession = await createSessionFromLink(env, client, sample.adminEmail, "recovery");
    const { context: recoveryContext, page: recoveryPage } = await signInWithSession(
      browser,
      env,
      recoverySession,
      "/auth/setup-password"
    );
    await captureRoute(recoveryPage, "auth-setup-password.png", "/auth/setup-password", "Set password");
    await recoveryContext.close();

    const adminSession = await createSessionFromLink(env, client, sample.adminEmail, "magiclink");
    const { context: adminContext, page: adminPage } = await signInWithSession(
      browser,
      env,
      adminSession,
      "/"
    );

    const adminRoutes = [
      routeIfSample("dashboard-admin.png", () => "/", "Dashboard"),
      routeIfSample("clients-list.png", () => "/clients", "Clients"),
      routeIfSample("clients-new.png", () => "/clients/new"),
      routeIfSample("clients-detail.png", ({ clientId }) => `/clients/${clientId}`, undefined, "clientId"),
      routeIfSample("clients-edit.png", ({ clientId }) => `/clients/${clientId}/edit`, "Edit Client", "clientId"),
      routeIfSample("properties-list.png", () => "/properties", "Properties"),
      routeIfSample("properties-new.png", () => "/properties/new", "New Property"),
      routeIfSample("properties-detail.png", ({ propertyId }) => `/properties/${propertyId}`, undefined, "propertyId"),
      routeIfSample("properties-edit.png", ({ propertyId }) => `/properties/${propertyId}/edit`, "Edit Property", "propertyId"),
      routeIfSample("properties-keys-list.png", ({ propertyId }) => `/properties/${propertyId}/keys`, undefined, "propertyId"),
      routeIfSample("properties-keys-new.png", ({ propertyId }) => `/properties/${propertyId}/keys/new`, "Add Key", "propertyId"),
      routeIfSample("tasks-list.png", () => "/tasks", "Tasks"),
      routeIfSample("tasks-new.png", () => "/tasks/create"),
      routeIfSample("tasks-detail.png", ({ taskId }) => `/tasks/${taskId}`, undefined, "taskId"),
      routeIfSample("tasks-edit.png", ({ taskId }) => `/tasks/${taskId}/edit`, undefined, "taskId"),
      routeIfSample("tasks-report.png", ({ taskId }) => `/tasks/${taskId}/report`, undefined, "taskId"),
      routeIfSample("keys-list.png", () => "/keys", "Keys"),
      routeIfSample("keys-detail.png", ({ keyId }) => `/keys/${keyId}`, undefined, "keyId"),
      routeIfSample("contracts-list.png", () => "/subscriptions", "Contracts"),
      routeIfSample("contracts-new.png", () => "/subscriptions/create", "New Contract"),
      routeIfSample("contracts-detail.png", ({ subscriptionId }) => `/subscriptions/${subscriptionId}`, undefined, "subscriptionId"),
      routeIfSample("contracts-edit.png", ({ subscriptionId }) => `/subscriptions/${subscriptionId}/edit`, undefined, "subscriptionId"),
      routeIfSample("billing-list.png", () => "/billing", "Invoices"),
      routeIfSample("billing-new.png", () => "/billing/new", "New Invoice"),
      routeIfSample("billing-detail.png", ({ invoiceId }) => `/billing/${invoiceId}`, undefined, "invoiceId"),
      routeIfSample("billing-edit.png", ({ invoiceId }) => `/billing/${invoiceId}/edit`, undefined, "invoiceId"),
      routeIfSample("billing-record-payment.png", ({ invoiceId }) => `/billing/${invoiceId}/payment`, "Record Payment", "invoiceId"),
      routeIfSample("billing-payments-history.png", () => "/billing/payments", "Payments"),
      routeIfSample("billing-credit-note-new.png", ({ invoiceId }) => `/billing/${invoiceId}/credit-note/new`, "New Credit Note", "invoiceId"),
      routeIfSample("expenses-list.png", () => "/expenses", "Expenses"),
      routeIfSample("expenses-new.png", () => "/expenses/new", "New Expense"),
      routeIfSample("expenses-detail.png", ({ expenseId }) => `/expenses/${expenseId}`, undefined, "expenseId"),
      routeIfSample("expenses-edit.png", ({ expenseId }) => `/expenses/${expenseId}/edit`, "Edit Expense", "expenseId"),
      routeIfSample("finance-overview.png", () => "/finance", "Finance Overview"),
      routeIfSample("services-list.png", () => "/services", "Services"),
      routeIfSample("services-new.png", () => "/services/create", "New Service"),
      routeIfSample("services-detail.png", ({ serviceId }) => `/services/${serviceId}`, undefined, "serviceId"),
      routeIfSample("services-edit.png", ({ serviceId }) => `/services/${serviceId}/edit`, "Edit Service", "serviceId"),
      routeIfSample("packages-list.png", () => "/packages", "Packages"),
      routeIfSample("packages-new.png", () => "/packages/create", "New Package"),
      routeIfSample("packages-detail.png", ({ packageId }) => `/packages/${packageId}`, undefined, "packageId"),
      routeIfSample("packages-edit.png", ({ packageId }) => `/packages/${packageId}/edit`, "Edit Package", "packageId"),
      routeIfSample("workers-list.png", () => "/workers", "Staff"),
      routeIfSample("workers-new.png", () => "/workers/new", "New Staff"),
      routeIfSample("workers-detail.png", ({ workerId }) => `/workers/${workerId}`, undefined, "workerId"),
      routeIfSample("settings-hub.png", () => "/settings", "System Settings"),
      routeIfSample("settings-general.png", () => "/settings/general", "General Settings"),
      routeIfSample("settings-banking.png", () => "/settings/banking", "Banking"),
      routeIfSample("settings-banking-account-new.png", () => "/settings/banking/new"),
      routeIfSample("settings-banking-account-edit.png", ({ bankAccountId }) => `/settings/banking/${bankAccountId}`, "Edit Bank Account", "bankAccountId"),
      routeIfSample("settings-banking-bank-new.png", () => "/settings/banking/banks/new"),
      routeIfSample("settings-banking-bank-edit.png", ({ bankId }) => `/settings/banking/banks/${bankId}`, "Edit Licensed Bank", "bankId"),
      routeIfSample("settings-banking-detection.png", () => "/settings/banking/detection", "Detection Lab"),
      routeIfSample("settings-banking-rule-new.png", () => "/settings/banking/detection/new"),
      routeIfSample("settings-banking-rule-edit.png", ({ bankRuleId }) => `/settings/banking/detection/${bankRuleId}`, "Edit Detection Rule", "bankRuleId"),
      routeIfSample("settings-users.png", () => "/settings/users", "Users"),
      routeIfSample("settings-expense-categories-list.png", () => "/settings/expense-categories", "Expense Categories"),
      routeIfSample("settings-expense-categories-new.png", () => "/settings/expense-categories/new", "New Expense Category"),
      routeIfSample("settings-expense-categories-edit.png", ({ expenseCategoryId }) => `/settings/expense-categories/${expenseCategoryId}/edit`, "Edit Expense Category", "expenseCategoryId"),
      routeIfSample("settings-vendors-list.png", () => "/settings/vendors", "Vendors"),
      routeIfSample("settings-vendors-new.png", () => "/settings/vendors/new", "New Vendor"),
      routeIfSample("settings-vendors-edit.png", ({ vendorId }) => `/settings/vendors/${vendorId}/edit`, "Edit Vendor", "vendorId"),
      routeIfSample("settings-appearance-editor.png", () => "/ui-preview", "UI Preview"),
      routeIfSample("users-legacy-list.png", () => "/users", "Users"),
      routeIfSample("users-legacy-create.png", () => "/users/create", "Users"),
      routeIfSample("users-legacy-detail.png", () => "/users/legacy-redirect", "Users"),
      routeIfSample("unauthorized.png", () => "/unauthorized", "Access Denied"),
    ];

    for (const route of adminRoutes) {
      if (ONLY_OUTPUTS.size > 0 && !ONLY_OUTPUTS.has(route.outputName)) {
        continue;
      }

      if (route.sampleKey && !sample[route.sampleKey]) {
        console.warn(`Skipping ${route.outputName}: missing ${route.sampleKey}`);
        continue;
      }

      const resolvedRoute = route.routeBuilder(sample);

      try {
        await captureRoute(adminPage, route.outputName, resolvedRoute, route.expectedHeading);
      } catch (error) {
        console.warn(`Failed to capture ${route.outputName}: ${error.message}`);
      }
    }

    await adminContext.close();

    if (sample.fieldEmail) {
      const fieldSession = await createSessionFromLink(env, client, sample.fieldEmail, "magiclink");
      const { context: fieldContext, page: fieldPage } = await signInWithSession(
        browser,
        env,
        fieldSession,
        "/"
      );

      try {
        await captureRoute(fieldPage, "dashboard-field.png", "/", "Dashboard");
      } catch (error) {
        console.warn(`Failed to capture dashboard-field.png: ${error.message}`);
      }

      try {
        await captureRoute(fieldPage, "unauthorized.png", "/settings", "Access Denied");
      } catch (error) {
        console.warn(`Failed to capture unauthorized.png from field route: ${error.message}`);
      }

      await fieldContext.close();
    } else {
      console.warn("Skipping field dashboard and role-based unauthorized capture: no active field/contractor account found.");
    }

    console.log(`Screenshots saved to ${SCREENSHOT_DIR}`);
  } finally {
    await browser.close().catch(() => {});
    stopDevServer(server);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

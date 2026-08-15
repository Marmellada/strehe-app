import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/unit",
  testMatch: /(internal-path|public-contact|inquiry-notification-email|inspection-lab-access|founding-funnel|cron-authorization|meta-webhook)\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
});

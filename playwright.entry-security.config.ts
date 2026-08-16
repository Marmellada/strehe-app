import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/unit",
  testMatch: /(internal-path|public-contact|inquiry-notification-email|inspection-lab-access|founding-funnel|cron-authorization|meta-webhook|seo-discoverability|messaging-parser|messaging-normalize|messaging-ingest|meta-ingest-cron)\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
});

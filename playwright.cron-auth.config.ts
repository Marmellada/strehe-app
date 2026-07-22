import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/unit",
  testMatch: /cron-authorization\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
});

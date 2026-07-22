import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/unit",
  testMatch: /(internal-path|public-contact)\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
});

import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT || "3000");
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["list"],
    ["html", { open: "never" }],
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "smoke-chromium",
      dependencies: ["setup"],
      testMatch: /(^|[\\/])smoke\.spec\.ts$/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
    },
    {
      name: "settings-smoke-chromium",
      dependencies: ["setup"],
      testMatch: /(^|[\\/])settings-smoke\.spec\.ts$/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
      },
});

import { defineConfig, devices } from "@playwright/test";

const port = 3100;

export default defineConfig({
  testDir: "./e2e",
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm build && pnpm start",
    url: `http://127.0.0.1:${port}`,
    env: {
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      APP_URL: `http://127.0.0.1:${port}`,
      APP_SECRET: "e2e-only-secret-value-that-is-long-enough-0123456789",
      DATA_DIR: "test-results/e2e-data",
    },
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});

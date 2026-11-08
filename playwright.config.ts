import { defineConfig, devices } from "@playwright/test";

// Next.js allows one dev server per project folder, so reuse `npm run dev` when it's running.
const port = 3000;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "api", testMatch: /rls\.spec\.ts/ },
    { name: "phone", testIgnore: /rls\.spec\.ts/, use: { ...devices["Pixel 7"] } },
    { name: "tablet", testIgnore: /rls\.spec\.ts/, use: { ...devices["Galaxy Tab S9 landscape"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

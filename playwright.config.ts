import { defineConfig, devices } from "@playwright/test";

// Default: run against a local dev server using the in-memory mock (deterministic,
// no real Supabase data touched). Pass PLAYWRIGHT_BASE_URL to target a deployed
// preview/prod instead — that also disables the local server.
const previewURL = process.env.PLAYWRIGHT_BASE_URL;
const LOCAL_URL = "http://localhost:5173";
const baseURL = previewURL ?? LOCAL_URL;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Mobile-first — matches primary use case
    ...devices["Pixel 5"],
  },
  projects: [
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],
  // Only start a local server when targeting localhost (no preview override).
  webServer: previewURL
    ? undefined
    : {
        command: "npm run dev",
        url: LOCAL_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
        env: { VITE_E2E_MOCK: "1" },
      },
});

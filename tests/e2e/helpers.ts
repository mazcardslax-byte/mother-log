import { expect, type Page } from "@playwright/test";

// Navigate to the app and wait for the tab bar to be interactive.
export async function gotoApp(page: Page) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("button", { name: /mothers/i })).toBeVisible({
    timeout: 15000,
  });
}

// Click a tab by its visible label (e.g. "Dry Room").
export async function openTab(page: Page, label: string) {
  const tab = page
    .getByTestId("tab-nav")
    .getByRole("button", { name: label, exact: true });
  await tab.click();
  // Lazy tabs (Clones/Stats/DryRoom) render via Suspense — allow the chunk to load.
  await page.waitForLoadState("networkidle");
}

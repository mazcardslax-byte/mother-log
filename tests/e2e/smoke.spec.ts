import { test, expect } from "@playwright/test";

test("app loads and shows tab navigation", async ({ page }) => {
  await page.goto("/");
  // App should render without crashing
  await expect(page.locator("body")).toBeVisible();
  // At least one tab should be present
  await expect(page.getByRole("button").first()).toBeVisible({
    timeout: 10000,
  });
});

test("Mothers tab is reachable", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  // Look for the Mothers tab button
  const mothersTab = page.getByRole("button", { name: /mothers/i });
  await expect(mothersTab).toBeVisible({ timeout: 10000 });
  await mothersTab.click();
});

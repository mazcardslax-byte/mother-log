import { test, expect } from "@playwright/test";

test.describe("Clones tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Wait for the app shell to render
    await page.waitForSelector("body", { state: "attached" });
  });

  test("loads without crash", async ({ page }) => {
    // Navigate to Clones tab — look for the tab button in the main nav
    const clonesTab = page.getByRole("button", { name: /clones/i });
    await expect(clonesTab).toBeVisible({ timeout: 10_000 });
    await clonesTab.click();

    // No error boundary / crash message should be present
    await expect(page.locator("text=Something went wrong")).not.toBeVisible();
    await expect(page.locator("text=TypeError")).not.toBeVisible();
  });

  test("renders sub-tab navigation", async ({ page }) => {
    const clonesTab = page.getByRole("button", { name: /clones/i });
    await expect(clonesTab).toBeVisible({ timeout: 10_000 });
    await clonesTab.click();

    // ClonesTab has its own sub-tabs: Summary, Log, Add Entry, Trays, Strains
    await expect(page.getByRole("button", { name: "Summary" })).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole("button", { name: "Log" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Entry" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Trays" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Strains" })).toBeVisible();
  });

  test("Summary sub-tab shows active/transplanted stat boxes", async ({ page }) => {
    const clonesTab = page.getByRole("button", { name: /clones/i });
    await expect(clonesTab).toBeVisible({ timeout: 10_000 });
    await clonesTab.click();

    // Summary is the default sub-tab — stat boxes should be visible
    await expect(page.getByText(/Cloned \/ In Tray/i)).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(/Transplanted/i)).toBeVisible();
  });

  test("Add Entry sub-tab has quick entry input", async ({ page }) => {
    const clonesTab = page.getByRole("button", { name: /clones/i });
    await expect(clonesTab).toBeVisible({ timeout: 10_000 });
    await clonesTab.click();

    await page.getByRole("button", { name: "Add Entry" }).click();

    // Quick entry input should be visible
    await expect(page.getByPlaceholder(/e\.g\. 19 2023b/i)).toBeVisible({ timeout: 8_000 });
  });

  test("Trays sub-tab renders tray manager form", async ({ page }) => {
    const clonesTab = page.getByRole("button", { name: /clones/i });
    await expect(clonesTab).toBeVisible({ timeout: 10_000 });
    await clonesTab.click();

    await page.getByRole("button", { name: "Trays" }).click();

    // Tray manager should have "Log a Clone Tray" label or Add Tray button
    await expect(
      page.getByText(/Log a Clone Tray/i).or(page.getByRole("button", { name: /Add Tray/i }))
    ).toBeVisible({ timeout: 8_000 });
  });
});

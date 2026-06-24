import { test, expect } from "@playwright/test";
import { gotoApp, openTab } from "./helpers";

const TABS = [
  "Summary",
  "Mothers",
  "Room",
  // "Facility", — tab sidelined in App.jsx; restore here when re-enabled
  "Stats",
  "Dry Room",
  "Clones",
];

test.describe("each tab renders without crashing", () => {
  for (const label of TABS) {
    test(`${label} tab renders`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));

      await gotoApp(page);
      await openTab(page, label);

      // The tab content area should be visible and the app must not have thrown.
      await expect(page.locator("body")).toBeVisible();
      expect(
        errors,
        `uncaught errors on ${label}: ${errors.join(" | ")}`
      ).toEqual([]);
    });
  }
});

test("Stats tab shows seeded survival data", async ({ page }) => {
  await gotoApp(page);
  await openTab(page, "Stats");
  // Seed has one Done tray: 34/50 = 68% survival (Grape Cake Mintz).
  // The value appears in the Overall stat box, the by-strain bar, and the
  // strain-comparison table — use .first() to target the Overall summary card.
  await expect(page.getByText(/68\s*%/).first()).toBeVisible({
    timeout: 15000,
  });
});

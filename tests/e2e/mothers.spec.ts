import { test, expect } from "@playwright/test";
import { gotoApp, openTab } from "./helpers";

// Helper: expand the Grape Cake Mintz strain group (if collapsed) and click the card.
// The StrainGroup header button shows the strain name too; clicking it toggles
// collapse. We expand first, then target the card inside the group by its code text.
async function openGrapeCakeMother(page: import("@playwright/test").Page) {
  // The strain group header button contains "Grape Cake Mintz" text.
  // Clicking it expands the group (it may already be expanded — idempotent).
  const groupHeader = page.getByRole("button", { name: /Grape Cake Mintz/i });
  await expect(groupHeader).toBeVisible({ timeout: 15000 });
  // Check if group is already expanded (card with code "2002" visible).
  const card2002 = page.getByText("2002").first();
  const isExpanded = await card2002.isVisible().catch(() => false);
  if (!isExpanded) {
    await groupHeader.click();
  }
  // Now the mother card is visible. The card has strain code "2002" as bold text.
  // Clicking anywhere on the card (via the code text) triggers onOpenQuickLog.
  await expect(card2002).toBeVisible({ timeout: 5000 });
  await card2002.click();
}

test("mother card opens the quick-log hub sheet", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await gotoApp(page);
  await openTab(page, "Mothers");

  await openGrapeCakeMother(page);

  // Quick-log hub: the actual action labels are Transplant / Clone / Reduce / Amendment.
  // (Memory described Water/Amendment/Clone Cut/Reduction — those differ from live DOM.)
  await expect(
    page.getByText(/Transplant|Clone|Reduce|Amendment/i).first()
  ).toBeVisible({ timeout: 10000 });
  expect(errors, errors.join(" | ")).toEqual([]);
});

test("quick-log hub opens the full detail modal", async ({ page }) => {
  await gotoApp(page);
  await openTab(page, "Mothers");

  await openGrapeCakeMother(page);

  // The hub sheet renders a "View Details →" button (literal → char in text).
  const viewDetails = page.getByRole("button", { name: /view details/i });
  await expect(viewDetails).toBeVisible({ timeout: 10000 });
  await viewDetails.click();

  // Detail modal opens with "Overview" as the default tab.
  // The tab bar inside the modal has a button labelled "Overview".
  await expect(
    page.getByRole("button", { name: /overview/i }).first()
  ).toBeVisible({ timeout: 10000 });
});

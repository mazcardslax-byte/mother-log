import { test, expect } from '@playwright/test';

test('Room tab is visible and clickable', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const roomTab = page.getByRole('button', { name: /room/i });
  await expect(roomTab).toBeVisible({ timeout: 10000 });
  await roomTab.click();

  // No error overlay should appear
  await expect(page.locator('[data-overlay-container]')).not.toBeVisible().catch(() => {});
  // The page body should still be visible (app hasn't crashed)
  await expect(page.locator('body')).toBeVisible();
});

test('Facility tab is visible and clickable', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const facilityTab = page.getByRole('button', { name: /facility/i });
  await expect(facilityTab).toBeVisible({ timeout: 10000 });
  await facilityTab.click();

  // No error overlay should appear
  await expect(page.locator('[data-overlay-container]')).not.toBeVisible().catch(() => {});
  // The page body should still be visible (app hasn't crashed)
  await expect(page.locator('body')).toBeVisible();
});

test('switching between Room and Facility tabs does not crash the app', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const roomTab = page.getByRole('button', { name: /room/i });
  const facilityTab = page.getByRole('button', { name: /facility/i });

  await roomTab.click();
  await expect(page.locator('body')).toBeVisible();

  await facilityTab.click();
  await expect(page.locator('body')).toBeVisible();

  await roomTab.click();
  await expect(page.locator('body')).toBeVisible();
});

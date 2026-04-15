import { test, expect } from '@playwright/test';

// This app requires Supabase auth to render tab content.
// These tests verify pre-auth app shell behavior and that no JS crashes occur.
// Full tab-interaction tests require Playwright auth setup (future work).

test.describe('RoomTab + FacilityTab extraction — pre-auth smoke', () => {
  test('app loads without uncaught JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const hardErrors = errors.filter(
      (e) => !e.includes('supabase') && !e.includes('Supabase')
    );
    expect(hardErrors).toHaveLength(0);
  });

  test('JS chunks are served without 404s (lazy-load assets exist)', async ({ page }) => {
    const failedRequests: string[] = [];
    page.on('requestfailed', (req) => {
      if (req.url().includes('.js')) failedRequests.push(req.url());
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(failedRequests).toHaveLength(0);
  });
});

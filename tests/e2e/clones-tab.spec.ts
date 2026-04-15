import { test, expect } from '@playwright/test';

// This app requires Supabase auth to render tab content.
// These tests verify pre-auth app shell behavior and that no JS crashes occur.
// Full tab-interaction tests require Playwright auth setup (future work).

test.describe('Clones tab — pre-auth smoke', () => {
  test('app loads without uncaught JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Filter out expected Supabase auth noise
    const hardErrors = errors.filter(
      (e) => !e.includes('supabase') && !e.includes('Supabase')
    );
    expect(hardErrors).toHaveLength(0);
  });

  test('React root mounts successfully', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#root')).toBeAttached();
  });

  test('dark theme CSS is applied — not a blank white screen', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const bg = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor
    );
    // Dark theme background should not be plain white
    expect(bg).not.toBe('rgb(255, 255, 255)');
  });
});

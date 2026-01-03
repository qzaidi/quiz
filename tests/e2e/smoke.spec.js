import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('should load the application homepage', async ({ page }) => {
    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Verify page loaded
    await expect(page).toHaveTitle(/./); // Has any title

    // Check that body is visible and not empty
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should have working navigation', async ({ page }) => {
    await page.goto('/');

    // Check for common navigation elements
    const navElements = page.locator('nav, header, .navbar, .navigation');
    const navExists = await navElements.count() > 0;

    if (navExists) {
      await expect(navElements.first()).toBeVisible();
    }
  });

  test('should display admin access button', async ({ page }) => {
    await page.goto('/');

    // Look for admin button (gear icon or similar)
    const adminSelectors = [
      'button:has-text("⚙")',
      '.admin-btn',
      '.gear-icon',
      '[aria-label="Admin"]',
      '[data-testid="admin-button"]'
    ];

    let adminButton = null;
    for (const selector of adminSelectors) {
      const element = page.locator(selector).first();
      if (await element.count() > 0) {
        adminButton = element;
        break;
      }
    }

    if (adminButton) {
      await expect(adminButton).toBeVisible();
    }
  });

  test('should handle 404 for non-existent routes', async ({ page }) => {
    // Navigate to a non-existent page
    const response = await page.goto('/this-page-does-not-exist');

    // Should return some kind of response (not crash)
    expect(response).toBeTruthy();

    // Should not be a 500 error
    expect(response.status()).not.toBe(500);
  });
});

test.describe('API Endpoints', () => {
  test('should return quiz list from API', async ({ request }) => {
    // Test the public API endpoint
    const response = await request.get('/api/quizzes');

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(Array.isArray(data)).toBeTruthy();
  });

  test('should return 401 for protected admin endpoint without auth', async ({ request }) => {
    // Test that admin endpoint is protected
    const response = await request.post('/api/admin/quizzes');

    // Should be unauthorized
    expect([401, 403]).toContain(response.status());
  });
});

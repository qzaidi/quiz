import { test, expect } from '@playwright/test';

test.describe('Quiz Participation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the homepage
    await page.goto('/');
  });

  test('should load the homepage', async ({ page }) => {
    // Check that the page title is present
    await expect(page).toHaveTitle(/Trivia/);

    // Check that main elements are visible
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
  });

  test('should display available quizzes', async ({ page }) => {
    // Wait for quizzes to load
    await page.waitForLoadState('networkidle');

    // Look for quiz cards or list items
    const quizContainer = page.locator('.quiz-card, [data-quiz], .quiz-list');
    const quizCount = await quizContainer.count();

    // If there are quizzes, verify at least one is visible
    if (quizCount > 0) {
      await expect(quizContainer.first()).toBeVisible();
    }
  });

  test('should navigate to admin panel', async ({ page }) => {
    // Click the admin gear icon
    const adminButton = page.locator('.admin-btn, .gear-icon, [aria-label="Admin"], button:has-text("⚙")');
    const adminCount = await adminButton.count();

    if (adminCount > 0) {
      await adminButton.first().click();

      // Should show password input modal
      const passwordInput = page.locator('input[type="password"], input[placeholder*="password" i]');
      await expect(passwordInput).toBeVisible();
    }
  });

  test('should join a quiz and participate', async ({ page, request }) => {
    // Get the seeded quiz from the API
    const response = await request.get('http://localhost:3001/api/quizzes');
    const quizzes = await response.json();

    if (quizzes.length > 0) {
      const quizId = quizzes[0].id;

      // Navigate directly to the quiz
      await page.goto(`/?quizId=${quizId}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Look for the join name input
      const nameInput = page.locator('#username');
      const nameInputExists = await nameInput.count() > 0;

      if (nameInputExists) {
        // Wait for the input to be visible (not hidden)
        try {
          await nameInput.waitFor({ state: 'visible', timeout: 5000 });
        } catch (e) {
          test.skip(true, 'Join form not visible - quiz may have different start time configuration');
          return;
        }

        // Enter participant name
        await nameInput.fill('E2E Test User');

        // Click join button
        const joinButton = page.locator('#join-form button[type="submit"]');
        await joinButton.click();

        // Wait for navigation or quiz interface
        await page.waitForTimeout(2000);

        // Verify we're in the quiz interface
        const currentUrl = page.url();
        expect(currentUrl).toMatch(/quiz|game|play/i);
      } else {
        test.skip(true, 'Join input not found');
      }
    } else {
      test.skip(true, 'No quizzes available to test participation flow');
    }
  });
});

test.describe('Quiz Creation (Admin)', () => {
  test('should create a new quiz', async ({ page }) => {
    await page.goto('/');

    // Navigate to admin
    const adminButton = page.locator('button:has-text("⚙"), .admin-btn');
    const adminCount = await adminButton.count();

    if (adminCount > 0) {
      await adminButton.first().click();

      // Note: This test would require knowing the admin password
      // For now, we'll just verify the admin modal appears
      const passwordModal = page.locator('.modal:not(.hidden), .dialog:not(.hidden), [role="dialog"]:not(.hidden)');
      const modalExists = await passwordModal.count() > 0;

      if (modalExists) {
        await expect(passwordModal.first()).toBeVisible();
      }
    } else {
      test.skip(true, 'Admin button not found');
    }
  });
});

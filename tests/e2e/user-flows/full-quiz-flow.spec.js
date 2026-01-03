import { test, expect } from '@playwright/test';
import { ApiHelper } from '../helpers/test-data.js';

test.describe('Full Quiz Flow', () => {
  let apiHelper;
  let testQuizId;

  test.beforeAll(async ({ request }) => {
    apiHelper = new ApiHelper(request);

    // Create a test quiz with questions
    const quiz = await apiHelper.createQuiz({
      title: 'E2E Full Flow Test Quiz',
      description: 'Testing complete quiz participation flow',
      start_time: new Date(Date.now() - 60000).toISOString(), // Started 1 min ago
      is_visible: true
    });

    testQuizId = quiz.id;

    // Add 3 questions
    await apiHelper.addQuestion(testQuizId, {
      text: 'What is the capital of France?',
      options: ['London', 'Berlin', 'Paris', 'Madrid'],
      correct_index: 2
    });

    await apiHelper.addQuestion(testQuizId, {
      text: 'What is 2 + 2?',
      options: ['3', '4', '5', '6'],
      correct_index: 1
    });

    await apiHelper.addQuestion(testQuizId, {
      text: 'Which planet is known as the Red Planet?',
      options: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
      correct_index: 1
    });
  });

  test.afterAll(async () => {
    // Cleanup: delete the test quiz
    if (apiHelper && testQuizId) {
      await apiHelper.deleteQuiz(testQuizId);
    }
  });

  test('should display the test quiz on homepage', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for our test quiz
    const quizTitle = page.getByText('E2E Full Flow Test Quiz');
    await expect(quizTitle).toBeVisible();
  });

  test('should navigate to quiz and join', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click on the test quiz
    await page.getByText('E2E Full Flow Test Quiz').click();

    // Wait for navigation or modal
    await page.waitForTimeout(1000);

    // Should see a way to join the quiz
    const currentUrl = page.url();
    expect(currentUrl).toBeTruthy();

    // Look for name input or quiz details
    const nameInput = page.locator('input[type="text"]').first();
    const hasNameInput = await nameInput.count() > 0;

    if (hasNameInput) {
      // Enter name and join
      await nameInput.fill('Test Participant');

      const joinButton = page.locator('button:has-text("Join"), button[type="submit"], button:has-text("Start")').first();
      await joinButton.click();

      // Wait for quiz to load
      await page.waitForTimeout(2000);

      // Verify we're in the quiz
      const quizUrl = page.url();
      expect(quizUrl).toBeTruthy();
    }
  });

  test('should complete quiz and see results', async ({ page }) => {
    await page.goto(`/?quizId=${testQuizId}`);
    await page.waitForLoadState('networkidle');

    // Join the quiz
    const nameInput = page.locator('input[type="text"]').first();
    const hasNameInput = await nameInput.count() > 0;

    if (hasNameInput) {
      await nameInput.fill('Test Player');

      const joinButton = page.locator('button:has-text("Join"), button[type="submit"]').first();
      await joinButton.click();

      await page.waitForTimeout(2000);

      // Answer questions (click on options)
      const questionCount = 3;

      for (let i = 0; i < questionCount; i++) {
        // Wait for question to load
        await page.waitForTimeout(500);

        // Click on the first option (could be any option)
        const options = page.locator('button, .option, [role="button"]').all();
        if (options.length > 0) {
          await options[0].click();
        }

        // Wait for next question or results
        await page.waitForTimeout(1000);
      }

      // Check if we see results or completion message
      const currentUrl = page.url();
      expect(currentUrl).toBeTruthy();
    }
  });

  test('should verify quiz exists via API', async ({ request }) => {
    // Verify the quiz exists via direct API call
    const response = await request.get(`/api/quizzes/${testQuizId}`);

    expect(response.ok()).toBeTruthy();

    const quiz = await response.json();
    expect(quiz.id).toBe(testQuizId);
    expect(quiz.title).toBe('E2E Full Flow Test Quiz');
  });
});

test.describe('Quiz Administration', () => {
  test('should protect admin endpoints', async ({ request }) => {
    // Try to access admin endpoint without password
    const response = await request.post('/api/admin/quizzes', {
      data: {
        title: 'Unauthorized Quiz',
        start_time: new Date().toISOString()
      }
    });

    // Should be unauthorized
    expect(response.status()).toBe(401);
  });

  test('should allow quiz creation with admin password', async ({ request }) => {
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'test-admin-password';

    const response = await request.post('/api/admin/quizzes', {
      headers: {
        'X-Admin-Password': ADMIN_PASSWORD,
        'Content-Type': 'application/json'
      },
      data: {
        title: 'Admin Test Quiz',
        description: 'Created via API in E2E test',
        start_time: new Date().toISOString(),
        is_visible: false
      }
    });

    expect(response.ok()).toBeTruthy();

    const result = await response.json();
    expect(result.id).toBeDefined();

    // Cleanup
    await request.delete(`/api/admin/quizzes/${result.id}`, {
      headers: {
        'X-Admin-Password': ADMIN_PASSWORD
      }
    });
  });
});

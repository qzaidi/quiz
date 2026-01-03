import { test, expect } from '@playwright/test';
import { ApiHelper } from './helpers/test-data.js';

test.describe('Screenshot Capture', () => {
  let apiHelper;
  let sampleQuizId;

  test.beforeAll(async ({ request }) => {
    apiHelper = new ApiHelper(request);

    // Get the sample quiz that was seeded in playwright.config.js
    const quizzes = await apiHelper.getQuizzes();
    const sampleQuiz = quizzes.find(q => q.title === 'Trivia Quiz');

    if (sampleQuiz) {
      sampleQuizId = sampleQuiz.id;
      console.log(`✅ Using seeded quiz: ${sampleQuizId} - "${sampleQuiz.title}"`);
    } else {
      console.log('⚠️  No seeded quiz found, creating one...');
      // Fallback: create a quiz if seeding failed
      const quiz = await apiHelper.createQuiz({
        title: 'Trivia Quiz',
        description: 'Test your knowledge with our fun trivia questions!',
        start_time: new Date(Date.now() - 60000).toISOString(),
        is_visible: true,
        theme: {
          primaryColor: '#ff6b6b',
          backgroundColor: '#1a1a2e'
        }
      });

      sampleQuizId = quiz.id;

      // Add questions
      await apiHelper.addQuestion(sampleQuizId, {
        text: 'What is the capital of France?',
        options: ['London', 'Berlin', 'Paris', 'Madrid'],
        correct_index: 2
      });
    }
  });

  test.afterAll(async () => {
    // Keep the quiz for screenshots, don't delete
    console.log(`✅ Sample quiz ${sampleQuizId} ready for screenshots`);
  });

  test('capture homepage screenshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Capture full page screenshot
    await page.screenshot({
      path: 'screenshots/homepage.png',
      fullPage: true
    });
  });

  test('capture quiz list screenshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for quizzes to load
    await page.waitForTimeout(1000);

    // Capture the quiz list section
    const quizList = page.locator('body');
    await quizList.screenshot({
      path: 'screenshots/quiz-list.png'
    });
  });

  test('capture admin login modal', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click admin button
    const adminButton = page.locator('button:has-text("⚙"), .admin-btn').first();
    await adminButton.click();

    // Wait for modal
    await page.waitForTimeout(500);

    // Capture admin modal
    await page.screenshot({
      path: 'screenshots/admin-login.png'
    });
  });

  test('capture quiz joining flow', async ({ page }) => {
    await page.goto(`/?quizId=${sampleQuizId}`);
    await page.waitForLoadState('networkidle');

    // Wait for content to load
    await page.waitForTimeout(1000);

    // Capture quiz details before joining
    await page.screenshot({
      path: 'screenshots/quiz-details.png'
    });

    // Try to join the quiz
    const nameInput = page.locator('input[type="text"]').first();
    const hasNameInput = await nameInput.count() > 0;

    if (hasNameInput) {
      await nameInput.fill('Trivia Champion');

      // Capture with name filled
      await page.screenshot({
        path: 'screenshots/quiz-join-form.png'
      });
    }
  });

  test('capture question view', async ({ page }) => {
    await page.goto(`/?quizId=${sampleQuizId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Join the quiz
    const nameInput = page.locator('input[type="text"]').first();
    const hasNameInput = await nameInput.count() > 0;

    if (hasNameInput) {
      await nameInput.fill('Player One');

      const joinButton = page.locator('button:has-text("Join"), button[type="submit"]').first();
      await joinButton.click();

      // Wait for quiz to start
      await page.waitForTimeout(2000);

      // Capture question view
      await page.screenshot({
        path: 'screenshots/question-view.png',
        fullPage: true
      });
    }
  });

  test('capture leaderboard view', async ({ page, request }) => {
    // First, complete a quiz via API to generate leaderboard data
    const questions = await request.get(`/api/quiz/${sampleQuizId}/questions`);
    const questionsData = await questions.json();

    const answers = {};
    questionsData.forEach(q => {
      answers[q.id] = q.correct_index;
    });

    // Submit a perfect score
    await request.post('/api/submit', {
      data: {
        quizId: sampleQuizId,
        participantName: 'Screenshot Champion',
        answers: answers,
        timeTaken: 45
      }
    });

    // Now navigate to view the leaderboard
    await page.goto(`/?quizId=${sampleQuizId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Capture the view (might show leaderboard if quiz is complete)
    await page.screenshot({
      path: 'screenshots/leaderboard.png',
      fullPage: true
    });
  });
});

test.describe('Mobile Screenshots', () => {
  test('capture mobile homepage', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: 'screenshots/mobile-homepage.png',
      fullPage: true
    });
  });

  test('capture mobile question view', async ({ page, request }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Get or create a quiz
    const quizzes = await request.get('/api/quizzes');
    const quizzesData = await quizzes.json();

    if (quizzesData.length > 0) {
      const quizId = quizzesData[0].id;
      await page.goto(`/?quizId=${quizId}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: 'screenshots/mobile-question.png',
        fullPage: true
      });
    }
  });
});

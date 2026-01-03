import { defineConfig } from '@playwright/test';
import fs from 'fs';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup function to clean and seed test database before tests
function setupTestDatabase() {
  const dbPath = 'quiz.test.db';
  try {
    // Delete test database if it exists
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
      console.log('🗑️  Cleaned up test database before tests');
    }

    // Create fresh database with schema
    const db = new Database(dbPath);

    // Initialize schema
    db.exec(`
      CREATE TABLE IF NOT EXISTS quizzes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        start_time DATETIME NOT NULL,
        end_time DATETIME,
        theme TEXT,
        is_visible INTEGER DEFAULT 1,
        languages TEXT DEFAULT '["en"]',
        image_url TEXT
      );

      CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quiz_id INTEGER NOT NULL,
        text TEXT NOT NULL,
        hint TEXT,
        options TEXT NOT NULL,
        correct_index INTEGER NOT NULL,
        translations TEXT,
        FOREIGN KEY (quiz_id) REFERENCES quizzes(id)
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quiz_id INTEGER NOT NULL,
        participant_name TEXT NOT NULL,
        score INTEGER DEFAULT 0,
        time_taken_seconds INTEGER,
        completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (quiz_id) REFERENCES quizzes(id)
      );
    `);

    // Insert a sample quiz for screenshots
    const now = new Date();
    const past = new Date(now.getTime() - 60000); // Started 1 minute ago

    const theme = JSON.stringify({
      primaryColor: '#ff6b6b',
      backgroundColor: '#1a1a2e',
      backgroundImageUrl: null
    });

    const quizResult = db.prepare(`
      INSERT INTO quizzes (title, description, start_time, end_time, theme, is_visible, languages)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'Trivia Quiz',
      'Test your knowledge with our fun trivia questions!',
      past.toISOString(),
      null,
      theme,
      1,
      '["en"]'
    );

    const quizId = quizResult.lastInsertRowid;

    // Insert sample questions
    const questions = [
      {
        text: 'What is the capital of France?',
        hint: 'It\'s known as the City of Light',
        options: JSON.stringify(['London', 'Berlin', 'Paris', 'Madrid']),
        correct_index: 2
      },
      {
        text: 'Which planet is known as the Red Planet?',
        hint: 'Named after the Roman god of war',
        options: JSON.stringify(['Venus', 'Mars', 'Jupiter', 'Saturn']),
        correct_index: 1
      },
      {
        text: 'What is the largest mammal in the world?',
        hint: 'It lives in the ocean',
        options: JSON.stringify(['African Elephant', 'Blue Whale', 'Giraffe', 'Polar Bear']),
        correct_index: 1
      }
    ];

    const insertQuestion = db.prepare(`
      INSERT INTO questions (quiz_id, text, hint, options, correct_index)
      VALUES (?, ?, ?, ?, ?)
    `);

    questions.forEach(q => {
      insertQuestion.run(quizId, q.text, q.hint, q.options, q.correct_index);
    });

    db.close();
    console.log('✅ Seeded test database with sample quiz for screenshots');

  } catch (error) {
    console.error('Error setting up test database:', error);
  }
}

// Clean up before all tests
setupTestDatabase();

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  webServer: {
    command: 'NODE_ENV=test ADMIN_PASSWORD=test-admin-password TEST_DB_PATH=quiz.test.db PORT=3001 node src/app.js',
    port: 3001,
    timeout: 120000
  },
  // Cleanup after all tests complete
  globalTeardown: './tests/e2e/global-teardown.js'
});

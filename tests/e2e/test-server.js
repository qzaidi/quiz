#!/usr/bin/env node
// Test server that initializes and seeds the database if needed before starting

import fs from 'fs';
import { initDb, default as db } from '../../src/database.js';

// Set environment for test database
process.env.NODE_ENV = 'test';
process.env.TEST_DB_PATH = 'quiz.test.db';

const dbPath = 'quiz.test.db';

async function seedTestDatabase() {
  try {
    // Check if database exists and has data
    const dbExists = fs.existsSync(dbPath);

    if (!dbExists) {
      console.log('🗑️  Creating fresh test database');
    } else {
      // Check if it has the seeded quiz
      const quizCount = db.prepare('SELECT COUNT(*) as count FROM quizzes WHERE title = ?').get('Trivia Quiz');
      if (quizCount.count > 0) {
        console.log('✅ Test database already seeded with sample quiz');
        return;
      } else {
        console.log('🗑️  Database exists but empty, cleaning...');
        fs.unlinkSync(dbPath);
      }
    }

    // Initialize schema using existing initDb function
    initDb();
    console.log('✅ Initialized test database schema');

    // Insert sample quiz
    const now = new Date();
    const past = new Date(now.getTime() - 60000);

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

    console.log('✅ Seeded test database with sample quiz');

  } catch (error) {
    console.error('Error setting up test database:', error);
    throw error;
  }
}

// Seed the database
await seedTestDatabase();

// Now import and start the server
const { default: app } = await import('../../src/app.js');
const port = process.env.PORT || 3001;

const server = app.listen(port, () => {
  console.log(`🚀 Test server listening on port ${port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
  });
});

import Database from 'better-sqlite3';
import { initDb } from '../../src/database.js';
import fs from 'fs';

const TEST_DB_PATH = 'quiz.test.db';

/**
 * Creates a test database using file-based SQLite
 * This uses the same database file as the server for integration tests
 * @returns {Database} Better-sqlite3 database instance
 */
export function createTestDatabase() {
  const db = new Database(TEST_DB_PATH);
  return db;
}

/**
 * Initialize test database with schema
 * This runs schema migrations on test database
 * @param {Database} testDb - Test database instance
 */
export function initTestDatabase(testDb) {
  // Run schema migrations on test database
  testDb.exec(`
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

  // Add image_url column migration
  try {
    const columns = testDb.prepare("PRAGMA table_info(quizzes)").all();
    const hasImageURL = columns.some(col => col.name === 'image_url');
    if (!hasImageURL) {
      testDb.exec("ALTER TABLE quizzes ADD COLUMN image_url TEXT");
    }
  } catch (e) {
    console.error('Migration error:', e);
  }
}

/**
 * Delete the test database file
 */
export function cleanupTestDatabase() {
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
}

/**
 * Insert a quiz into the test database
 * @param {Database} db - Database instance
 * @param {Object} quiz - Quiz data
 * @returns {Object} Inserted quiz with id
 */
export function insertQuiz(db, quiz = {}) {
  const now = new Date().toISOString();
  const defaultQuiz = {
    title: 'Test Quiz',
    description: 'A test quiz',
    start_time: now,
    is_visible: 1,
    languages: JSON.stringify(['en']),
    ...quiz
  };

  const stmt = db.prepare(`
    INSERT INTO quizzes (title, description, start_time, end_time, theme, is_visible, languages, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    defaultQuiz.title,
    defaultQuiz.description || null,
    defaultQuiz.start_time,
    defaultQuiz.end_time || null,
    defaultQuiz.theme || null,
    defaultQuiz.is_visible,
    defaultQuiz.languages,
    defaultQuiz.image_url || null
  );

  return { ...defaultQuiz, id: result.lastInsertRowid };
}

/**
 * Insert questions for a quiz
 * @param {Database} db - Database instance
 * @param {number} quizId - Quiz ID
 * @param {Array} questions - Array of question objects
 */
export function insertQuestions(db, quizId, questions = []) {
  const stmt = db.prepare(`
    INSERT INTO questions (quiz_id, text, hint, options, correct_index, translations)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  questions.forEach(q => {
    stmt.run(
      quizId,
      q.text,
      q.hint || null,
      JSON.stringify(q.options),
      q.correct_index,
      q.translations ? JSON.stringify(q.translations) : null
    );
  });
}

/**
 * Clear all tables in test database
 * @param {Database} db - Database instance
 */
export function clearDatabase(db) {
  db.exec('DELETE FROM sessions');
  db.exec('DELETE FROM questions');
  db.exec('DELETE FROM quizzes');
}

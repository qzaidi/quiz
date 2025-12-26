import Database from 'better-sqlite3';

// Enable verbose query logging if DEBUG is set
const dbOptions = process.env.DEBUG ? { verbose: console.log } : {};
const db = new Database('quiz.db', dbOptions);

if (process.env.DEBUG) {
  console.log('🔍 Database verbose logging enabled');
}


export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS quizzes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      start_time DATETIME NOT NULL,
      end_time DATETIME,            -- Optional end time for quiz
      theme TEXT,                  -- JSON: { primaryColor, backgroundColor, backgroundImageUrl }
      is_visible INTEGER DEFAULT 1, -- 0 or 1
      languages TEXT DEFAULT '["en"]' -- JSON Array
    );

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      hint TEXT,
      options TEXT NOT NULL,       -- JSON array of strings
      correct_index INTEGER NOT NULL,
      image_url TEXT,
      translations TEXT,           -- JSON: { langCode: { text, hint, options } }
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

  // Migration: Add end_time column if it doesn't exist
  try {
    const columns = db.prepare("PRAGMA table_info(quizzes)").all();
    const hasEndTime = columns.some(col => col.name === 'end_time');
    if (!hasEndTime) {
      db.exec("ALTER TABLE quizzes ADD COLUMN end_time DATETIME");
      console.log('Migration: Added end_time column to quizzes table');
    }
  } catch (e) {
    console.error('Migration error:', e);
  }
}

export default db;

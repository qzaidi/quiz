import fs from 'fs';

export default async function globalTeardown() {
  const dbPath = 'quiz.test.db';
  try {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
      console.log('✅ Cleaned up test database after tests');
    }
  } catch (error) {
    console.error('Error in cleanup:', error);
  }
}

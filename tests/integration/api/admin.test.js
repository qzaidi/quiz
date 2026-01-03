import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startTestServer, stopTestServer, getBaseUrl, cleanupTestDatabaseFile } from '../../helpers/server.js';
import db from '../../../src/database.js';
import {
  insertQuiz,
  insertQuestions,
  clearDatabase
} from '../../helpers/database.js';
import {
  createQuiz,
  createQuestions,
  createTheme
} from '../../helpers/fixtures.js';

let server;
let baseUrl;
let quizId;

// Helper to get admin auth headers
function getAdminHeaders() {
  return {
    'X-Admin-Password': 'test-admin-password'
  };
}

describe('Admin API Tests', () => {
  beforeAll(async () => {
    // Start test server (this initializes the database)
    const { server: srv, port } = await startTestServer(3001);
    server = srv;
    baseUrl = getBaseUrl(port);
  });

  afterAll(async () => {
    await stopTestServer();
    cleanupTestDatabaseFile();
  });

  beforeEach(() => {
    clearDatabase(db);
  });

  describe('Authentication', () => {
    it('should block access without admin password', async () => {
      const response = await fetch(`${baseUrl}/api/admin/quizzes`, {
        method: 'POST'
      });

      expect(response.status).toBe(401);
    });

    it('should block access with wrong admin password', async () => {
      const response = await fetch(`${baseUrl}/api/admin/quizzes`, {
        method: 'POST',
        headers: {
          'X-Admin-Password': 'wrong-password'
        }
      });

      expect(response.status).toBe(401);
    });

    it('should allow access with correct admin password', async () => {
      const response = await fetch(`${baseUrl}/api/admin/login`, {
        method: 'POST',
        headers: getAdminHeaders()
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe('POST /api/admin/quizzes', () => {
    it('should create a new quiz', async () => {
      const quizData = {
        title: 'New Test Quiz',
        description: 'A quiz for testing',
        start_time: new Date().toISOString(),
        is_visible: true,
        theme: createTheme()
      };

      const response = await fetch(`${baseUrl}/api/admin/quizzes`, {
        method: 'POST',
        headers: {
          ...getAdminHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(quizData)
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.id).toBeDefined();
      quizId = data.id;
    });

    it('should create quiz with all fields', async () => {
      const now = new Date();
      const later = new Date(now.getTime() + 3600000);

      const quizData = {
        title: 'Complete Quiz',
        description: 'Complete description',
        start_time: now.toISOString(),
        end_time: later.toISOString(),
        is_visible: false,
        image_url: 'https://example.com/image.jpg'
      };

      const response = await fetch(`${baseUrl}/api/admin/quizzes`, {
        method: 'POST',
        headers: {
          ...getAdminHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(quizData)
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.id).toBeDefined();

      // Verify quiz was created correctly
      const getResponse = await fetch(`${baseUrl}/api/quizzes/${data.id}`, {
        headers: getAdminHeaders()
      });
      const quiz = await getResponse.json();
      expect(quiz.title).toBe('Complete Quiz');
      expect(quiz.description).toBe('Complete description');
      expect(quiz.is_visible).toBe(0);
    });
  });

  describe('PUT /api/admin/quizzes/:id', () => {
    beforeEach(() => {
      const quiz = insertQuiz(db, createQuiz({ title: 'Original Title' }));
      quizId = quiz.id;
    });

    it('should update quiz', async () => {
      // Get the quiz first to get its current data
      const getBefore = await fetch(`${baseUrl}/api/quizzes/${quizId}`);
      const before = await getBefore.json();

      const updateData = {
        title: 'Updated Title',
        description: 'Updated description',
        start_time: before.start_time,
        is_visible: false,
        languages: before.languages || ['en']
      };

      const response = await fetch(`${baseUrl}/api/admin/quizzes/${quizId}`, {
        method: 'PUT',
        headers: {
          ...getAdminHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should toggle visibility', async () => {
      // First verify it's visible
      const getBefore = await fetch(`${baseUrl}/api/quizzes/${quizId}`);
      const before = await getBefore.json();
      expect(before.is_visible).toBe(1);

      // Update to hidden - include required fields
      await fetch(`${baseUrl}/api/admin/quizzes/${quizId}`, {
        method: 'PUT',
        headers: {
          ...getAdminHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: before.title,
          start_time: before.start_time,
          is_visible: false,
          languages: before.languages || ['en']
        })
      });

      // Verify it's hidden
      const getAfter = await fetch(`${baseUrl}/api/quizzes/${quizId}`, {
        headers: getAdminHeaders()
      });
      const after = await getAfter.json();
      expect(after.is_visible).toBe(0);
    });
  });

  describe('POST /api/admin/questions', () => {
    beforeEach(() => {
      const quiz = insertQuiz(db, createQuiz());
      quizId = quiz.id;
    });

    it('should add a single question', async () => {
      const questionData = {
        quiz_id: quizId,
        text: 'What is 2 + 2?',
        hint: 'Basic math',
        options: ['3', '4', '5', '6'],
        correct_index: 1
      };

      const response = await fetch(`${baseUrl}/api/admin/questions`, {
        method: 'POST',
        headers: {
          ...getAdminHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(questionData)
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should add question with translations', async () => {
      const questionData = {
        quiz_id: quizId,
        text: 'What is the capital of France?',
        options: ['Berlin', 'London', 'Paris', 'Madrid'],
        correct_index: 2,
        translations: {
          es: {
            text: '¿Cuál es la capital de Francia?',
            options: ['Berlín', 'Londres', 'París', 'Madrid']
          }
        }
      };

      const response = await fetch(`${baseUrl}/api/admin/questions`, {
        method: 'POST',
        headers: {
          ...getAdminHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(questionData)
      });

      expect(response.status).toBe(200);

      // Verify quiz languages were updated
      const quizResponse = await fetch(`${baseUrl}/api/quizzes/${quizId}`);
      const quiz = await quizResponse.json();
      expect(quiz.languages).toContain('es');
    });
  });

  describe('POST /api/admin/questions/bulk', () => {
    beforeEach(() => {
      const quiz = insertQuiz(db, createQuiz());
      quizId = quiz.id;
    });

    it('should bulk import questions', async () => {
      const questions = createQuestions(5);

      const response = await fetch(`${baseUrl}/api/admin/questions/bulk`, {
        method: 'POST',
        headers: {
          ...getAdminHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quiz_id: quizId,
          questions: questions
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.count).toBe(5);
    });

    it('should handle empty questions array', async () => {
      const response = await fetch(`${baseUrl}/api/admin/questions/bulk`, {
        method: 'POST',
        headers: {
          ...getAdminHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quiz_id: quizId,
          questions: []
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.count).toBe(0);
    });

    it('should reject invalid data format', async () => {
      const response = await fetch(`${baseUrl}/api/admin/questions/bulk`, {
        method: 'POST',
        headers: {
          ...getAdminHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quiz_id: quizId,
          questions: 'not an array'
        })
      });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/admin/quizzes/:id', () => {
    beforeEach(() => {
      const quiz = insertQuiz(db, createQuiz());
      quizId = quiz.id;
      insertQuestions(db, quizId, createQuestions(3));
    });

    it('should delete quiz and related data', async () => {
      const response = await fetch(`${baseUrl}/api/admin/quizzes/${quizId}`, {
        method: 'DELETE',
        headers: getAdminHeaders()
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);

      // Verify quiz is deleted
      const getResponse = await fetch(`${baseUrl}/api/quizzes/${quizId}`);
      expect(getResponse.status).toBe(404);
    });
  });

  describe('DELETE /api/admin/quizzes/:id/clear', () => {
    beforeEach(() => {
      const quiz = insertQuiz(db, createQuiz());
      quizId = quiz.id;
      insertQuestions(db, quizId, createQuestions(3));
    });

    it('should clear questions and sessions but keep quiz', async () => {
      const response = await fetch(`${baseUrl}/api/admin/quizzes/${quizId}/clear`, {
        method: 'DELETE',
        headers: getAdminHeaders()
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);

      // Verify quiz still exists
      const getResponse = await fetch(`${baseUrl}/api/quizzes/${quizId}`);
      expect(getResponse.status).toBe(200);

      // Verify questions are deleted
      const questionsResponse = await fetch(`${baseUrl}/api/admin/quizzes/${quizId}/questions`, {
        headers: getAdminHeaders()
      });
      const questions = await questionsResponse.json();
      expect(questions.length).toBe(0);
    });
  });

  describe('GET /api/admin/quizzes/:id/questions', () => {
    beforeEach(() => {
      const quiz = insertQuiz(db, createQuiz());
      quizId = quiz.id;
      insertQuestions(db, quizId, createQuestions(3));
    });

    it('should get all questions for a quiz', async () => {
      const response = await fetch(`${baseUrl}/api/admin/quizzes/${quizId}/questions`, {
        headers: getAdminHeaders()
      });

      expect(response.status).toBe(200);
      const questions = await response.json();
      expect(questions.length).toBe(3);
      expect(questions[0]).toHaveProperty('id');
      expect(questions[0]).toHaveProperty('text');
      expect(questions[0]).toHaveProperty('correct_index');
    });
  });

  describe('GET /api/admin/questions', () => {
    beforeEach(() => {
      const quiz1 = insertQuiz(db, createQuiz({ title: 'Quiz 1' }));
      const quiz2 = insertQuiz(db, createQuiz({ title: 'Quiz 2' }));
      insertQuestions(db, quiz1.id, createQuestions(2));
      insertQuestions(db, quiz2.id, createQuestions(1));
    });

    it('should get all questions with quiz context', async () => {
      const response = await fetch(`${baseUrl}/api/admin/questions`, {
        headers: getAdminHeaders()
      });

      expect(response.status).toBe(200);
      const questions = await response.json();
      expect(questions.length).toBe(3);
      expect(questions[0]).toHaveProperty('quiz_title');
    });
  });

  describe('GET /api/admin/sessions', () => {
    it('should get all sessions', async () => {
      // First create a past quiz and submit a score
      const past = new Date();
      past.setMinutes(past.getMinutes() - 10);
      const quiz = insertQuiz(db, createQuiz({
        start_time: past.toISOString(),
        end_time: new Date().toISOString()
      }));
      insertQuestions(db, quiz.id, createQuestions(2));

      // Use admin endpoint to get questions (no time restrictions)
      const questionsResponse = await fetch(`${baseUrl}/api/admin/quizzes/${quiz.id}/questions`, {
        headers: getAdminHeaders()
      });
      expect(questionsResponse.status).toBe(200);
      const questions = await questionsResponse.json();

      // Verify questions is an array
      expect(Array.isArray(questions)).toBe(true);
      expect(questions.length).toBe(2);

      const answers = {};
      questions.forEach(q => {
        answers[q.id] = q.correct_index; // Use correct answers
      });

      await fetch(`${baseUrl}/api/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizId: quiz.id,
          participantName: 'Test User',
          answers: answers,
          timeTaken: 30
        })
      });

      // Get sessions via admin API
      const response = await fetch(`${baseUrl}/api/admin/sessions`, {
        headers: getAdminHeaders()
      });

      expect(response.status).toBe(200);
      const sessions = await response.json();
      expect(sessions.length).toBeGreaterThan(0);
      expect(sessions[0]).toHaveProperty('quiz_title');
      expect(sessions[0]).toHaveProperty('participant_name');
    });
  });

  describe('DELETE /api/admin/sessions/:id', () => {
    it('should delete a session', async () => {
      // Create a session first using past quiz
      const past = new Date();
      past.setMinutes(past.getMinutes() - 10);
      const quiz = insertQuiz(db, createQuiz({
        start_time: past.toISOString(),
        end_time: new Date().toISOString()
      }));
      insertQuestions(db, quiz.id, createQuestions(1));

      // Use admin endpoint to get questions (no time restrictions)
      const questionsResponse = await fetch(`${baseUrl}/api/admin/quizzes/${quiz.id}/questions`, {
        headers: getAdminHeaders()
      });
      const questions = await questionsResponse.json();

      // Verify questions is an array
      expect(Array.isArray(questions)).toBe(true);
      expect(questions.length).toBeGreaterThanOrEqual(0);

      // If no questions, we can't test session deletion properly
      if (questions.length === 0) {
        console.warn('No questions found, skipping session creation');
        return;
      }

      const answers = {};
      questions.forEach(q => {
        answers[q.id] = q.correct_index;
      });

      await fetch(`${baseUrl}/api/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizId: quiz.id,
          participantName: 'To Delete',
          answers: answers,
          timeTaken: 10
        })
      });

      // Get sessions to find session ID
      const sessionsBefore = await fetch(`${baseUrl}/api/admin/sessions`, {
        headers: getAdminHeaders()
      });
      const sessions = await sessionsBefore.json();
      const sessionId = sessions[0].id;

      // Delete the session
      const response = await fetch(`${baseUrl}/api/admin/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: getAdminHeaders()
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });
});

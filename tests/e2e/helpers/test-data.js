import { request } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'test-admin-password';

/**
 * API helper for E2E tests
 */
export class ApiHelper {
  constructor(requestContext) {
    this.request = requestContext;
  }

  async createQuiz(quizData = {}) {
    const defaultQuiz = {
      title: 'E2E Test Quiz',
      description: 'Automated test quiz',
      start_time: new Date().toISOString(),
      is_visible: true,
      languages: ['en'],
      ...quizData
    };

    const response = await this.request.post(`${BASE_URL}/api/admin/quizzes`, {
      headers: {
        'X-Admin-Password': ADMIN_PASSWORD,
        'Content-Type': 'application/json'
      },
      data: defaultQuiz
    });

    if (!response.ok()) {
      throw new Error(`Failed to create quiz: ${response.status()}`);
    }

    return await response.json();
  }

  async addQuestion(quizId, questionData) {
    const defaultQuestion = {
      quiz_id: quizId,
      text: 'What is 2 + 2?',
      options: ['3', '4', '5', '6'],
      correct_index: 1,
      ...questionData
    };

    const response = await this.request.post(`${BASE_URL}/api/admin/questions`, {
      headers: {
        'X-Admin-Password': ADMIN_PASSWORD,
        'Content-Type': 'application/json'
      },
      data: defaultQuestion
    });

    if (!response.ok()) {
      throw new Error(`Failed to add question: ${response.status()}`);
    }

    return await response.json();
  }

  async getQuizzes() {
    const response = await this.request.get(`${BASE_URL}/api/quizzes`);

    if (!response.ok()) {
      throw new Error(`Failed to get quizzes: ${response.status()}`);
    }

    return await response.json();
  }

  async deleteQuiz(quizId) {
    const response = await this.request.delete(`${BASE_URL}/api/admin/quizzes/${quizId}`, {
      headers: {
        'X-Admin-Password': ADMIN_PASSWORD
      }
    });

    if (!response.ok()) {
      throw new Error(`Failed to delete quiz: ${response.status()}`);
    }
  }

  async cleanupTestQuizzes() {
    const quizzes = await this.getQuizzes();
    const testQuizzes = quizzes.filter(q => q.title.includes('E2E Test'));

    for (const quiz of testQuizzes) {
      await this.deleteQuiz(quiz.id);
    }
  }
}

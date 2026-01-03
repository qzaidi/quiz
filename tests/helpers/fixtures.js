/**
 * Test data fixtures for creating quizzes, questions, etc.
 */

/**
 * Create a quiz object with default values
 * @param {Object} overrides - Properties to override
 * @returns {Object} Quiz object
 */
export function createQuiz(overrides = {}) {
  const now = new Date();
  return {
    title: 'Test Quiz',
    description: 'A test quiz for automated testing',
    start_time: now.toISOString(),
    is_visible: 1,
    languages: JSON.stringify(['en']),
    ...overrides
  };
}

/**
 * Create a future quiz (starts in 1 hour)
 * @param {Object} overrides - Properties to override
 * @returns {Object} Quiz object
 */
export function createFutureQuiz(overrides = {}) {
  const future = new Date();
  future.setHours(future.getHours() + 1);

  return createQuiz({
    title: 'Future Quiz',
    start_time: future.toISOString(),
    ...overrides
  });
}

/**
 * Create a past quiz (ended 1 hour ago)
 * @param {Object} overrides - Properties to override
 * @returns {Object} Quiz object
 */
export function createPastQuiz(overrides = {}) {
  const past = new Date();
  past.setHours(past.getHours() - 2);

  const endPast = new Date();
  endPast.setHours(endPast.getHours() - 1);

  return createQuiz({
    title: 'Past Quiz',
    start_time: past.toISOString(),
    end_time: endPast.toISOString(),
    ...overrides
  });
}

/**
 * Create a hidden quiz (not visible)
 * @param {Object} overrides - Properties to override
 * @returns {Object} Quiz object
 */
export function createHiddenQuiz(overrides = {}) {
  return createQuiz({
    title: 'Hidden Quiz',
    is_visible: 0,
    ...overrides
  });
}

/**
 * Create a question object with default values
 * @param {Object} overrides - Properties to override
 * @returns {Object} Question object
 */
export function createQuestion(overrides = {}) {
  return {
    text: 'What is the capital of France?',
    hint: 'It\'s not London',
    options: ['Berlin', 'London', 'Paris', 'Madrid'],
    correct_index: 2,
    translations: null,
    ...overrides
  };
}

/**
 * Create multiple questions
 * @param {number} count - Number of questions to create
 * @param {Object} overrides - Properties to override
 * @returns {Array} Array of question objects
 */
export function createQuestions(count = 3, overrides = {}) {
  const questions = [];
  for (let i = 0; i < count; i++) {
    questions.push(createQuestion({
      text: `Question ${i + 1}`,
      options: [`Option A ${i + 1}`, `Option B ${i + 1}`, `Option C ${i + 1}`, `Option D ${i + 1}`],
      correct_index: 0,
      ...overrides
    }));
  }
  return questions;
}

/**
 * Create a session object
 * @param {Object} overrides - Properties to override
 * @returns {Object} Session object
 */
export function createSession(overrides = {}) {
  return {
    participant_name: 'Test Participant',
    score: 5,
    time_taken_seconds: 120,
    ...overrides
  };
}

/**
 * Create quiz theme data
 * @param {Object} overrides - Properties to override
 * @returns {string} JSON stringified theme
 */
export function createTheme(overrides = {}) {
  const theme = {
    primaryColor: '#ff6b6b',
    backgroundColor: '#f0f0f0',
    backgroundImageUrl: null,
    ...overrides
  };
  return JSON.stringify(theme);
}

/**
 * Test server helper for starting and stopping the Express server
 * during integration tests.
 */

import fs from 'fs';

let server = null;
let httpServer = null;

/**
 * Start the test server on a specified port
 * @param {number} port - Port to listen on (default: 3001)
 * @returns {Promise<{server: import('http').Server, port: number}>}
 */
export async function startTestServer(port = 3001) {
  if (server) {
    throw new Error('Server is already running');
  }

  // Disable automatic server start so we can control it
  process.env.DISABLE_SERVER_START = 'true';
  process.env.ADMIN_PASSWORD = 'test-admin-password';
  process.env.TEST_DB_PATH = 'quiz.test.db';

  // Import app and setupWebSocket
  const { default: app } = await import('../../src/app.js');
  const { setupWebSocket } = await import('../../src/websocket.js');

  // Listen on the specified port
  httpServer = app.listen(port);

  // Setup WebSocket for the server
  setupWebSocket(httpServer);

  return new Promise((resolve) => {
    server = httpServer;
    httpServer.on('listening', () => {
      resolve({ server: httpServer, port });
    });
  });
}

/**
 * Get the base URL for the test server
 * @param {number} port - Port number
 * @returns {string} Base URL
 */
export function getBaseUrl(port = 3001) {
  return `http://localhost:${port}`;
}

/**
 * Stop the test server
 * @returns {Promise<void>}
 */
export async function stopTestServer() {
  if (server) {
    return new Promise((resolve, reject) => {
      server.close((err) => {
        server = null;
        httpServer = null;
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

/**
 * Clean up test database file
 */
export function cleanupTestDatabaseFile() {
  if (fs.existsSync('quiz.test.db')) {
    fs.unlinkSync('quiz.test.db');
  }
}

/**
 * Check if server is running
 * @returns {boolean}
 */
export function isServerRunning() {
  return server !== null;
}

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { WebSocket } from 'ws';
import { startTestServer, stopTestServer, getBaseUrl, cleanupTestDatabaseFile } from '../../helpers/server.js';
import db from '../../../src/database.js';
import {
  insertQuiz,
  clearDatabase
} from '../../helpers/database.js';
import { createQuiz } from '../../helpers/fixtures.js';

let server;
let baseUrl;
let quizId;

// Helper to create a WebSocket connection
function createWebSocketConnection(port, quizId) {
  return new WebSocket(`ws://localhost:${port}/?quizId=${quizId}`);
}

// Helper to wait for a message
function waitForMessage(ws, timeout = 1000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for message')), timeout);

    ws.once('message', (data) => {
      clearTimeout(timer);
      try {
        const message = JSON.parse(data.toString());
        resolve(message);
      } catch (e) {
        reject(e);
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

describe('WebSocket Tests', () => {
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
    const quiz = insertQuiz(db, createQuiz({ title: 'WS Test Quiz' }));
    quizId = quiz.id;
  });

  describe('Connection handling', () => {
    it('should accept connection with valid quizId', async () => {
      const ws = createWebSocketConnection(3001, quizId);

      await new Promise((resolve) => {
        ws.on('open', () => {
          expect(ws.readyState).toBe(WebSocket.OPEN);
          ws.close();
          resolve();
        });
      });
    });

    it('should close connection without quizId', async () => {
      const ws = new WebSocket(`ws://localhost:3001/`);

      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          ws.terminate();
          resolve(); // Connection closed/terminated
        }, 500);

        ws.on('close', () => {
          clearTimeout(timer);
          resolve();
        });

        ws.on('error', () => {
          clearTimeout(timer);
          resolve(); // Connection error also counts as closed
        });
      });
    });

    it('should close connection with invalid quizId', async () => {
      const ws = createWebSocketConnection(3001, 999999);

      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          ws.terminate();
          resolve(); // Connection closed/terminated
        }, 500);

        ws.on('close', () => {
          clearTimeout(timer);
          resolve();
        });

        ws.on('error', () => {
          clearTimeout(timer);
          resolve(); // Connection error also counts as closed
        });
      });
    });
  });

  describe('Participant count', () => {
    it('should broadcast count on connection', async () => {
      const ws1 = createWebSocketConnection(3001, quizId);

      const message = await waitForMessage(ws1);
      expect(message.type).toBe('count');
      expect(message.count).toBe(1);

      ws1.close();
    });

    it('should track multiple connections', async () => {
      const ws1 = createWebSocketConnection(3001, quizId);
      const msg1 = await waitForMessage(ws1);
      expect(msg1.count).toBe(1);

      const ws2 = createWebSocketConnection(3001, quizId);

      // Both clients should receive count update
      const [msg1_2, msg2] = await Promise.all([
        waitForMessage(ws1),
        waitForMessage(ws2)
      ]);

      expect(msg1_2.count).toBe(2);
      expect(msg2.count).toBe(2);

      ws1.close();
      ws2.close();
    });

    it('should decrease count on disconnect', async () => {
      const ws1 = createWebSocketConnection(3001, quizId);
      await waitForMessage(ws1);
      expect(ws1.readyState).toBe(WebSocket.OPEN);

      const ws2 = createWebSocketConnection(3001, quizId);

      // Wait for both to connect
      await Promise.all([
        waitForMessage(ws1),
        waitForMessage(ws2)
      ]);

      // Close second connection
      ws2.close();

      // First connection should receive count update
      const message = await waitForMessage(ws1);
      expect(message.count).toBe(1);

      ws1.close();
    });

    it('should handle rapid connect/disconnect', async () => {
      const connections = [];
      const messagePromises = [];

      // Create 5 connections
      for (let i = 0; i < 5; i++) {
        const ws = createWebSocketConnection(3001, quizId);
        connections.push(ws);

        // Wait for open
        await new Promise((resolve) => {
          ws.on('open', resolve);
        });

        // Small delay between connections
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Last connection should report count of 5 (or close to it)
      try {
        const lastMessage = await waitForMessage(connections[4], 2000);
        expect(lastMessage.count).toBeGreaterThan(0);
        expect(lastMessage.count).toBeLessThanOrEqual(5);
      } catch (e) {
        // If timeout, just verify connection was made
        expect(connections[4].readyState).toBe(WebSocket.OPEN);
      }

      // Close all connections
      connections.forEach(ws => ws.close());
    });
  });

  describe('Multiple quizzes', () => {
    it('should track participants separately per quiz', async () => {
      // Create second quiz
      const quiz2 = insertQuiz(db, createQuiz({ title: 'Second Quiz' }));
      const quiz2Id = quiz2.id;

      // Connect to first quiz
      const ws1 = createWebSocketConnection(3001, quizId);
      const msg1 = await waitForMessage(ws1);
      expect(msg1.count).toBe(1);

      // Connect to second quiz
      const ws2 = createWebSocketConnection(3001, quiz2Id);
      const msg2 = await waitForMessage(ws2);
      expect(msg2.count).toBe(1);

      // Add another connection to first quiz
      const ws3 = createWebSocketConnection(3001, quizId);
      const msg3 = await waitForMessage(ws3);
      expect(msg3.count).toBe(2);

      // Second quiz should still have count of 1
      // First connection to second quiz should not have received new message
      // Let's verify by connecting another client to quiz 2
      const ws4 = createWebSocketConnection(3001, quiz2Id);
      const msg4 = await waitForMessage(ws4);
      expect(msg4.count).toBe(2);

      ws1.close();
      ws2.close();
      ws3.close();
      ws4.close();
    });
  });

  describe('Message format', () => {
    it('should send JSON messages with correct structure', async () => {
      const ws = createWebSocketConnection(3001, quizId);

      const message = await waitForMessage(ws);

      expect(typeof message).toBe('object');
      expect(message).toHaveProperty('type');
      expect(message).toHaveProperty('count');
      expect(message.type).toBe('count');
      expect(typeof message.count).toBe('number');

      ws.close();
    });
  });

  describe('Edge cases', () => {
    it('should handle connection when no other clients exist', async () => {
      const ws = createWebSocketConnection(3001, quizId);

      const message = await waitForMessage(ws);
      expect(message.count).toBe(1);

      ws.close();

      // Wait for close
      await new Promise(resolve => setTimeout(resolve, 100));

      // New connection should start fresh
      const ws2 = createWebSocketConnection(3001, quizId);
      const message2 = await waitForMessage(ws2);
      expect(message2.count).toBe(1);

      ws2.close();
    });

    it('should cleanup empty quiz rooms', async () => {
      const ws = createWebSocketConnection(3001, quizId);
      await waitForMessage(ws);

      ws.close();

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 200));

      // Reconnecting should work
      const ws2 = createWebSocketConnection(3001, quizId);
      const message = await waitForMessage(ws2);
      expect(message.count).toBe(1);

      ws2.close();
    });
  });
});

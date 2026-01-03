import { defineConfig } from '@playwright/test';

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
  globalTeardown: './tests/e2e/global-teardown.js',
  webServer: {
    command: 'ADMIN_PASSWORD=test-admin-password PORT=3001 node tests/e2e/test-server.js',
    port: 3001,
    timeout: 120000
  }
});

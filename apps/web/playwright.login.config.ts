import { defineConfig, devices } from '@playwright/test';

// Isolated browser regression: authentication is mocked, no database/API needed.
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'login-translation.spec.ts',
  timeout: 120_000,
  use: { baseURL: 'http://127.0.0.1:5173' },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
});

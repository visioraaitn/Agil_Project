import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';

const webDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(webDir, '../..');
const env = loadEnv('test', repoRoot, '');
const apiUrl = process.env.E2E_API_URL ?? env.VITE_API_URL ?? 'http://localhost:3000/api/v1';
process.env.E2E_API_URL = apiUrl;
process.env.E2E_ADMIN_EMAIL ??= env.ADMIN_SEED_EMAIL;
process.env.E2E_ADMIN_PASSWORD ??= env.ADMIN_SEED_PASSWORD;
process.env.DATABASE_URL ??= env.DATABASE_URL;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'pnpm --filter @visiora/api start',
      cwd: repoRoot,
      url: `${apiUrl}/health`,
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: 'pnpm --filter @visiora/web dev',
      cwd: repoRoot,
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
});

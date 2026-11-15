import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const unitOnly =
  process.argv.includes('--project=unit') &&
  !process.argv.includes('--project=api') &&
  !process.argv.includes('--project=e2e');

const apiOnly =
  process.argv.includes('--project=api') &&
  !process.argv.includes('--project=e2e');

const webServers = [];
if (!unitOnly) {
  webServers.push({
    command: 'node backend/server.js',
    url: 'http://localhost:3000/api/v1/health',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  });
}
if (!unitOnly && !apiOnly) {
  webServers.push({
    command: 'npm --prefix frontend run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  });
}

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'unit',
      testDir: './tests/unit',
    },
    {
      name: 'api',
      testDir: './tests/api',
      use: {
        baseURL: 'http://localhost:3000',
      },
    },
    {
      name: 'e2e',
      testDir: './tests/e2e',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
      },
    },
  ],
  ...(webServers.length > 0 ? { webServer: webServers } : {}),
});

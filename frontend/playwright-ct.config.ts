import { defineConfig, devices } from '@playwright/experimental-ct-react';

export default defineConfig({
  testDir: './tests/ct',
  snapshotDir: './__snapshots__',
  timeout: 15_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    trace: 'on-first-retry',
    ctPort: 3100,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

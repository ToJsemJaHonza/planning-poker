import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './qa/tests',
  timeout: 45000,
  expect: { timeout: 8000 },
  fullyParallel: true,
  workers: 3,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5173/planning-poker/qa/',
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: ['chromium', 'firefox', 'webkit'].map(browserName => ({ name: browserName, use: { browserName } })),
  webServer: {
    command: 'npm run dev:qa',
    url: 'http://127.0.0.1:5173/planning-poker/qa/',
    reuseExistingServer: !process.env.CI,
  },
});

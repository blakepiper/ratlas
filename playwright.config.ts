import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './.ratlas/tests/browser-results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: './.ratlas/tests/browser-results/results.json' }]],
  use: {
    browserName: 'firefox',
    headless: true,
    deviceScaleFactor: 1,
    locale: 'en-US',
    timezoneId: 'UTC',
    screenshot: 'only-on-failure',
    video: 'off',
    trace: 'off',
    ...(process.env.RATLAS_TEST_BASE_URL ? { baseURL: process.env.RATLAS_TEST_BASE_URL } : {}),
  },
  projects: [
    {
      name: 'firefox-desktop',
      use: { browserName: 'firefox', viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'firefox-narrow',
      use: { browserName: 'firefox', viewport: { width: 390, height: 844 } },
    },
  ],
});

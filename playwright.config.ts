import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests against the production build (`vite preview`), so the offline worker and the
 * per-page HTML are exercised too. Run: npm run e2e
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4319', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run build && npx vite preview --port 4319 --strictPort',
    url: 'http://localhost:4319',
    reuseExistingServer: false,
    timeout: 180_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});

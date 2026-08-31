import { defineConfig, devices } from '@playwright/test';
<<<<<<< HEAD
import { API_ORIGIN, AUTH_ORIGIN } from './Origins';

const consoleOrigin = 'http://127.0.0.1:4183';
const environment = `VITE_API_BASE_URL=${API_ORIGIN} VITE_AUTH_BASE_URL=${AUTH_ORIGIN} VITE_CLIENT_VERSION=1.0.0-finance.e2e DISABLE_HMR=true`;
=======

const consoleOrigin = 'http://127.0.0.1:4183';
const environment = 'VITE_API_BASE_URL=http://127.0.0.1:4311 VITE_AUTH_BASE_URL=http://127.0.0.1:4176 VITE_CLIENT_VERSION=1.0.0-finance.e2e DISABLE_HMR=true';
>>>>>>> 018b2a71 (chore(release): capture current production source)

export default defineConfig({
  testDir: '.',
  testMatch: 'FinanceWorkspace.spec.ts',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  outputDir: '../../tmp/playwright/finance-results',
  reporter: [['list'], ['html', { outputFolder: '../../tmp/playwright/finance-report', open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: consoleOrigin,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: `${environment} npm run dev --workspace @shop/console -- --host 127.0.0.1 --port 4183 --strictPort`,
    url: consoleOrigin,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

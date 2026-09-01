import { defineConfig, devices } from '@playwright/test';

process.env.E2E_API_ORIGIN ??= 'http://127.0.0.1:4311';

const environment = [
  'VITE_API_BASE_URL=http://127.0.0.1:4311',
  'VITE_AUTH_BASE_URL=http://127.0.0.1:4176',
  'VITE_CLIENT_VERSION=1.0.0-e2e',
  'DISABLE_HMR=true',
].join(' ');

export default defineConfig({
  testDir: '.',
  testMatch: 'AccessRoles.spec.ts',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  outputDir: '../../tmp/playwright/access-roles-results',
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: `${environment} npm run dev --workspace @shop/console -- --host 127.0.0.1 --port 4273 --strictPort`,
    url: 'http://127.0.0.1:4273',
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});

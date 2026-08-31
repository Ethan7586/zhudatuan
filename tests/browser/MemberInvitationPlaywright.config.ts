import { defineConfig, devices } from '@playwright/test';

const consoleOrigin = 'http://127.0.0.1:4184';
const environment = 'VITE_API_BASE_URL=http://127.0.0.1:4311 VITE_AUTH_BASE_URL=http://127.0.0.1:4176 VITE_CLIENT_VERSION=1.0.0-invitation.e2e DISABLE_HMR=true';

export default defineConfig({
  testDir: '.',
  testMatch: 'MemberInvitation.spec.ts',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  outputDir: '../../tmp/playwright/member-invitation-results',
  reporter: [['list'], ['html', { outputFolder: '../../tmp/playwright/member-invitation-report', open: 'never' }]],
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
    command: `${environment} npm run dev --workspace @shop/console -- --host 127.0.0.1 --port 4184 --strictPort`,
    url: consoleOrigin,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});

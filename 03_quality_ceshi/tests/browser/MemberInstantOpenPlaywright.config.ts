import { defineConfig, devices } from '@playwright/test';

const consoleOrigin = 'http://127.0.0.1:4185';

export default defineConfig({
  testDir: '.',
  testMatch: 'MemberInstantOpen.spec.ts',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  outputDir: '../../tmp/playwright/member-instant-open-results',
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: consoleOrigin,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm exec --workspace @shop/console -- vite preview --host 127.0.0.1 --port 4185 --strictPort',
    url: consoleOrigin,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});

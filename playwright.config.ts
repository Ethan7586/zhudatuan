import { defineConfig, devices } from '@playwright/test';

const apiOrigin = 'http://127.0.0.1:4311';
const authOrigin = 'http://127.0.0.1:4176';
const environment = `VITE_API_BASE_URL=${apiOrigin} VITE_AUTH_BASE_URL=${authOrigin} VITE_CLIENT_VERSION=1.0.0-e2e DISABLE_HMR=true`;

function webServer(workspace: string, port: number) {
  return {
    command: `${environment} npm run dev --workspace ${workspace} -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe' as const,
    stderr: 'pipe' as const,
  };
}

export default defineConfig({
  testDir: './tests/browser',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: 5,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  outputDir: 'tmp/playwright/results',
  reporter: [['list'], ['html', { outputFolder: 'tmp/playwright/report', open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [webServer('@shop/auth', 4176), webServer('@shop/console', 4173), webServer('@shop/store', 4174), webServer('@shop/supplier', 4175), webServer('@shop/storefront', 4177)],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});

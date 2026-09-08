import { defineConfig, devices } from '@playwright/test';
import { LOCAL_API_ORIGIN, LOCAL_AUTH_ORIGIN, LOCAL_CONSOLE_ORIGIN, LOCAL_STOREFRONT_ORIGIN, LOCAL_STORE_ORIGIN, LOCAL_SUPPLIER_ORIGIN } from '@shop/config/client';

const apiOrigin = LOCAL_API_ORIGIN;
const authOrigin = LOCAL_AUTH_ORIGIN;
const environment = `VITE_API_BASE_URL=${apiOrigin} VITE_AUTH_BASE_URL=${authOrigin} VITE_CONSOLE_ORIGIN=${LOCAL_CONSOLE_ORIGIN} VITE_STOREFRONT_ORIGIN=${LOCAL_STOREFRONT_ORIGIN} VITE_STORE_ORIGIN=${LOCAL_STORE_ORIGIN} VITE_SUPPLIER_ORIGIN=${LOCAL_SUPPLIER_ORIGIN} VITE_CLIENT_VERSION=1.0.0-e2e DISABLE_HMR=true`;

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
  testDir: './tests',
  testMatch: ['browser/RealJourneys.spec.ts', 'e2e/*.spec.ts', 'visual/*.spec.ts', 'accessibility/*.spec.ts'],
  fullyParallel: true,
  globalSetup: './tests/browser/GlobalSetup.ts',
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
  webServer: [
    { command: 'npm run test:e2e:infra', url: 'https://127.0.0.1:8443/health/ready', ignoreHTTPSErrors: true, reuseExistingServer: false, timeout: 120_000, stdout: 'ignore', stderr: 'pipe' },
    { command: 'npm run test:e2e:api', url: `${LOCAL_API_ORIGIN}/health/ready`, reuseExistingServer: false, timeout: 240_000, stdout: 'ignore', stderr: 'pipe' },
    webServer('@shop/auth', 3002),
    webServer('@shop/console', 4173),
    webServer('@shop/storefront', 3000),
    webServer('@shop/store', 4175),
    webServer('@shop/supplier', 4176),
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});

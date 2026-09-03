import { defineConfig, devices } from '@playwright/test';
import { API_ORIGIN, AUTH_ORIGIN, CONSOLE_ORIGIN, STOREFRONT_ORIGIN } from './tests/browser/Origins';

const clientVersion = '1.0.0-e2e';

function webServer(workspace: string, origin: string, environment: Readonly<Record<string, string>>) {
  const port = new URL(origin).port;
  const variables = Object.entries(environment).map(([name, value]) => `${name}=${shell(value)}`).join(' ');
  return {
    command: `${variables} npm run dev --workspace ${shell(workspace)} -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: origin,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe' as const,
    stderr: 'pipe' as const,
  };
}

const viteEnvironment = Object.freeze({
  VITE_API_BASE_URL: API_ORIGIN,
  VITE_AUTH_BASE_URL: AUTH_ORIGIN,
  VITE_STOREFRONT_ORIGIN: STOREFRONT_ORIGIN,
        VITE_H5_ORIGIN: STOREFRONT_ORIGIN,
        VITE_MINI_PROGRAM_ORIGIN: STOREFRONT_ORIGIN,
  VITE_CLIENT_VERSION: clientVersion,
  DISABLE_HMR: 'true',
});

function shell(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
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
    baseURL: CONSOLE_ORIGIN,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    webServer('@smart-wing/auth-web', AUTH_ORIGIN, viteEnvironment),
    webServer('@shop/console', CONSOLE_ORIGIN, viteEnvironment),
    webServer('@smart-wing/storefront-web', STOREFRONT_ORIGIN, {
      NEXT_PUBLIC_API_BASE_URL: API_ORIGIN,
      NEXT_PUBLIC_API_ORIGIN: API_ORIGIN,
      NEXT_PUBLIC_AUTH_ORIGIN: AUTH_ORIGIN,
      NEXT_PUBLIC_CLIENT_VERSION: clientVersion,
      DISABLE_HMR: 'true',
    }),
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});

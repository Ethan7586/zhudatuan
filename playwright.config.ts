import { defineConfig, devices } from '@playwright/test';
<<<<<<< HEAD
import { API_ORIGIN, AUTH_ORIGIN, CONSOLE_ORIGIN, STOREFRONT_ORIGIN } from './tests/browser/Origins';

const clientVersion = '1.0.0-e2e';

function webServer(workspace: string, origin: string, environment: Readonly<Record<string, string>>) {
  const port = new URL(origin).port;
  const variables = Object.entries(environment).map(([name, value]) => `${name}=${shell(value)}`).join(' ');
  return {
    command: `${variables} npm run dev --workspace ${shell(workspace)} -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: origin,
=======

const apiOrigin = 'http://127.0.0.1:4311';
const authOrigin = 'http://127.0.0.1:4176';
const environment = `VITE_API_BASE_URL=${apiOrigin} VITE_AUTH_BASE_URL=${authOrigin} VITE_CLIENT_VERSION=1.0.0-e2e DISABLE_HMR=true`;

function webServer(workspace: string, port: number) {
  return {
    command: `${environment} npm run dev --workspace ${workspace} -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe' as const,
    stderr: 'pipe' as const,
  };
}

<<<<<<< HEAD
const viteEnvironment = Object.freeze({
  VITE_API_BASE_URL: API_ORIGIN,
  VITE_AUTH_BASE_URL: AUTH_ORIGIN,
  VITE_CLIENT_VERSION: clientVersion,
  DISABLE_HMR: 'true',
});

function shell(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
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
<<<<<<< HEAD
    baseURL: CONSOLE_ORIGIN,
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
<<<<<<< HEAD
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
=======
  webServer: [webServer('@shop/auth', 4176), webServer('@shop/console', 4173), webServer('@shop/store', 4174), webServer('@shop/supplier', 4175), webServer('@shop/storefront', 4177)],
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});

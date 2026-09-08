import { expect, type Page } from '@playwright/test';
import { LOCAL_AUTH_ORIGIN, LOCAL_CONSOLE_ORIGIN, LOCAL_STOREFRONT_ORIGIN, type AuthTarget } from '@shop/config/client';
import { localSeedEnvironment } from '@shop/config/server';
import { localSecret } from '../../tools/seed/src/LocalSecrets';

const account = 'ethan';

export async function signInStorefront(page: Page, path = '/cart'): Promise<void> {
  const returnPath = `/s/zhudatuan-local${path}`;
  const target = `${LOCAL_STOREFRONT_ORIGIN}${returnPath}`;
  const login = new URL('/', LOCAL_AUTH_ORIGIN);
  login.searchParams.set('target', 'storefront');
  login.searchParams.set('returnpath', returnPath);
  await page.goto(login.toString());
  await completePasswordSignIn(page);
  await page.waitForURL(target, { timeout: 20_000, waitUntil: 'commit' });
}

export async function signInConsole(page: Page): Promise<void> {
  const target = `${LOCAL_CONSOLE_ORIGIN}/scopes/platform/organization-platform-root/control`;
  await page.goto(target);
  await completePasswordSignIn(page);
  await page.waitForURL(new RegExp(`^${escape(LOCAL_CONSOLE_ORIGIN)}(?:/|$)`), { timeout: 20_000, waitUntil: 'commit' });
  if (!new URL(page.url()).pathname.startsWith('/scopes/')) await page.goto(target, { waitUntil: 'commit' });
  await page.waitForURL(new RegExp(`^${escape(LOCAL_CONSOLE_ORIGIN)}/scopes/`), { timeout: 20_000, waitUntil: 'commit' });
}

export async function signInSurface(page: Page, target: AuthTarget, origin: string, path: string): Promise<void> {
  const destination = `${origin}${path}`;
  await page.goto(destination);
  await completePasswordSignIn(page);
  await page.waitForURL(new RegExp(`^${escape(origin)}(?:/|$)`), { timeout: 20_000, waitUntil: 'commit' });
  if (new URL(page.url()).pathname === '/') await page.goto(destination, { waitUntil: 'commit' });
  await page.waitForURL(new RegExp(`^${escape(origin)}/`), { timeout: 20_000, waitUntil: 'commit' });
}

export async function completePasswordSignIn(page: Page): Promise<void> {
  const accountField = page.getByLabel('登录账号或已绑定手机号');
  await accountField.waitFor({ state: 'visible', timeout: 20_000 });
  const password = await localSecret(localSeedEnvironment().ethanPasswordRef);
  await accountField.fill(account);
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByRole('checkbox', { name: /我已阅读并同意/ }).check();
  await page.getByRole('button', { name: /登录并进入/ }).click();
}

export async function expectResponsivePage(page: Page): Promise<void> {
  await page.locator('main:visible').first().waitFor({ state: 'visible' });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

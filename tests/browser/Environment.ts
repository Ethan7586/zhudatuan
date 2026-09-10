import { expect, type Page } from '@playwright/test';
import { LOCAL_AUTH_ORIGIN, LOCAL_CONSOLE_ORIGIN, LOCAL_STOREFRONT_ORIGIN, type AuthTarget } from '@shop/config/client';
import { LOCAL_SECRET_REFS, localSeedEnvironment } from '@shop/config/server';
import { localSecret } from '../../tools/seed/src/LocalSecrets';
import { Client } from 'pg';
import { HttpKmsClient } from '../../services/commerce/src/platform/crypto/KmsClient';

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

export async function completeOtpSignIn(page: Page): Promise<void> {
  await page.getByRole('tab', { name: '验证码登录' }).click();
  await page.getByLabel('登录账号或已绑定手机号').fill(account);
  await page.getByRole('button', { name: '获取验证码' }).click();
  await expect(page.getByText(/验证码发送请求已提交/)).toBeVisible();
  await page.getByLabel('短信验证码').fill(await localSecret(LOCAL_SECRET_REFS.identityChallengeCode));
  await page.getByRole('checkbox', { name: /我已阅读并同意/ }).check();
  await page.getByRole('button', { name: /登录并进入/ }).click();
}

export async function completeConsoleStepup(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog', { name: '开启二次验证' });
  await expect(dialog).toBeVisible();
  const challengeResponse = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith('/api/v1/identity/stepup/challenges'));
  await dialog.getByRole('button', { name: '发送验证码' }).click();
  const payload = (await (await challengeResponse).json()) as Readonly<{ id?: unknown }>;
  if (typeof payload.id !== 'string') throw new Error('BROWSER_STEPUP_CHALLENGE_INVALID');
  const code = await localStepupCode(payload.id);
  await dialog.getByLabel('二次验证验证码').fill(code);
  await Promise.all([page.waitForNavigation({ waitUntil: 'commit' }), dialog.getByRole('button', { name: '确认验证' }).click()]);
  await page.locator('main:visible').first().waitFor({ state: 'visible' });
}

export async function completeStorefrontStepup(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog', { name: '确认是你本人操作' });
  await expect(dialog).toBeVisible();
  const challengeResponse = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith('/api/v1/identity/stepup/challenges'));
  await dialog.getByRole('button', { name: '发送验证码' }).click();
  const payload = (await (await challengeResponse).json()) as Readonly<{ id?: unknown }>;
  if (typeof payload.id !== 'string') throw new Error('BROWSER_STEPUP_CHALLENGE_INVALID');
  await dialog.getByLabel('二次验证验证码').fill(await localStepupCode(payload.id));
  await dialog.getByRole('button', { name: '确认验证' }).click();
  await expect(dialog).toBeHidden();
}

export async function expectResponsivePage(page: Page): Promise<void> {
  await page.locator('main:visible').first().waitFor({ state: 'visible' });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function localStepupCode(challenge: string): Promise<string> {
  const environment = localSeedEnvironment();
  const database = new Client({ connectionString: await localSecret(environment.adminDatabaseConnectionRef) });
  await database.connect();
  try {
    const result = await database.query<{ code_ciphertext: string }>('select code_ciphertext from identity.challengesecret where challenge_id=$1', [challenge]);
    const ciphertext = result.rows[0]?.code_ciphertext;
    if (!ciphertext) throw new Error('BROWSER_STEPUP_SECRET_MISSING');
    return new HttpKmsClient(environment.kmsEndpoint, environment.kmsBearerToken).decrypt('pii', 'identity/challenge', ciphertext, { challenge, purpose: 'stepup' });
  } finally {
    await database.end();
  }
}

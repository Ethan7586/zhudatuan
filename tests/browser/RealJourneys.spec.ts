import { expect, test } from '@playwright/test';
import { LOCAL_API_ORIGIN, LOCAL_AUTH_ORIGIN, LOCAL_CONSOLE_ORIGIN, LOCAL_STOREFRONT_ORIGIN } from '@shop/config/client';
import { expectWcagAA } from './Accessibility';
import { completeOtpSignIn, completePasswordSignIn, expectResponsivePage, signInConsole, signInStorefront } from './Environment';

test('真实 API 健康门禁与未知路径失败语义有效', async ({ request }) => {
  const health = await request.get(`${LOCAL_API_ORIGIN}/health/ready`);
  expect(health.status()).toBe(200);
  await expect(health.json()).resolves.toMatchObject({ status: 'ready', condition: 'ready', healthy: true });
  const unknown = await request.get(`${LOCAL_API_ORIGIN}/api/v1/not-registered`, { headers: { origin: LOCAL_AUTH_ORIGIN } });
  expect(unknown.status()).toBe(404);
});

test('匿名用户读取真实发布目录且不依赖 Commerce Mock', async ({ page }) => {
  const operations: string[] = [];
  page.on('response', (response) => {
    if (response.url().startsWith(LOCAL_API_ORIGIN)) operations.push(new URL(response.url()).pathname);
  });
  await page.goto(`${LOCAL_STOREFRONT_ORIGIN}/s/zhudatuan-local`);
  await expect(page.getByText('暖心生活关怀礼盒').first()).toBeVisible();
  await expect(page.getByText('工作日营养餐券').first()).toBeVisible();
  await expect(page.getByText('全国通兑电影票').first()).toBeVisible();
  expect(new Set(operations)).toEqual(new Set(['/api/v1/storefront/bootstrap', '/api/v1/storefront/catalog', '/api/v1/carts/current']));
  await expectResponsivePage(page);
  await expectWcagAA(page);
});

test('员工深链登录后读取真实购物车与商品权威信息', async ({ page }) => {
  const operations: string[] = [];
  page.on('response', (response) => {
    if (response.url().startsWith(LOCAL_API_ORIGIN)) operations.push(new URL(response.url()).pathname);
  });
  await signInStorefront(page);
  await expect(page.getByRole('heading', { level: 1, name: '购物车' })).toBeVisible();
  await expect(page.getByText('暖心生活关怀礼盒')).toBeVisible();
  await expect(page.getByText('正在读取购物车…')).toHaveCount(0);
  expect(operations).toContain('/api/v1/carts/current');
  await expect.poll(() => operations).toContain('/api/v1/storefront/catalog');
  await expectResponsivePage(page);
  await expectWcagAA(page);
});

test('员工从消费者商城登录入口进入所属商城而不是无效根地址', async ({ page }) => {
  await page.goto(`${LOCAL_AUTH_ORIGIN}/?target=storefront`);
  await completePasswordSignIn(page);
  await page.waitForURL(`${LOCAL_STOREFRONT_ORIGIN}/s/zhudatuan-local`, { timeout: 20_000, waitUntil: 'commit' });
  await expect(page.getByText('暖心生活关怀礼盒').first()).toBeVisible();
  await expectResponsivePage(page);
  await expectWcagAA(page);
});

test('运营人员深链登录后建立真实平台 Scope 并读取中控台', async ({ page }) => {
  const operations: string[] = [];
  page.on('response', (response) => {
    if (response.url().startsWith(LOCAL_API_ORIGIN)) operations.push(new URL(response.url()).pathname);
  });
  await signInConsole(page);
  await expect(page).toHaveURL(new RegExp(`^${LOCAL_CONSOLE_ORIGIN.replaceAll('.', '\\.')}/scopes/`));
  await expect(page.getByRole('heading', { level: 1, name: '智慧翼中控台' })).toBeVisible();
  expect(operations).toContain('/api/v1/identity/session');
  expect(operations).toContain('/api/v1/organizations/layers');
  await expectResponsivePage(page);
  await expectWcagAA(page);
});

test('员工密码登录建立两小时会话并可显式安全退出', async ({ page }) => {
  await page.goto(`${LOCAL_AUTH_ORIGIN}/?target=storefront&returnpath=%2Fs%2Fzhudatuan-local%2Fprofile`);
  await completePasswordSignIn(page);
  await page.waitForURL(`${LOCAL_STOREFRONT_ORIGIN}/s/zhudatuan-local/profile`);
  await expectSessionLifetime(page, 'storefront');
  await expect(page.getByRole('heading', { name: 'Ethan' })).toBeVisible();
  await page.getByRole('button', { name: '退出', exact: true }).click();
  await page.waitForURL(new RegExp(`^${LOCAL_AUTH_ORIGIN.replaceAll('.', '\\.')}/`));
  await expect(page.getByRole('heading', { name: '统一账号认证' })).toBeVisible();
});

test('运营人员使用本地固定验证码登录并可显式安全退出', async ({ page }) => {
  await page.goto(`${LOCAL_AUTH_ORIGIN}/?target=console&returnpath=%2Fscopes%2Fplatform%2Forganization-platform-root%2Fcontrol`);
  await completeOtpSignIn(page);
  await page.waitForURL(new RegExp(`^${LOCAL_CONSOLE_ORIGIN.replaceAll('.', '\\.')}/scopes/`));
  await expectSessionLifetime(page, 'console');
  await page.getByRole('button', { name: /打开 Ethan 的账户菜单/ }).click();
  await page.getByRole('button', { name: '退出登录' }).click();
  await page.waitForURL(new RegExp(`^${LOCAL_AUTH_ORIGIN.replaceAll('.', '\\.')}/`));
  await expect(page.getByRole('heading', { name: '统一账号认证' })).toBeVisible();
});

async function expectSessionLifetime(page: Parameters<typeof expectResponsivePage>[0], target: 'storefront' | 'console'): Promise<void> {
  const cookie = (await page.context().cookies()).find(({ name }) => name === `__Host-${target}-session`);
  expect(cookie).toBeDefined();
  expect(cookie).toMatchObject({ domain: '127.0.0.1', path: '/', httpOnly: true, secure: true, sameSite: 'Strict' });
  const remaining = (cookie?.expires ?? 0) - Date.now() / 1_000;
  expect(remaining).toBeGreaterThan(7_080);
  expect(remaining).toBeLessThanOrEqual(7_200);
}

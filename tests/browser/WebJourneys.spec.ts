import { expect, test } from '@playwright/test';
import { LOCAL_API_ORIGIN, LOCAL_AUTH_ORIGIN } from '@shop/config/client';
import { expectWcagAA } from './Accessibility';
import { createConsoleMock } from './ConsoleMock';
import { cockpit, consoleSession, storefrontBootstrap, storefrontCatalog } from './Fixtures';
import { OperationMock } from './OperationMock';

test('Auth 登录深链保留 PKCE 边界并满足 WCAG A/AA', async ({ page }) => {
  const api = new OperationMock(page)
    .get('/api/v1/identity/providers', {
      items: [],
      csrf: 'csrf:e2e',
      target: 'console',
      returnTarget: 'http://127.0.0.1:4173/',
    })
    .post('/api/v1/identity/sessions', (call) => {
      expect(call.headers['idempotency-key']).toBeTruthy();
      expect(call.headers['x-client-version']).toBe('1.0.0-e2e');
      expect(call.headers['x-csrf-token']).toBe('csrf:e2e');
      expect(call.body).toMatchObject({
        method: 'password',
        subject: 'e2e-user',
        password: 'correct-horse',
        target: 'console',
        authorization: { state: expect.any(String), nonce: expect.any(String), challenge: expect.any(String) },
      });
      return {
        kind: 'selection',
        transaction: 'transaction:e2e',
        memberships: [{ id: 'membership:e2e', target: 'console' }],
      };
    });
  await api.install();

  await page.goto(`${LOCAL_AUTH_ORIGIN}/login?target=console`);
  await expect(page.getByRole('heading', { level: 1, name: '企业福利 全新定义' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: '统一账号认证' })).toBeVisible();
  await expect(page).toHaveTitle('统一登录｜智慧翼企业福利商城');
  await expect(page.getByRole('tablist', { name: '登录方式' })).toContainText('密码登录验证码登录邀请码登录');
  await expect(page.getByRole('button', { name: '忘记密码？' })).toBeVisible();

  await page.getByLabel('登录账号或已绑定手机号').fill('e2e-user');
  await page.getByLabel('密码', { exact: true }).fill('correct-horse');
  await page.getByRole('checkbox', { name: /我已阅读并同意智慧翼福利商城/ }).check();
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2, name: '选择你的工作台' })).toBeVisible();
  await expect(page.getByRole('button', { name: /筑大团运营后台/ })).toContainText('已授权企业 · 运营会员');
  await expectWcagAA(page);

  const status = await page.evaluate(async (origin) => (await fetch(`${origin}/api/v1/not-registered`)).status, LOCAL_API_ORIGIN);
  expect(status).toBe(501);
  expect(api.unmatched).toHaveLength(1);
  expect(api.unmatched[0]?.path).toBe('/api/v1/not-registered');
});

test('Console 经营驾驶舱深链展示权威读模型并满足 WCAG A/AA', async ({ page }) => {
  const api = createConsoleMock(page, consoleSession).get('/api/v1/reports/dashboard', cockpit);
  await api.install();

  await page.goto('http://127.0.0.1:4173/scopes/enterprise/enterprise%3Ae2e/cockpit?period=30days');
  const heading = page.getByRole('heading', { level: 1, name: '经营驾驶舱' });
  await expect(heading).toBeFocused();
  await expect(page).toHaveTitle('经营驾驶舱 · 智慧翼');
  await expect(page.locator('.cockpitpage')).toContainText('¥2,486,320.00');
  await expect(page.getByRole('heading', { name: '商城经营对比' })).toBeVisible();
  await expect(page.getByRole('button', { name: '经营驾驶舱' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: '商品管理' })).toBeVisible();
  expect(api.unmatched).toEqual([]);
  await expectWcagAA(page);
});

test('Console 平台层深链展示权威组织范围并满足 WCAG A/AA', async ({ page }) => {
  const controlSession = {
    ...consoleSession,
    scope: { kind: 'platform', id: 'platform:e2e', name: '测试平台' },
    scopes: [{ kind: 'platform', id: 'platform:e2e', name: '测试平台' }],
    permissions: [...consoleSession.permissions, 'organization.layer.read'],
    capabilities: [...consoleSession.capabilities, 'organization.layers.read'],
    assurance: { level: 2, verified: 'step-up' },
  };
  const api = createConsoleMock(page, controlSession).get('/api/v1/organizations/layers', {
    items: [{ id: 'enterprise:e2e', kind: 'enterprise', parent_id: null, name: '测试集团', timezone: 'Asia/Shanghai', status: 'active', version: 3 }],
    count: 1,
  });
  await api.install();

  await page.goto('http://127.0.0.1:4173/scopes/platform/platform%3Ae2e/control');
  const heading = page.getByRole('heading', { level: 1, name: '中控台' });
  await expect(heading).toBeFocused();
  await expect(page).toHaveTitle('中控台 · 智慧翼');
  await expect(page.getByRole('table', { name: '中控台' })).toContainText('测试集团');
  await expect(page.getByRole('button', { name: '中控台', exact: true })).toHaveAttribute('aria-current', 'page');
  const layerCalls = api.calls.filter((call) => call.path === '/api/v1/organizations/layers');
  expect(layerCalls.length).toBeGreaterThan(0);
  expect(layerCalls.every((call) => call.headers['x-scope-hint'] === 'platform:e2e')).toBe(true);
  expect(layerCalls.every((call) => call.headers['x-access-version'] === '1')).toBe(true);
  expect(api.unmatched).toEqual([]);
  await expectWcagAA(page);
});

test('Storefront 公开首页无需会话即可深链并满足 WCAG A/AA', async ({ page }) => {
  const api = new OperationMock(page).get('/api/v1/storefront/bootstrap', storefrontBootstrap).get('/api/v1/storefront/catalog', storefrontCatalog);
  await api.install();

  await page.goto('http://127.0.0.1:4177/m/mall%3Ae2e');
  await expect(page.getByRole('heading', { level: 1, name: '智慧翼企业福利专场 · 权益按报价结算' })).toBeVisible();
  await expect(page).toHaveTitle('智慧翼企业福利商城｜企业员工福利平台');
  await expect(page.getByRole('navigation', { name: '商城页面导航' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('navigation', { name: 'Android底部导航' })).toBeVisible();
  await expect(page.getByRole('button', { name: '返回商城首页' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const operationPaths = api.calls.map((call) => call.path);
  expect(operationPaths.length).toBeGreaterThan(0);
  expect(new Set(operationPaths)).toEqual(new Set(['/api/v1/storefront/bootstrap', '/api/v1/storefront/catalog']));
  expect(api.calls.every((call) => call.method === 'GET')).toBe(true);
  expect(api.unmatched).toEqual([]);
  await expectWcagAA(page);
});

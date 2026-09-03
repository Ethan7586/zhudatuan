import { expect, test } from '@playwright/test';
import { expectWcagAA } from './Accessibility';
import { cockpit, consoleSession, controlHealth } from './Fixtures';
import { OperationMock } from './OperationMock';
import { API_ORIGIN, AUTH_ORIGIN, CONSOLE_ORIGIN, STOREFRONT_ORIGIN } from './Origins';

test('Auth 普通登录与企业管理入口双向切换', async ({ page }) => {
  await page.goto(`${AUTH_ORIGIN}/login?client=console`);

  await expect(page.locator('[data-login-mode="consumer"]')).toBeVisible();
  await expect(page.getByRole('tab', { name: '企微扫码' })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: '企业 SSO' })).toHaveCount(0);

  await page.getByRole('button', { name: '企业管理' }).click();
  await expect(page.locator('[data-login-mode="enterprise"]')).toBeVisible();
  await expect(page.getByRole('tab', { name: '企微扫码' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '企业 SSO' })).toBeVisible();

  await page.getByRole('button', { name: '福利商城' }).click();
  await expect(page.locator('[data-login-mode="consumer"]')).toBeVisible();
  await expect(page.getByRole('tab', { name: '企微扫码' })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: '企业 SSO' })).toHaveCount(0);
});

test('Auth 登录深链保留 PKCE 边界并满足 WCAG A/AA', async ({ page }) => {
  const api = new OperationMock(page).post('/api/v1/identity/sessions', (call) => {
    expect(call.headers['idempotency-key']).toBeTruthy();
    expect(call.headers['x-client-version']).toBe('1.0.0-e2e');
    expect(call.body).toMatchObject({
      subject: 'e2e-user',
      password: 'correct-horse',
      authorization: { state: expect.any(String), nonce: expect.any(String), challenge: expect.any(String) },
    });
    return { principal: 'principal:e2e', memberships: [{ id: 'membership:e2e', client: 'console' }] };
  });
  await api.install();

  await page.goto(`${AUTH_ORIGIN}/login?client=console`);
  await expect(page.getByRole('heading', { level: 1, name: /企业福利\s*全新定义/ })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: '统一账号认证' })).toBeVisible();
  await expect(page).toHaveTitle('统一登录｜智慧翼企业福利商城');

  await page.getByLabel('登录账号或已绑定手机号').fill('e2e-user');
  await page.getByRole('textbox', { name: '密码', exact: true }).fill('correct-horse');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2, name: '选择你的工作台' })).toBeVisible();
  await expect(page.getByRole('button', { name: '进入运营后台：已授权企业，运营会员' })).toBeVisible();
  await expectWcagAA(page);

  const status = await page.evaluate(async (origin) => (await fetch(`${origin}/api/v1/not-registered`)).status, API_ORIGIN);
  expect(status).toBe(501);
  expect(api.unmatched).toHaveLength(1);
  expect(api.unmatched[0]?.path).toBe('/api/v1/not-registered');
});

test('Console 经营驾驶舱深链展示权威读模型并满足 WCAG A/AA', async ({ page }) => {
  const api = new OperationMock(page).get('/api/v1/identity/session', consoleSession).get('/api/v1/members/me', { display_name: '验收管理员', employee_no: 'E2E001' }).get('/api/v1/reports/dashboard', cockpit);
  await api.install();

  await page.goto(`${CONSOLE_ORIGIN}/scopes/platform/platform%3Ae2e/cockpit?period=30days`);
  const heading = page.getByRole('heading', { level: 1, name: '经营驾驶舱' });
  await expect(heading).toBeFocused();
  await expect(page).toHaveTitle('经营驾驶舱 · 智慧翼');
  await expect(page.getByRole('region', { name: '经营摘要' })).toContainText('¥2,486,320.00');
  await expect(page.getByRole('heading', { name: '商城经营对比' })).toBeVisible();
  await expect(page.getByRole('button', { name: '经营驾驶舱' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: '智慧翼中控台' })).toBeVisible();
  expect(api.unmatched).toEqual([]);
  await expectWcagAA(page);
});

test('Console 中控台展示权威健康读模型并闭合恢复确认边界', async ({ page }) => {
  const controlSession = {
    ...consoleSession,
    permissions: [...consoleSession.permissions, 'runtime.health.read'],
    capabilities: [...consoleSession.capabilities, 'runtime.health.dependency'],
    assurance: { level: 2, verified: 'step-up' },
  };
  const api = new OperationMock(page).get('/api/v1/identity/session', controlSession).get('/api/v1/members/me', { display_name: '验收管理员', employee_no: 'E2E001' });
  let healthReads = 0;
  await page.route(`${API_ORIGIN}/health/dependency`, async (route) => {
    const request = route.request();
    const corsHeaders = {
      'access-control-allow-origin': CONSOLE_ORIGIN,
      'access-control-allow-credentials': 'true',
    };
    if (request.method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          ...corsHeaders,
          'access-control-allow-methods': 'GET,OPTIONS',
          'access-control-allow-headers': 'accept,content-type,x-access-version,x-client-version,x-contract-version,x-scope-hint,x-trace-id',
        },
      });
      return;
    }
    expect(request.method()).toBe('GET');
    expect(request.headers()['x-scope-hint']).toBe('platform:e2e');
    expect(request.headers()['x-access-version']).toBe('1');
    healthReads += 1;
    await route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', headers: corsHeaders, body: JSON.stringify(controlHealth) });
  });
  await api.install();

  await page.goto(`${CONSOLE_ORIGIN}/scopes/platform/platform%3Ae2e/control`);
  const heading = page.getByRole('heading', { level: 1, name: '智慧翼中控台' });
  await expect(heading).toBeVisible();
  await expect(page).toHaveTitle('中控台 · 智慧翼');
  await expect(page.getByText(controlHealth.controlPlane.conclusion, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '智慧翼中控台', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: '平台能力链' })).toBeVisible();
  expect(healthReads).toBeGreaterThanOrEqual(1);
  const healthReadsBeforeRefresh = healthReads;
  await page.getByRole('button', { name: '刷新态势' }).click();
  await expect.poll(() => healthReads).toBeGreaterThan(healthReadsBeforeRefresh);
  await expect(page.getByRole('button', { name: '刷新态势' })).toBeVisible();
  expect(api.unmatched).toEqual([]);

  await page.getByRole('button', { name: '查看证据' }).click();
  const evidence = page.getByRole('dialog', { name: '处置证据' });
  await expect(evidence).toContainText('供应商授权凭证过期');
  await expect(evidence).toContainText('catalog、supplier');
  await evidence.getByRole('button', { name: '关闭' }).click();
  await expect(evidence).toBeHidden();

  await page.getByRole('button', { name: '执行恢复' }).click();
  const preview = page.getByRole('dialog', { name: '恢复影响预览' });
  await expect(preview).toContainText('PREVIEW → CONFIRM → STEP-UP');
  await expect(preview).toContainText('执行前将重新读取状态并要求 Step-up');
  await preview.getByRole('button', { name: '确认并进入 Step-up' }).click();
  const receipt = page.getByRole('dialog', { name: '恢复请求待执行' });
  await expect(receipt.getByRole('status')).toContainText('预览与确认已完成');
  await expect(receipt).toContainText('action-bound proof');
  await expectWcagAA(page);
});

test('Storefront 未登录首页只读取会话并失败关闭且满足 WCAG A/AA', async ({ page }) => {
  const api = new OperationMock(page);
  await api.install();

  await page.goto(STOREFRONT_ORIGIN);
  await expect(page).toHaveTitle('智慧翼企业福利商城｜企业员工福利平台');
  await expect(page.getByRole('link', { name: '登录或注册智慧翼账户' })).toBeVisible();
  await expect(page.getByText('登录 / 注册', { exact: true })).toBeVisible();
  await expect(page.getByText('登录后从生产数据库加载企业商品与权益。', { exact: true })).toBeVisible();
  await expect.poll(() => api.calls.length).toBeGreaterThan(0);
  await expectWcagAA(page);
  expect([...new Set(api.calls.map((call) => call.path))]).toEqual(['/api/v1/identity/session']);
  expect([...new Set(api.unmatched.map((call) => call.path))]).toEqual(['/api/v1/identity/session']);
});

import { expect, test } from '@playwright/test';
import { expectWcagAA } from './Accessibility';
import { cockpit, consoleSession, controlHealth, publication, storeSession, supplierSession } from './Fixtures';
import { OperationMock } from './OperationMock';

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

  await page.goto('http://127.0.0.1:4176/login?client=console');
  const heading = page.getByRole('heading', { level: 1, name: '登录福利商城' });
  await expect(heading).toBeFocused();
  await expect(page).toHaveTitle('登录 · 智慧翼 Smart Wing');
  await expect(page.getByRole('navigation', { name: '身份服务' })).toContainText('找回密码');

  await page.getByLabel('手机号或用户名').fill('e2e-user');
  await page.getByLabel('密码').fill('correct-horse');
  await page.getByRole('button', { name: '安全登录', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('请选择本次进入的会员身份。');
  await expect(page.getByLabel('选择身份')).toHaveValue('');
  await expectWcagAA(page);

  const status = await page.evaluate(async () => (await fetch('http://127.0.0.1:4311/api/v1/not-registered')).status);
  expect(status).toBe(501);
  expect(api.unmatched).toHaveLength(1);
  expect(api.unmatched[0]?.path).toBe('/api/v1/not-registered');
});

test('Console 经营驾驶舱深链展示权威读模型并满足 WCAG A/AA', async ({ page }) => {
  const api = new OperationMock(page).get('/api/v1/identity/session', consoleSession).get('/api/v1/members/me', { display_name: '验收管理员', employee_no: 'E2E001' }).get('/api/v1/reports/dashboard', cockpit);
  await api.install();

  await page.goto('http://127.0.0.1:4173/scopes/platform/platform%3Ae2e/cockpit?period=30days');
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
    capabilities: [...consoleSession.capabilities, 'runtime.health.read'],
    assurance: { level: 2, verified: 'step-up' },
  };
  const api = new OperationMock(page).get('/api/v1/identity/session', controlSession).get('/api/v1/members/me', { display_name: '验收管理员', employee_no: 'E2E001' });
  let healthReads = 0;
  await page.route('http://127.0.0.1:4311/health/dependency', async (route) => {
    const request = route.request();
    const corsHeaders = {
      'access-control-allow-origin': 'http://127.0.0.1:4173',
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

  await page.goto('http://127.0.0.1:4173/scopes/platform/platform%3Ae2e/control');
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

test('Store 品牌页深链失败关闭并满足 WCAG A/AA', async ({ page }) => {
  const api = new OperationMock(page).get('/api/v1/identity/session', storeSession);
  await api.install();

  await page.goto('http://127.0.0.1:4174/stores/store%3Ae2e/brand');
  const heading = page.getByRole('heading', { level: 1, name: '品牌管理' });
  await expect(heading).toBeFocused();
  await expect(page).toHaveTitle('品牌管理 · 智慧翼');
  await expect(page.getByRole('button', { name: /品牌管理/ })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByText(/OPERATION_GAP · STORE\.brand/)).toBeVisible();
  expect(api.unmatched).toEqual([]);
  await expectWcagAA(page);
});

test('Supplier 品牌页深链失败关闭并满足 WCAG A/AA', async ({ page }) => {
  const api = new OperationMock(page).get('/api/v1/identity/session', supplierSession);
  await api.install();

  await page.goto('http://127.0.0.1:4175/suppliers/supplier%3Ae2e/brand');
  const heading = page.getByRole('heading', { level: 1, name: '品牌管理' });
  await expect(heading).toBeFocused();
  await expect(page).toHaveTitle('品牌管理 · 智慧翼');
  await expect(page.getByRole('button', { name: /品牌管理/ })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByText(/OPERATION_GAP · SUPPLIER\.brand/)).toBeVisible();
  expect(api.unmatched).toEqual([]);
  await expectWcagAA(page);
});

test('Storefront 公开首页无需会话即可深链并满足 WCAG A/AA', async ({ page }) => {
  const api = new OperationMock(page).get('/api/v1/experiences/published', publication);
  await api.install();

  await page.goto('http://127.0.0.1:4177/m/mall%3Ae2e');
  await expect(page.getByRole('heading', { level: 1, name: '智慧翼福利首页测试' })).toBeFocused();
  await expect(page).toHaveTitle('首页 · 智慧翼福利商城');
  await expect(page.getByRole('navigation', { name: '商城主导航' })).toContainText('全部商品分类');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('navigation', { name: '移动端主导航' })).toContainText('首页分类翼码订单我的');
  const operationPaths = api.calls.map((call) => call.path);
  expect(operationPaths.length).toBeGreaterThan(0);
  expect(new Set(operationPaths)).toEqual(new Set(['/api/v1/experiences/published']));
  expect(api.unmatched).toEqual([]);
  await expectWcagAA(page);
});

import { expect, test } from '@playwright/test';
import { LOCAL_API_ORIGIN, LOCAL_AUTH_ORIGIN } from '@shop/config/client';
import { expectWcagAA } from './Accessibility';
import { createConsoleMock } from './ConsoleMock';
import { cockpit, consoleSession, storefrontBootstrap, storefrontCatalog } from './Fixtures';
import { OperationMock } from './OperationMock';
import jsQR from 'jsqr';

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
  await page.getByRole('checkbox', { name: /我已阅读并同意/ }).check();
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
  await expect(page.getByRole('button', { name: '商品治理台' })).toBeVisible();
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
  await expect(page).toHaveTitle('智慧翼中控台 · 智慧翼');
  await expect(page.getByRole('table', { name: '中控台' })).toContainText('测试集团');
  await expect(page.getByRole('button', { name: '智慧翼中控台', exact: true })).toHaveAttribute('aria-current', 'page');
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

  await page.goto('http://127.0.0.1:3000/s/mall-e2e');
  await expect(page.getByRole('heading', { level: 1, name: '智慧翼企业福利专场 · 权益按报价结算' })).toBeVisible();
  await expect(page).toHaveTitle('智慧翼企业福利商城｜企业员工福利平台');
  await expect(page.getByRole('navigation', { name: '商城页面导航' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('navigation', { name: 'Android底部导航' })).toBeVisible();
  await expect(page.getByRole('button', { name: '返回商城首页' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const operationPaths = api.calls.map((call) => call.path);
  expect(operationPaths.length).toBeGreaterThan(0);
  await expect.poll(() => new Set(api.calls.map((call) => call.path))).toEqual(new Set(['/api/v1/storefront/bootstrap', '/api/v1/storefront/catalog']));
  expect(api.calls.every((call) => call.method === 'GET')).toBe(true);
  expect(api.calls.every((call) => call.headers['x-storefront-handle'] === 'mall-e2e')).toBe(true);
  expect(api.unmatched).toEqual([]);
  await expectWcagAA(page);
});

test('Console 商城码按需生成并在手机宽度保持可访问', async ({ page }) => {
  const session = {
    ...consoleSession,
    permissions: [...consoleSession.permissions, 'experience.application.read'],
    capabilities: [...consoleSession.capabilities, 'experience.applications.read'],
  };
  const applications = {
    items: [
      {
        id: 'application:e2e',
        mallId: 'mall:e2e',
        code: 'MALLE2E',
        publicSlug: 'mall-e2e',
        name: '鸿泰惠民通',
        status: 'active',
        version: 8,
        headSequence: 8,
        publishedSequence: 8,
        entry: { handle: 'mall-e2e', url: 'http://127.0.0.1:3000/s/mall-e2e', state: 'ready', releaseId: 'release:e2e', releaseVersion: 'version:e2e', contentHash: 'a'.repeat(64) },
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
    ],
    count: 1,
  };
  const api = createConsoleMock(page, session).get('/api/v1/experiences/applications', applications);
  await api.install();

  await page.goto('http://127.0.0.1:4173/scopes/enterprise/enterprise%3Ae2e/experience');
  await expect(page.getByRole('heading', { level: 1, name: '商城管理' })).toBeVisible();
  const trigger = page.getByRole('button', { name: '商城码', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: '商城入口' });
  await expect(dialog.getByRole('img', { name: '鸿泰惠民通商城二维码' })).toBeVisible();
  const renderedQr = await dialog.locator('svg').evaluate((svg) => ({ viewBox: svg.getAttribute('viewBox'), path: svg.querySelector('path')?.getAttribute('d') ?? null }));
  expect(decodeRenderedQr(renderedQr)).toBe('http://127.0.0.1:3000/s/mall-e2e');
  await expect(dialog.getByRole('link', { name: 'http://127.0.0.1:3000/s/mall-e2e' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: '复制链接' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: '下载二维码' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: '新窗口打开商城' })).toBeVisible();
  for (const width of [320, 768, 1366, 1440]) {
    await page.setViewportSize({ width, height: width === 320 ? 720 : 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(api.calls.filter((call) => call.path === '/api/v1/experiences/applications').every((call) => call.headers['x-scope-hint'] === 'enterprise:e2e')).toBe(true);
  expect(api.unmatched).toEqual([]);
  await expectWcagAA(page);
});

test('Storefront 受保护深链登录保留原商城路径', async ({ page }) => {
  let bootstraps = 0;
  let authenticated = false;
  const signedTarget = `proof.${'a'.repeat(64)}`;
  const api = new OperationMock(page)
    .get('/api/v1/storefront/bootstrap', () => {
      bootstraps += 1;
      if (!authenticated) return storefrontBootstrap;
      return {
        ...storefrontBootstrap,
        identity: { ...storefrontBootstrap.identity, version: '1', data: { state: 'member', member: { id: 'member:e2e', displayName: '测试员工' }, membership: 'membership:e2e' } },
      };
    })
    .get('/api/v1/identity/providers', { items: [], csrf: 'c'.repeat(43), target: 'storefront', returnTarget: signedTarget })
    .get('/api/v1/identity/memberships', { items: [], count: 0 })
    .get('/api/v1/benefits/accounts', { items: [], count: 0 })
    .get('/api/v1/members/me/addresses', { items: [], count: 0 })
    .get('/api/v1/members/me/favorites', { items: [], count: 0 })
    .get('/api/v1/members/me', {
      id: 'member:e2e',
      display_name: '测试员工',
      status: 'active',
      mobile_bound: true,
      membership_id: 'membership:e2e',
      organization_id: 'mall:e2e',
      employee_no: null,
      joined_at: '2026-09-01T00:00:00.000Z',
      access_version: 1,
    })
    .get('/api/v1/carts/current', { version: 0, items: [] })
    .post('/api/v1/identity/sessions', { kind: 'session', ticket: 't'.repeat(64), returnTarget: signedTarget }, 201)
    .post('/api/v1/identity/tickets/exchange', () => {
      authenticated = true;
      return {
        returnTarget: { url: 'http://127.0.0.1:3000/s/mall-e2e/orders?state=paid', proof: signedTarget, expiresAt: '2099-01-01T00:00:00.000Z', target: 'storefront' },
        expiresIn: 3600,
      };
    });
  await api.install();

  await page.goto('http://127.0.0.1:3000/s/mall-e2e/orders?state=paid');
  await expect(page).toHaveURL(/127\.0\.0\.1:3002/);
  const destination = new URL(page.url());
  expect(destination.searchParams.get('target')).toBe('storefront');
  expect(destination.searchParams.get('returnpath')).toBe('/s/mall-e2e/orders?state=paid');
  await expect(page.getByRole('heading', { level: 2, name: '统一账号认证' })).toBeVisible();
  await expect.poll(() => api.calls.some((call) => call.path === '/api/v1/identity/providers' && new URLSearchParams(call.query).get('returnpath') === '/s/mall-e2e/orders?state=paid')).toBe(true);
  await page.getByLabel('登录账号或已绑定手机号').fill('e2e-user');
  await page.getByLabel('密码', { exact: true }).fill('correct-horse');
  await page.getByRole('checkbox', { name: /我已阅读并同意/ }).check();
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL('http://127.0.0.1:3000/s/mall-e2e/orders?state=paid');
  expect(api.calls.find((call) => call.path === '/api/v1/identity/sessions')?.body).toMatchObject({ returnTarget: signedTarget });
  expect(api.calls.find((call) => call.path === '/api/v1/identity/tickets/exchange')?.body).toMatchObject({ returnTarget: signedTarget });
  await expect.poll(() => bootstraps).toBeGreaterThanOrEqual(2);
  expect(api.unmatched).toEqual([]);
});

function decodeRenderedQr(svg: Readonly<{ viewBox: string | null; path: string | null }>): string | undefined {
  const extent = Number(svg.viewBox?.split(/\s+/)[3]);
  if (!Number.isSafeInteger(extent) || extent < 1 || !svg.path) return undefined;
  const dark = new Set([...svg.path.matchAll(/M(\d+) (\d+)h1v1h-1z/g)].map((match) => `${match[1]}:${match[2]}`));
  const scale = 8;
  const width = extent * scale;
  const pixels = new Uint8ClampedArray(width * width * 4);
  for (let y = 0; y < width; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = dark.has(`${Math.floor(x / scale)}:${Math.floor(y / scale)}`) ? 0 : 255;
      const offset = (y * width + x) * 4;
      pixels.fill(color, offset, offset + 3);
      pixels[offset + 3] = 255;
    }
  }
  return jsQR(pixels, width, width, { inversionAttempts: 'dontInvert' })?.data;
}

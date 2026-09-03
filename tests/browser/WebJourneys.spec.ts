import { expect, test } from '@playwright/test';
import { LOCAL_API_ORIGIN, LOCAL_AUTH_ORIGIN } from '@shop/config/client';
import { expectWcagAA } from './Accessibility';
import { createConsoleMock } from './ConsoleMock';
import { cockpit, consoleSession, identityBootstrap, storefrontBootstrap, storefrontCatalog } from './Fixtures';
import { OperationMock } from './OperationMock';
import jsQR from 'jsqr';

test('Auth 登录深链保留 PKCE 边界并满足 WCAG A/AA', async ({ page }) => {
  const signedTarget = `proof.${'a'.repeat(64)}`;
  const api = new OperationMock(page)
    .get('/api/v1/identity/bootstrap', identityBootstrap('console', signedTarget))
    .get('/api/v1/identity/providers', { items: [] })
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
        memberships: [{ id: 'membership:e2e', target: 'console', displayName: '验收管理员', organizationName: '测试集团', scopeKind: 'enterprise', scopeId: 'enterprise:e2e', roleLabel: '运营会员', logoUrl: null }],
      };
    });
  await api.install();

  await page.goto(`${LOCAL_AUTH_ORIGIN}/?target=console`);
  await expect(page.getByRole('heading', { level: 1, name: '企业福利 全新定义' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: '统一账号认证' })).toBeVisible();
  await expect(page).toHaveTitle('统一登录｜智慧翼企业福利商城');
  await expect(page.getByRole('tablist', { name: '登录方式' })).toContainText('密码登录验证码登录邀请码登录');
  await expect(page.getByRole('button', { name: '忘记密码？' })).toBeVisible();

  await page.getByLabel('登录账号或已绑定手机号').fill('e2e-user');
  await page.getByLabel('密码', { exact: true }).fill('correct-horse');
  await page.getByRole('checkbox', { name: /我已阅读并同意/ }).check();
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2, name: '完成身份验证' })).toBeVisible();
  await expect(page.getByRole('button', { name: /测试集团/ })).toContainText('运营会员 · 运营后台');
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
    .get('/api/v1/identity/bootstrap', identityBootstrap('storefront', signedTarget))
    .get('/api/v1/identity/providers', { items: [] })
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
    .get('/api/v1/orders', { items: [], count: 0 })
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
  await expect.poll(() => api.calls.some((call) => call.path === '/api/v1/identity/bootstrap' && new URLSearchParams(call.query).get('returnpath') === '/s/mall-e2e/orders?state=paid')).toBe(true);
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

test('管理员创建员工邀请后只获得一次性安全回执', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://127.0.0.1:4173' });
  const session = {
    ...consoleSession,
    scopes: [...consoleSession.scopes, { kind: 'mall', id: 'mall:e2e', name: '验收商城', path: [{ kind: 'enterprise', id: 'enterprise:e2e' }, { kind: 'mall', id: 'mall:e2e' }] }],
    csrf: 'csrf-token-for-e2e',
    permissions: [...consoleSession.permissions, 'access.center.read', 'identity.invitation.issue', 'identity.invitation.read', 'identity.invitation.revoke'],
    capabilities: [...consoleSession.capabilities, 'access.center.read', 'identity.invitations.create', 'identity.invitations.read', 'identity.invitations.revoke'],
    assurance: { level: 2, verified: 'otp' },
  };
  const code = 'ABCD EFGH JKMN PQRS TVWX YZ12 3456 7890';
  const api = createConsoleMock(page, session)
    .get('/api/v1/identity/invitations', { items: [], count: 0 })
    .get('/api/v1/access/center', { items: [], count: 0 })
    .post('/api/v1/identity/invitations', (call) => {
      expect(call.headers['idempotency-key']).toBeTruthy();
      expect(call.headers['if-match']).toBe('"1"');
      expect(call.headers['x-scope-hint']).toBe('enterprise:e2e');
      expect(call.body).toMatchObject({
        kind: 'enrollment',
        target: 'storefront',
        organizationId: 'mall:e2e',
        employee: { displayName: '验收员工', mobile: '+8613800138000', employeeNo: 'E2E002' },
        reason: '福利商城入职邀请',
      });
      expect(call.body).not.toHaveProperty('roleId');
      expect(call.body).not.toHaveProperty('permission');
      return { id: 'invitation:e2e', kind: 'enrollment', target: 'storefront', organizationId: 'mall:e2e', maxUses: 1, useCount: 0, expiresAt: '2099-01-01T00:00:00.000Z', status: 'active', version: 1, code, recipientMasked: '+86138****8000', employee: { displayName: '验收员工', employeeNo: 'E2E002' } };
    }, 201);
  await api.install();

  await page.goto('http://127.0.0.1:4173/scopes/enterprise/enterprise%3Ae2e/settings/invitations');
  await expect(page.getByRole('heading', { level: 1, name: '员工邀请' })).toBeFocused();
  await page.getByRole('button', { name: '邀请员工' }).click();
  const form = page.getByRole('form', { name: '员工邀请' });
  await expect(form.getByLabel('姓名')).toBeFocused();
  await form.getByLabel('姓名').fill('验收员工');
  await form.getByLabel('手机号').fill('+8613800138000');
  await form.getByLabel('工号（选填）').fill('E2E002');
  await form.getByLabel('邀请原因').fill('福利商城入职邀请');
  await form.getByRole('button', { name: '创建员工邀请' }).click();

  const receipt = page.getByRole('dialog', { name: '邀请码已创建' });
  await expect(receipt.getByLabel('一次性邀请码')).toHaveText(code);
  await receipt.getByRole('button', { name: '复制邀请码' }).click();
  await expect(receipt.getByRole('button', { name: '已复制邀请码' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);
  await receipt.getByRole('button', { name: '完成并关闭' }).click();
  await page.getByRole('button', { name: '关闭并清除' }).click();
  await expect(receipt).toBeHidden();
  expect(api.calls.filter((call) => call.path === '/api/v1/identity/invitations' && call.method === 'GET').length).toBeGreaterThanOrEqual(2);
  expect(api.unmatched).toEqual([]);
  await expectWcagAA(page);
});

test('受邀员工以绑定手机号完成 OTP 与密码注册且不能改写身份', async ({ page }) => {
  const signedTarget = `proof.${'b'.repeat(64)}`;
  const termsHash = 'c'.repeat(64);
  const api = new OperationMock(page)
    .get('/api/v1/identity/bootstrap', identityBootstrap('storefront', signedTarget, termsHash))
    .get('/api/v1/identity/providers', { items: [] })
    .post('/api/v1/identity/invitations/resolve', (call) => {
      expect(call.body).toMatchObject({ code: 'ABCD EFGH JKMN PQRS TVWX YZ12 3456 7890', target: 'storefront', returnTarget: signedTarget, authorization: { state: expect.any(String), nonce: expect.any(String), challenge: expect.any(String) } });
      return { kind: 'enrollment', enrollment: { id: 'claim:e2e', expiresAt: '2099-01-01T00:00:00.000Z', target: 'storefront' } };
    })
    .get('/api/v1/identity/enrollments/claim%3Ae2e', { id: 'claim:e2e', kind: 'enrollment', target: 'storefront', expiresAt: '2099-01-01T00:00:00.000Z', subjectMode: 'bound', organization: { id: 'enterprise:e2e', name: '测试集团' }, recipientMasked: '+86138****8000', employee: { displayName: '验收员工', employeeNo: 'E2E002' }, policy: { terms_title: '员工商城服务协议', terms_body: '服务协议正文', privacy_title: '隐私保护政策', privacy_body: '隐私政策正文', terms_hash: termsHash } })
    .post('/api/v1/identity/challenges', (call) => {
      expect(call.body).toEqual({ purpose: 'enrollment', enrollmentId: 'claim:e2e' });
      return { id: 'challenge:e2e', purpose: 'enrollment', expires_at: '2099-01-01T00:00:00.000Z', retry_at: '2098-01-01T00:00:00.000Z' };
    }, 201)
    .post('/api/v1/identity/enrollments/claim%3Ae2e/complete', (call) => {
      expect(call.body).toMatchObject({ mode: 'bound', challenge: 'challenge:e2e', code: '123456', password: 'SecurePassword1!', displayName: '验收员工', termsAccepted: true, termsHash, authorization: { state: expect.any(String), nonce: expect.any(String), challenge: expect.any(String) } });
      expect(call.body).not.toHaveProperty('subject');
      return { kind: 'enrolled', target: 'storefront' };
    }, 201);
  await api.install();

  await page.goto(`${LOCAL_AUTH_ORIGIN}/invitation?target=storefront`);
  await page.getByLabel('企业邀请码').fill('ABCD EFGH JKMN PQRS TVWX YZ12 3456 7890');
  await page.getByRole('checkbox', { name: /我已阅读并同意/ }).check();
  await page.getByRole('button', { name: '使用邀请码登录' }).click();

  const enrollment = page.getByRole('dialog', { name: '注册员工商城账号' });
  await expect(enrollment.getByLabel('姓名')).toHaveValue('验收员工');
  await expect(enrollment.getByLabel('姓名')).toHaveAttribute('readonly', '');
  await expect(enrollment.getByText('+86138****8000')).toBeVisible();
  await expect(enrollment.getByLabel('登录手机号')).toHaveCount(0);
  await enrollment.getByRole('button', { name: '获取验证码' }).click();
  await enrollment.getByLabel('手机验证码').fill('123456');
  await enrollment.getByLabel('设置密码').fill('SecurePassword1!');
  await enrollment.getByLabel('确认密码').fill('SecurePassword1!');
  await enrollment.getByRole('checkbox', { name: /我已阅读并同意/ }).check();
  await enrollment.getByRole('button', { name: '创建普通员工账号' }).click();

  await expect(enrollment).toBeHidden();
  await expect(page.getByRole('status')).toContainText('员工商城账号已创建');
  expect(api.unmatched).toEqual([]);
  await expectWcagAA(page);
});

test('客服在三栏工作台读取用户消息并以版本保护回复', async ({ page }) => {
  const session = {
    ...consoleSession,
    csrf: 'csrf-token-for-e2e',
    permissions: [...consoleSession.permissions, 'support.case.read', 'support.message.read', 'support.message.send', 'support.event.read', 'support.readstate.manage', 'support.agent.read'],
    capabilities: [...consoleSession.capabilities, 'support.cases.read', 'support.messages.read', 'support.messages.send', 'support.events.read', 'support.readstates.manage', 'support.agents.read'],
    assurance: { level: 2, verified: 'otp' },
  };
  const ticket = {
    id: 'case:e2e', scope_id: 'enterprise:e2e', priority: 'high', state: 'assigned', assigned_agent_id: 'agent:e2e',
    response_due_at: '2099-01-01T01:00:00.000Z', resolution_due_at: '2099-01-02T00:00:00.000Z', created_at: '2026-09-02T00:00:00.000Z', updated_at: '2026-09-02T00:01:00.000Z',
    version: 3, conversation_id: 'conversation:e2e', skill: 'general', member_id: 'member:customer', order_id: null, channel: 'inapp', subject: '报销权益无法使用', reference_type: null, reference_id: null, unread_count: 1, sla_risk: 'risk',
  } as const;
  const messages = [{ id: 'message:customer', clientMessageId: 'client:customer', conversationId: 'conversation:e2e', authorType: 'member', authorId: 'member:customer', body: '页面提示权益不可用，请帮忙查看。', sequence: 1, version: 1, createdAt: '2026-09-02T00:01:00.000Z' }];
  const conversation = () => ({ items: [...messages], attachments: [], count: messages.length, conversationVersion: messages.length, latestSequence: messages.length, lastReadSequence: 0, context: { member: { id: 'member:customer', displayName: '张小翼', employeeNo: 'E10086', mobileMasked: '138****8000' }, organization: { id: 'enterprise:e2e' }, orders: [], benefits: [] } });
  const api = createConsoleMock(page, session)
    .get('/api/v1/support/cases', { items: [ticket], count: 1 })
    .get('/api/v1/support/agents', { items: [], count: 0 })
    .get('/api/v1/support/events', {})
    .get('/api/v1/support/cases/case%3Ae2e/messages', conversation)
    .put('/api/v1/support/conversations/conversation%3Ae2e/readstate', { conversationId: 'conversation:e2e', lastSequence: 1, version: 1 })
    .post('/api/v1/support/cases/case%3Ae2e/messages', (call) => {
      expect(call.headers['if-match']).toBe('"3"');
      expect(call.headers['idempotency-key']).toBeTruthy();
      expect(call.body).toMatchObject({ message: '已为你核对，权益现已恢复，请重新进入页面。', clientMessageId: expect.any(String) });
      expect(call.body).not.toHaveProperty('expectedVersion');
      const reply = { id: 'message:agent', clientMessageId: (call.body as { clientMessageId: string }).clientMessageId, conversationId: 'conversation:e2e', authorType: 'agent' as const, authorId: 'actor:console:e2e', body: '已为你核对，权益现已恢复，请重新进入页面。', sequence: 2, version: 1, createdAt: '2026-09-02T00:02:00.000Z' };
      messages.push(reply);
      return { message: reply, ticket: { id: 'case:e2e', state: 'waiting', version: 4 }, conversationVersion: 2 };
    }, 201);
  await api.install();

  await page.goto('http://127.0.0.1:4173/scopes/enterprise/enterprise%3Ae2e/support');
  await expect(page.getByRole('heading', { level: 1, name: '客服中心' })).toBeFocused();
  await expect(page.getByRole('link', { name: /报销权益无法使用/ })).toBeVisible();
  await page.getByRole('link', { name: /报销权益无法使用/ }).click();
  await expect(page.getByRole('log')).toContainText('页面提示权益不可用，请帮忙查看。');
  await page.getByLabel('回复内容').fill('已为你核对，权益现已恢复，请重新进入页面。');
  await page.getByRole('button', { name: '发送回复' }).click();
  await expect(page.getByRole('log')).toContainText('已为你核对，权益现已恢复，请重新进入页面。');
  expect(api.unmatched).toEqual([]);
  await expectWcagAA(page);
});

test('员工在商城建单后通过实时事件收到客服回复并推进已读状态', async ({ page }) => {
  const authenticated = {
    ...storefrontBootstrap,
    identity: {
      ...storefrontBootstrap.identity,
      version: '1',
      data: { state: 'member', member: { id: 'member:e2e', displayName: '验收员工' }, membership: 'membership:e2e', csrf: 'csrf-token-for-storefront-e2e' },
    },
  } as const;
  const ticket = {
    id: 'case:storefront:e2e', scope_id: 'mall:e2e', priority: 'high', state: 'open', assigned_agent_id: null,
    response_due_at: '2099-01-01T01:00:00.000Z', resolution_due_at: '2099-01-02T00:00:00.000Z', created_at: '2026-09-02T00:00:00.000Z', updated_at: '2026-09-02T00:00:00.000Z',
    version: 1, conversation_id: 'conversation:storefront:e2e', skill: 'general', member_id: 'member:e2e', order_id: null, channel: 'inapp', subject: '福利账户余额未更新',
  } as const;
  const memberMessage = { id: 'message:member:e2e', clientMessageId: 'client:member:e2e', conversationId: ticket.conversation_id, authorType: 'member' as const, authorId: 'member:e2e', body: '兑换完成后余额仍未更新，请协助核对。', sequence: 1, version: 1, createdAt: '2026-09-02T00:00:00.000Z' };
  const agentMessage = { id: 'message:agent:e2e', clientMessageId: 'client:agent:e2e', conversationId: ticket.conversation_id, authorType: 'agent' as const, authorId: 'agent:e2e', body: '已经核对并完成同步，请刷新福利账户查看。', sequence: 2, version: 1, createdAt: '2026-09-02T00:01:00.000Z' };
  let created = false;
  let agentVisible = false;
  let conversationReads = 0;
  let readVersion = 0;
  const cases = () => ({ items: created ? [{ ...ticket, reference_type: null, reference_id: null, unread_count: agentVisible ? 1 : 0, sla_risk: 'normal' }] : [], count: created ? 1 : 0 });
  const conversation = () => {
    conversationReads += 1;
    const items = agentVisible ? [memberMessage, agentMessage] : [memberMessage];
    return { items, attachments: [], count: items.length, conversationVersion: items.length, latestSequence: items.length, lastReadSequence: 0, context: { member: { id: 'member:e2e', displayName: '验收员工', employeeNo: 'E2E002', mobileMasked: '138****8000' }, organization: { id: 'mall:e2e' }, orders: [], benefits: [] } };
  };
  const api = new OperationMock(page)
    .get('/api/v1/storefront/bootstrap', authenticated)
    .get('/api/v1/identity/memberships', { items: [], count: 0 })
    .get('/api/v1/benefits/accounts', { items: [], count: 0 })
    .get('/api/v1/members/me/addresses', { items: [], count: 0 })
    .get('/api/v1/members/me/favorites', { items: [], count: 0 })
    .get('/api/v1/members/me', { id: 'member:e2e', display_name: '验收员工', status: 'active', mobile_bound: true, membership_id: 'membership:e2e', organization_id: 'mall:e2e', employee_no: 'E2E002', joined_at: '2026-09-02T00:00:00.000Z', access_version: 1 })
    .get('/api/v1/carts/current', { version: 0, items: [] })
    .get('/api/v1/support/cases', cases)
    .post('/api/v1/support/cases', (call) => {
      expect(call.headers['idempotency-key']).toBeTruthy();
      expect(call.headers['x-csrf-token']).toBe('csrf-token-for-storefront-e2e');
      expect(call.body).toEqual({ subject: ticket.subject, message: memberMessage.body, priority: 'high', channel: 'inapp' });
      created = true;
      return ticket;
    }, 201)
    .get('/api/v1/support/cases/case%3Astorefront%3Ae2e/messages', conversation)
    .put('/api/v1/support/conversations/conversation%3Astorefront%3Ae2e/readstate', (call) => {
      const lastSequence = Number((call.body as { lastSequence: number }).lastSequence);
      readVersion += 1;
      return { conversationId: ticket.conversation_id, lastSequence, version: readVersion };
    })
    .stream('/api/v1/support/events', async (call) => {
      expect(new URLSearchParams(call.query).get('conversationId')).toBe(ticket.conversation_id);
      await expect.poll(() => conversationReads).toBeGreaterThan(0);
      agentVisible = true;
      return `id: 1740-0\nevent: support.message.sent\ndata: ${JSON.stringify({ id: 'event:reply:e2e', type: 'support.message.sent', scopeId: 'mall:e2e', ticketId: ticket.id, conversationId: ticket.conversation_id, messageId: agentMessage.id, sequence: 2, version: 2, occurredAt: '2026-09-02T00:01:00.000Z' })}\n\n`;
    });
  await api.install();

  await page.goto('http://127.0.0.1:3000/s/mall-e2e/support');
  await expect(page.getByRole('heading', { level: 1, name: '客服中心' })).toBeVisible();
  await page.getByLabel('问题标题').fill(ticket.subject);
  await page.getByLabel('优先级').selectOption('high');
  await page.getByLabel('详细描述').fill(memberMessage.body);
  await page.getByRole('button', { name: '提交工单' }).click();
  await expect(page).toHaveURL(/\/support\/case%3Astorefront%3Ae2e$/i);
  await expect(page.getByRole('region', { name: '工单消息' })).toContainText(memberMessage.body);
  await expect(page.getByRole('region', { name: '工单消息' })).toContainText(agentMessage.body);
  await expect.poll(() => api.calls.filter((call) => call.path.endsWith('/messages')).length).toBeGreaterThanOrEqual(2);
  await expect.poll(() => api.calls.some((call) => call.method === 'PUT' && (call.body as { lastSequence?: number }).lastSequence === 2)).toBe(true);
  expect(api.unmatched).toEqual([]);
  await expectWcagAA(page);
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

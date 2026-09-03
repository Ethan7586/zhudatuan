import { expect, test, type Page } from '@playwright/test';
import { LOCAL_AUTH_ORIGIN } from '@shop/config/client';
import { expectWcagAA } from './Accessibility';
import { apiFailure, identityBootstrap } from './Fixtures';
import { OperationMock } from './OperationMock';

const RETURN_TARGET = `proof.${'e'.repeat(64)}`;
const INVITATION = 'ABCD EFGH JKMN PQRS TVWX YZ12 3456 7890';

for (const scenario of [
  { title: '密码错误', code: 'CREDENTIAL_INVALID', status: 401, retryable: false },
  { title: '密码限流', code: 'RATE_LIMITED', status: 429, retryable: true },
] as const) {
  test(`${scenario.title}保留账号但清除密码并展示可追踪安全错误`, async ({ page }) => {
    const api = authApi(page).post('/api/v1/identity/sessions', apiFailure(scenario.code, `request:${scenario.code}`, scenario.retryable, scenario.retryable ? 60 : undefined), scenario.status);
    await api.install();
    await page.goto(`${LOCAL_AUTH_ORIGIN}/?target=storefront`);
    await password(page);
    await expect(page.getByRole('alert')).toContainText(`request:${scenario.code}`);
    await expect(page.getByLabel('登录账号或已绑定手机号')).toHaveValue('employee:e2e');
    await expect(page.getByLabel('密码', { exact: true })).toHaveValue('');
    expect(api.calls.filter(({ path }) => path === '/api/v1/identity/sessions')).toHaveLength(1);
  });
}

test('验证码登录使用服务端倒计时、合并双击并携带 challenge', async ({ page }) => {
  const api = authApi(page)
    .post('/api/v1/identity/challenges', { id: 'challenge:e2e', purpose: 'login', expires_at: '2099-01-01T00:00:00.000Z', retry_at: '2098-01-01T00:00:00.000Z' }, 201)
    .post('/api/v1/identity/sessions', selection('storefront'));
  await api.install();
  await page.goto(`${LOCAL_AUTH_ORIGIN}/?target=storefront`);
  const passwordTab = page.getByRole('tab', { name: '密码登录' });
  await passwordTab.focus();
  await passwordTab.press('ArrowRight');
  await expect(page.getByRole('tab', { name: '验证码登录' })).toBeFocused();
  await page.getByLabel('登录账号或已绑定手机号').fill('13800000000');
  await page.getByRole('button', { name: '获取验证码' }).dblclick();
  await expect(page.getByRole('button', { name: /后重发/ })).toBeDisabled();
  expect(api.calls.filter(({ path }) => path === '/api/v1/identity/challenges')).toHaveLength(1);
  await page.getByLabel('短信验证码').fill('123456');
  await page.getByRole('checkbox', { name: /我已阅读并同意/ }).check();
  await page.getByRole('button', { name: '登录', exact: true }).click();
  expect(api.calls.find(({ path }) => path === '/api/v1/identity/sessions')?.body).toMatchObject({ method: 'otp', challenge: 'challenge:e2e', code: '123456' });
  await expect(page.getByRole('heading', { name: '完成身份验证' })).toBeVisible();
});

test('错误或过期验证码统一为安全提示且允许重新获取', async ({ page }) => {
  const api = authApi(page)
    .post('/api/v1/identity/challenges', { id: 'challenge:e2e', purpose: 'login', expires_at: '2099-01-01T00:00:00.000Z', retry_at: '2098-01-01T00:00:00.000Z' }, 201)
    .post('/api/v1/identity/sessions', apiFailure('CHALLENGE_INVALID', 'request:challenge'), 400);
  await api.install();
  await page.goto(`${LOCAL_AUTH_ORIGIN}/?target=storefront`);
  await page.getByRole('tab', { name: '验证码登录' }).click();
  await page.getByLabel('登录账号或已绑定手机号').fill('13800000000');
  await page.getByRole('button', { name: '获取验证码' }).click();
  await page.getByLabel('短信验证码').fill('000000');
  await page.getByRole('checkbox', { name: /我已阅读并同意/ }).check();
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('验证码无效或已过期');
  await expect(page.getByLabel('短信验证码')).toHaveValue('');
});

test('邀请码直接登录且秘密不进入 URL、存储或控制台', async ({ page }) => {
  const logs: string[] = [];
  page.on('console', (message) => logs.push(message.text()));
  const api = authApi(page)
    .post('/api/v1/identity/invitations/resolve', { kind: 'session', ticket: 't'.repeat(64), returnTarget: RETURN_TARGET }, 201)
    .post('/api/v1/identity/tickets/exchange', {
      returnTarget: { url: 'http://127.0.0.1:3000/s/mall-e2e', proof: RETURN_TARGET, expiresAt: '2099-01-01T00:00:00.000Z', target: 'storefront' },
      expiresIn: 3600,
    });
  await api.install();
  await page.goto(`${LOCAL_AUTH_ORIGIN}/invitation?target=storefront`);
  await page.getByLabel('企业邀请码').fill(INVITATION);
  await page.getByRole('checkbox', { name: /我已阅读并同意/ }).check();
  await page.getByRole('button', { name: '使用邀请码登录' }).dblclick();
  await expect(page).toHaveURL('http://127.0.0.1:3000/s/mall-e2e');
  expect(api.calls.filter(({ path }) => path === '/api/v1/identity/invitations/resolve')).toHaveLength(1);
  expect(api.calls.filter(({ path }) => path === '/api/v1/identity/tickets/exchange')).toHaveLength(1);
  expect(await browserSecrets(page)).not.toContain(INVITATION);
  expect(logs.join('\n')).not.toContain(INVITATION);
});

test('无效、过期和已消费邀请码使用同一外部语义', async ({ page }) => {
  const api = authApi(page).post('/api/v1/identity/invitations/resolve', apiFailure('INVITATION_INVALID', 'request:invitation'), 400);
  await api.install();
  await page.goto(`${LOCAL_AUTH_ORIGIN}/invitation?target=storefront`);
  await page.getByLabel('企业邀请码').fill(INVITATION);
  await page.getByRole('checkbox', { name: /我已阅读并同意/ }).check();
  await page.getByRole('button', { name: '使用邀请码登录' }).click();
  await expect(page.getByRole('alert')).toContainText('邀请码无效、已过期或暂不可用');
  await expect(page.getByLabel('企业邀请码')).toHaveValue('');
});

test('Provider 故障局部降级且不阻断密码登录', async ({ page }) => {
  const api = new OperationMock(page)
    .get('/api/v1/identity/bootstrap', identityBootstrap('storefront', RETURN_TARGET))
    .get('/api/v1/identity/providers', apiFailure('IDENTITY_PROVIDER_CONFIGURATION_INVALID', 'request:provider'), 422)
    .post('/api/v1/identity/sessions', selection('storefront'));
  await api.install();
  await page.goto(`${LOCAL_AUTH_ORIGIN}/?target=storefront`);
  await expect(page.locator('.authproviders').getByRole('alert')).toContainText('request:provider');
  await password(page);
  await expect(page.getByRole('heading', { name: '完成身份验证' })).toBeVisible();
});

test('Federation start 携带唯一 PKCE 三元组并只跳往 HTTPS Provider', async ({ page }) => {
  const api = new OperationMock(page)
    .get('/api/v1/identity/bootstrap', identityBootstrap('console', RETURN_TARGET))
    .get('/api/v1/identity/providers', { items: [{ id: 'provider:e2e', type: 'oidc', status: 'enabled' }] })
    .post('/api/v1/identity/federations', { location: 'https://idp.example.test/authorize' }, 201);
  await page.route('https://idp.example.test/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Identity Provider</title>' }));
  await api.install();
  await page.goto(`${LOCAL_AUTH_ORIGIN}/?target=console`);
  await page.getByRole('checkbox', { name: /我已阅读并同意/ }).check();
  await page.getByRole('button', { name: '企业单点登录' }).click();
  await expect(page).toHaveURL('https://idp.example.test/authorize');
  expect(api.calls.find(({ path }) => path === '/api/v1/identity/federations')?.body).toMatchObject({ providerid: 'provider:e2e', returntarget: RETURN_TARGET, authorization: { state: expect.any(String), nonce: expect.any(String), challenge: expect.any(String) } });
});

test('独立身份选择重新读取丰富身份并提交一次选择', async ({ page }) => {
  const candidate = selection('console');
  const api = new OperationMock(page)
    .get('/api/v1/identity/federations/selection', { memberships: candidate.memberships, expiresAt: '2099-01-01T00:00:00.000Z', target: 'console' })
    .get('/api/v1/identity/bootstrap', identityBootstrap('console', RETURN_TARGET))
    .post('/api/v1/identity/federations/selection', { location: 'http://127.0.0.1:4173/scopes/enterprise/enterprise%3Ae2e/cockpit' });
  await api.install();
  await page.goto(`${LOCAL_AUTH_ORIGIN}/membership?target=console&state=opaque`);
  const identity = page.getByRole('button', { name: /测试集团/ });
  await expect(identity).toContainText('验收管理员');
  await expect(identity).toContainText('运营管理员 · 运营后台');
  await identity.dblclick();
  await expect(page).toHaveURL(/127\.0\.0\.1:4173\/scopes/);
  expect(api.calls.filter(({ path, method }) => path === '/api/v1/identity/federations/selection' && method === 'POST')).toHaveLength(1);
});

test('密码找回使用存在性安全提示、清除秘密并关闭对话框', async ({ page }) => {
  const api = authApi(page)
    .post('/api/v1/identity/challenges', { id: 'challenge:reset', purpose: 'password_reset', expires_at: '2099-01-01T00:00:00.000Z', retry_at: '2098-01-01T00:00:00.000Z' }, 201)
    .post('/api/v1/identity/password/reset', { credentialVersion: 2, version: 2 });
  await api.install();
  await page.goto(`${LOCAL_AUTH_ORIGIN}/?target=storefront`);
  await page.getByRole('button', { name: '忘记密码？' }).click();
  const dialog = page.getByRole('dialog', { name: '找回密码' });
  await expect(dialog.getByLabel('登录账号或已绑定手机号')).toBeFocused();
  await dialog.getByLabel('登录账号或已绑定手机号').fill('unknown@example.test');
  await dialog.getByRole('button', { name: '获取验证码' }).click();
  await expect(dialog.getByRole('status')).toContainText('无论账号是否存在均显示相同结果');
  await dialog.getByLabel('短信验证码').fill('123456');
  await dialog.getByLabel('新密码', { exact: true }).fill('SecurePassword1!');
  await dialog.getByLabel('确认新密码', { exact: true }).fill('SecurePassword1!');
  await dialog.getByRole('button', { name: '重置密码并下线全部设备' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('status')).toContainText('所有旧会话已撤销');
  expect(await browserSecrets(page)).not.toContain('SecurePassword1!');
});

test('路由拒绝参数污染并在全视口、减弱动画和键盘模式下可用', async ({ page }) => {
  await page.goto(`${LOCAL_AUTH_ORIGIN}/?target=storefront&target=console`);
  await expect(page.getByRole('heading', { name: '链接不可用' })).toBeVisible();
  const api = authApi(page);
  await api.install();
  await page.goto(`${LOCAL_AUTH_ORIGIN}/?target=storefront`);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [320, 768, 1366, 1440]) {
    await page.setViewportSize({ width, height: width === 320 ? 720 : 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
  const storefront = page.getByRole('radio', { name: /员工商城/ });
  await storefront.focus();
  await storefront.press('ArrowRight');
  await expect(page).toHaveURL(/target=console/);
  await expect(page.getByRole('radio', { name: /运营控制台/ })).toBeFocused();
  await expectWcagAA(page);
});

function authApi(page: Page) {
  return new OperationMock(page)
    .get('/api/v1/identity/bootstrap', (call) => identityBootstrap(call.headers['x-client-target'] === 'console' ? 'console' : 'storefront', RETURN_TARGET))
    .get('/api/v1/identity/providers', { items: [] });
}

function selection(target: 'console' | 'storefront') {
  return { kind: 'selection', transaction: 'selection:e2e', memberships: [{ id: 'membership:e2e', target, displayName: target === 'console' ? '验收管理员' : '验收员工', organizationName: '测试集团', scopeKind: 'enterprise', scopeId: 'enterprise:e2e', roleLabel: target === 'console' ? '运营管理员' : '员工', logoUrl: null }] };
}

async function password(page: Page): Promise<void> {
  await page.getByLabel('登录账号或已绑定手机号').fill('employee:e2e');
  await page.getByLabel('密码', { exact: true }).fill('SecurePassword1!');
  await page.getByRole('checkbox', { name: /我已阅读并同意/ }).check();
  await page.getByRole('button', { name: '登录', exact: true }).click();
}

async function browserSecrets(page: Page): Promise<string> {
  return page.evaluate(() => `${location.href}\n${JSON.stringify(localStorage)}\n${JSON.stringify(sessionStorage)}`);
}

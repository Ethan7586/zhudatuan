import { expect, test, type Page } from '@playwright/test';
import { PERMISSION_CATALOG } from '@shop/authz';
import { consoleSession } from './Fixtures';
import { OperationMock, type OperationCall } from './OperationMock';

const consoleOrigin = process.env.IAM002_CONSOLE_ORIGIN ?? 'http://127.0.0.1:4173';
const screenshotDirectory = process.env.IAM002_SCREENSHOT_DIRECTORY;
const permissions = ['finance.overview.read', 'order.read', 'catalog.product.manage'];

test('IAM-002 自定义身份创建、正式回读与响应式工作台', async ({ page }) => {
  const browserErrors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') browserErrors.push(message.text()); });
  page.on('pageerror', (error) => browserErrors.push(error.message));
  const roles = initialRoles();
  const api = accessApi(page, roles);
  await api.install();

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${consoleOrigin}/scopes/tenant/tenant%3Ae2e/settings/access`);

  await expect(page.getByRole('heading', { level: 1, name: '会员与权限' })).toBeFocused();
  await expect(page.getByRole('navigation', { name: '会员与权限工作台' })).toContainText('成员身份与权限邀请记录');
  await expect(page.getByRole('heading', { name: '治理身份' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '自定义业务身份' })).toBeVisible();
  await expect(page.getByText('平台 Owner', { exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(PERMISSION_CATALOG.length);
  await expectNoHorizontalOverflow(page);
  await screenshot(page, 'iam-002-1440.png');

  await page.getByRole('button', { name: '＋ 新建自定义身份' }).click();
  await page.getByPlaceholder('例如：财务').fill('财务');
  await expect(page.getByRole('checkbox', { checked: true })).toHaveCount(0);
  for (const permission of permissions) await page.getByRole('checkbox', { name: new RegExp(permission.replaceAll('.', '\\.')) }).check();
  await page.getByRole('button', { name: '保存身份' }).click();
  await expect(page.getByText(/“财务”已保存，并已通过正式接口重读核对名称、权限与版本 v0/)).toBeVisible();

  const write = api.calls.find((call) => call.method === 'PUT' && call.path.startsWith('/api/v1/access/roles/'));
  expect(write?.body).toEqual({ name: '财务', permissions });
  expect(write?.headers['if-match']).toBeUndefined();
  const writeIndex = api.calls.findIndex((call) => call === write);
  expect(api.calls.slice(writeIndex + 1).some((call) => call.path === '/api/v1/access/center')).toBe(true);

  await page.setViewportSize({ width: 1314, height: 1000 });
  await expectNoHorizontalOverflow(page);
  await page.setViewportSize({ width: 1024, height: 900 });
  await expectNoHorizontalOverflow(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoHorizontalOverflow(page);
  await expect.poll(() => page.locator('.consolesidebar').evaluate((sidebar) => sidebar.getBoundingClientRect().right <= 0)).toBe(true);
  await expectCoreContentWithinViewport(page);
  await expect(page.getByRole('button', { name: '保存身份' })).toBeVisible();
  await screenshot(page, 'iam-002-mobile.png');

  await page.getByRole('button', { name: '邀请记录' }).click();
  await expect(page.getByText(/尚未提供邀请记录列表读取/)).toBeVisible();
  await expect(page.getByText(/不会用模拟记录伪造闭环/)).toBeVisible();
  await page.getByRole('button', { name: '成员' }).click();
  await expect(page.getByRole('heading', { name: '会员与权限控制中心' })).toBeVisible();

  const copy = await page.locator('body').innerText();
  expect(copy).not.toMatch(/Smart Wing|智慧翼|築店|租户/);
  expect(api.unmatched).toEqual([]);
  expect(browserErrors).toEqual([]);
});

function accessApi(page: Page, roles: WireRole[]): OperationMock {
  return new OperationMock(page)
    .get('/api/v1/identity/session', {
      ...consoleSession,
      scope: { kind: 'tenant', id: 'tenant:e2e', tenant: 'tenant:e2e', name: '主打团商户' },
      scopes: [{ kind: 'tenant', id: 'tenant:e2e', tenant: 'tenant:e2e', name: '主打团商户' }],
      permissions: ['access.center.read', 'access.role.manage', 'member.read'],
      capabilities: ['access.center.read', 'access.roles.manage', 'member.members.read'],
      csrf: 'csrf:e2e:iam002:token', assurance: { level: 2, verified: 'password' },
    })
    .get('/api/v1/members/me', { display_name: 'Ethan', employee_no: 'OWNER001' })
    .get('/api/v1/access/center', () => ({ items: [], count: 0, roles }))
    .get('/api/v1/members', { items: [], count: 0 })
    .put('/api/v1/access/roles/:roleid', (call) => saveRole(call, roles));
}

function saveRole(call: OperationCall, roles: WireRole[]) {
  const body = call.body as { name: string; permissions: string[] };
  const id = decodeURIComponent(call.path.slice('/api/v1/access/roles/'.length));
  const current = roles.find((role) => role.id === id);
  const role = { id, name: body.name, status: 'active' as const, version: String(current === undefined ? 0 : Number(current.version) + 1),
    permissions: body.permissions, member_count: current?.member_count ?? '0', governance: false, editable: true };
  roles.splice(0, roles.length, ...roles.filter((candidate) => candidate.id !== id), role);
  return role;
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

async function expectCoreContentWithinViewport(page: Page) {
  const clipped = await page.locator([
    '.roleaccessworkspace',
    '.roleaccessmasterdetail',
    '.swmasterdetailmaster',
    '.swmasterdetailcontent',
    '.roleeditor',
    '.roleeditormain',
  ].join(',')).evaluateAll((elements) => elements.flatMap((element) => {
    const box = element.getBoundingClientRect();
    return box.left < 0 || box.right > window.innerWidth
      ? [{ className: element.getAttribute('class'), left: box.left, right: box.right }]
      : [];
  }));
  expect(clipped).toEqual([]);
}

async function screenshot(page: Page, filename: string) {
  if (screenshotDirectory !== undefined) await page.screenshot({ path: `${screenshotDirectory}/${filename}`, fullPage: true });
}

interface WireRole {
  id: string;
  name: string;
  status: 'active' | 'disabled';
  version: string;
  permissions: string[];
  member_count: string;
  governance: boolean;
  editable: boolean;
}

function initialRoles(): WireRole[] {
  return [
    { id: 'role-platform-owner-v2', name: '平台 Owner', status: 'active', version: '9', permissions: ['access.role.manage'], member_count: '1', governance: true, editable: false },
    { id: 'role-finance', name: '财务观察', status: 'active', version: '1', permissions: ['finance.overview.read', 'order.read'], member_count: '4', governance: false, editable: true },
  ];
}

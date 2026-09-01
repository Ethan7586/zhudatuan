import { expect, test, type Page } from '@playwright/test';
import { PERMISSION_CATALOG } from '@shop/authz';
import { consoleSession } from './Fixtures';
import { OperationMock, type OperationCall } from './OperationMock';

const consoleOrigin = process.env.IAM002_CONSOLE_ORIGIN ?? 'http://127.0.0.1:4273';
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

test('IAM-003 身份范围、成员分配撤销与删除闭环', async ({ page }) => {
  const browserErrors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') browserErrors.push(message.text()); });
  page.on('pageerror', (error) => browserErrors.push(error.message));
  const roles = initialRoles();
  roles.push({ id: 'role-operations', name: '运营协作', status: 'active', version: '2',
    permissions: ['order.read', 'catalog.product.manage'], member_count: '0', governance: false, editable: true,
    members: [], scopes: [] });
  const member = memberFixture();
  member.roles.push(assignment('role-operations', '运营协作', tenantScope, 'direct'));
  member.effective_permissions = ['catalog.product.manage', 'order.read'];
  const members = [member];
  syncRoleMetadata(roles, members);
  const api = accessApi(page, roles, members);
  await api.install();

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${consoleOrigin}/scopes/tenant/tenant%3Ae2e/settings/access`);
  await expect(page.getByText('管理范围', { exact: true })).toBeVisible();
  await expect(page.getByText('已分配成员', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '＋ 分配成员' }).click();
  await page.getByRole('button', { name: '确认分配并重读' }).click();
  await expect(page.getByText(/“财务观察”已分配给 张三，直接指定/)).toBeVisible();
  expect(member.roles.map(({ role }) => role).sort()).toEqual(['role-finance', 'role-operations']);
  expect(member.effective_permissions).toEqual(['catalog.product.manage', 'finance.overview.read', 'order.read']);
  const assignmentWrite = api.calls.find((call) => call.method === 'PUT'
    && call.path.endsWith('/role-finance') && (call.body as { action?: string }).action === 'assign');
  expect(assignmentWrite?.body).toEqual({ action: 'assign', membership: member.id, kind: 'tenant',
    scope: tenantScope.id, scopeSource: 'direct' });
  expect(assignmentWrite?.headers['if-match']).toBe('"3"');

  for (const width of [1314, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await expectNoHorizontalOverflow(page);
    await expectCoreContentWithinViewport(page);
    await expectStackedMasterDetail(page);
  }
  await screenshot(page, 'iam-003-mobile.png');

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: '撤销' }).click();
  await expect(page.getByText(/其他身份与成员账户保持不变/)).toBeVisible();
  expect(members).toHaveLength(1);
  expect(member.roles.map(({ role }) => role)).toEqual(['role-operations']);
  expect(member.effective_permissions).toEqual(['catalog.product.manage', 'order.read']);

  await page.getByRole('button', { name: '＋ 分配成员' }).click();
  await page.getByRole('button', { name: '确认分配并重读' }).click();
  await expect(page.getByText(/“财务观察”已分配给 张三/)).toBeVisible();
  await page.getByRole('button', { name: '删除身份' }).click();
  await page.getByRole('button', { name: '确认删除“财务观察”' }).click();
  await expect(page.getByText(/成员关系已解除，身份已删除/)).toBeVisible();
  expect(roles.some(({ id }) => id === 'role-finance')).toBe(false);
  expect(members).toHaveLength(1);
  expect(member.roles.map(({ role }) => role)).toEqual(['role-operations']);
  expect(member.effective_permissions).toEqual(['catalog.product.manage', 'order.read']);

  const copy = await page.locator('body').innerText();
  expect(copy).not.toMatch(/Smart Wing|智慧翼|築店|租户/);
  expect(api.unmatched).toEqual([]);
  expect(browserErrors).toEqual([]);
});

function accessApi(page: Page, roles: WireRole[], members: WireMembership[] = []): OperationMock {
  return new OperationMock(page)
    .get('/api/v1/identity/session', {
      ...consoleSession,
      scope: { kind: 'tenant', id: 'tenant:e2e', tenant: 'tenant:e2e', name: '主打团商户' },
      scopes: [{ kind: 'tenant', id: 'tenant:e2e', tenant: 'tenant:e2e', name: '主打团商户' }],
      permissions: ['access.center.read', 'access.role.manage', 'access.scope.manage', 'member.read'],
      capabilities: ['access.center.read', 'access.roles.manage', 'access.scopes.manage', 'member.members.read'],
      csrf: 'csrf:e2e:iam002:token', assurance: { level: 2, verified: 'password' },
    })
    .get('/api/v1/members/me', { display_name: 'Ethan', employee_no: 'OWNER001' })
    .get('/api/v1/access/center', () => ({ items: members, count: members.length, roles }))
    .get('/api/v1/members', { items: [], count: 0 })
    .put('/api/v1/access/roles/:roleid', (call) => roleCommand(call, roles, members));
}

function roleCommand(call: OperationCall, roles: WireRole[], members: WireMembership[]) {
  const body = call.body as RoleWriteBody | RoleAssignmentBody | Readonly<{ action: 'delete' }>;
  const id = decodeURIComponent(call.path.slice('/api/v1/access/roles/'.length));
  if ('action' in body) {
    if (body.action === 'delete') return deleteRole(id, roles, members);
    return updateAssignment(id, body, roles, members);
  }
  const current = roles.find((role) => role.id === id);
  const role = { id, name: body.name, status: 'active' as const, version: String(current === undefined ? 0 : Number(current.version) + 1),
    permissions: body.permissions, member_count: current?.member_count ?? '0', governance: false, editable: true,
    members: current?.members ?? [], scopes: current?.scopes ?? [] };
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
    '.roleeditorrail',
    '.rolescopesummary',
    '.roleassignedmembers',
  ].join(',')).evaluateAll((elements) => elements.flatMap((element) => {
    const box = element.getBoundingClientRect();
    return box.left < 0 || box.right > window.innerWidth
      ? [{ className: element.getAttribute('class'), left: box.left, right: box.right }]
      : [];
  }));
  expect(clipped).toEqual([]);
}

async function expectStackedMasterDetail(page: Page) {
  const stacked = await page.locator('.roleaccessmasterdetail').evaluate((workspace) => {
    const master = workspace.querySelector('.swmasterdetailmaster')?.getBoundingClientRect();
    const detail = workspace.querySelector('.swmasterdetailcontent')?.getBoundingClientRect();
    return master !== undefined && detail !== undefined && detail.top >= master.bottom - 1;
  });
  expect(stacked).toBe(true);
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
  members: WireRoleMember[];
  scopes: WireRoleScope[];
}

function initialRoles(): WireRole[] {
  return [
    { id: 'role-platform-owner-v2', name: '平台 Owner', status: 'active', version: '9', permissions: ['access.role.manage'], member_count: '1', governance: true, editable: false, members: [], scopes: [] },
    { id: 'role-finance', name: '财务观察', status: 'active', version: '1', permissions: ['finance.overview.read', 'order.read'], member_count: '4', governance: false, editable: true, members: [], scopes: [] },
  ];
}

interface WireScope {
  kind: 'tenant';
  id: string;
  tenant: string;
  name: string;
}

interface WireAssignment {
  role: string;
  name: string;
  scope: WireScope;
  scope_source: 'direct' | 'inherited';
  effective_at: string;
  expires: null;
}

interface WireMembership {
  id: string;
  status: string;
  access_version: string;
  member_id: string;
  display_name: string;
  employee_no: string | null;
  roles: WireAssignment[];
  scopes: WireScopeGrant[];
  denies: string[];
  effective_permissions: string[];
}

interface WireScopeGrant {
  id: string;
  kind: WireScope['kind'];
  scope: string;
  effect: 'allow';
  expires: null;
}

interface WireRoleMember {
  membership: string;
  member_id: string;
  display_name: string;
  employee_no: string | null;
  access_version: string;
  scope: WireScope;
  scope_source: 'direct' | 'inherited';
  effective_at: string;
  expires: null;
}

interface WireRoleScope {
  scope: WireScope;
  source: 'direct' | 'inherited';
  member_count: string;
}

interface RoleWriteBody { name: string; permissions: string[] }
interface RoleAssignmentBody {
  action: 'assign' | 'revoke';
  membership: string;
  kind: WireScope['kind'];
  scope: string;
  scopeSource: 'direct' | 'inherited';
}

const tenantScope: WireScope = { kind: 'tenant', id: 'tenant:e2e', tenant: 'tenant:e2e', name: '主打团商户' };

function memberFixture(): WireMembership {
  return { id: 'membership:zhangsan', status: 'active', access_version: '3', member_id: 'member:zhangsan',
    display_name: '张三', employee_no: 'EMP003', roles: [], scopes: [{ id: 'scope:tenant:e2e', kind: 'tenant',
      scope: tenantScope.id, effect: 'allow', expires: null }], denies: [], effective_permissions: [] };
}

function assignment(role: string, name: string, scope: WireScope, source: 'direct' | 'inherited'): WireAssignment {
  return { role, name, scope, scope_source: source, effective_at: '2026-09-01T00:00:00.000Z', expires: null };
}

function updateAssignment(roleId: string, body: RoleAssignmentBody, roles: WireRole[], members: WireMembership[]) {
  const member = members.find(({ id }) => id === body.membership);
  const role = roles.find(({ id }) => id === roleId);
  if (member === undefined || role === undefined) throw new Error('fixture assignment target missing');
  const index = member.roles.findIndex((item) => item.role === roleId && item.scope.id === body.scope);
  let changed = false;
  if (body.action === 'assign' && index < 0) {
    member.roles.push(assignment(roleId, role.name, tenantScope, body.scopeSource));
    changed = true;
  } else if (body.action === 'revoke' && index >= 0) {
    member.roles.splice(index, 1);
    changed = true;
  }
  if (changed) member.access_version = String(Number(member.access_version) + 1);
  recompute(member, roles);
  syncRoleMetadata(roles, members);
  return { action: body.action, changed, role: roleId, membership: member.id, scope: tenantScope,
    scope_source: body.scopeSource, access_version: member.access_version };
}

function deleteRole(roleId: string, roles: WireRole[], members: WireMembership[]) {
  const roleIndex = roles.findIndex(({ id }) => id === roleId);
  const role = roles[roleIndex];
  if (role === undefined) throw new Error('fixture role missing');
  const affected = members.flatMap((member) => {
    const before = member.roles.length;
    member.roles = member.roles.filter((item) => item.role !== roleId);
    if (member.roles.length === before) return [];
    member.access_version = String(Number(member.access_version) + 1);
    return [{ membership: member.id, access_version: member.access_version }];
  });
  roles.splice(roleIndex, 1);
  members.forEach((member) => recompute(member, roles));
  syncRoleMetadata(roles, members);
  return { action: 'delete', deleted: true, role: roleId, name: role.name, affected_memberships: affected };
}

function recompute(member: WireMembership, roles: WireRole[]) {
  const denied = new Set(member.denies);
  member.effective_permissions = [...new Set(member.roles.flatMap((item) => roles.find(({ id }) => id === item.role)?.permissions ?? []))]
    .filter((permission) => !denied.has(permission)).sort();
}

function syncRoleMetadata(roles: WireRole[], members: WireMembership[]) {
  roles.forEach((role) => {
    const assigned = members.flatMap((member) => member.roles.filter((item) => item.role === role.id).map((item) => ({ member, item })));
    role.member_count = String(new Set(assigned.map(({ member }) => member.id)).size);
    role.members = assigned.map(({ member, item }) => ({ membership: member.id, member_id: member.member_id,
      display_name: member.display_name, employee_no: member.employee_no, access_version: member.access_version,
      scope: item.scope, scope_source: item.scope_source, effective_at: item.effective_at, expires: null }));
    role.scopes = assigned.length === 0 ? [] : [{ scope: tenantScope, source: assigned[0]!.item.scope_source,
      member_count: role.member_count }];
  });
}

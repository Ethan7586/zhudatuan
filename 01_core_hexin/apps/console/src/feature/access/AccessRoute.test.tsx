import { PERMISSION_CATALOG } from '@shop/authz';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter } from 'react-router';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ConsoleContextProvider } from '../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { Component } from './AccessRoute';

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

interface WireInvitationRecord {
  id: string;
  scope: string;
  scope_name: string;
  label: string;
  governance_level: 'administrator' | 'senior_administrator';
  created_by: string;
  created_by_name: string | null;
  accepted_membership_id: string | null;
  invitee_name: string | null;
  destination_masked: string | null;
  max_uses: number;
  use_count: number;
  starts_at: string;
  expires_at: string;
  accepted_at: string | null;
  status: 'active' | 'used' | 'expired' | 'revoked';
  created_at: string;
  version: string;
}

let roles: WireRole[] = [];
let members: WireMembership[] = [];
let invitationRecords: WireInvitationRecord[] = [];
let writes: Readonly<{ body: Readonly<{ name: string; permissions: string[] }>; expectedVersion: string | null; roleId: string }>[] = [];
let assignmentWrites: Readonly<{ body: RoleAssignmentBody; expectedVersion: string | null; roleId: string }>[] = [];
let conflict = false;
let reads = 0;

const server = setupServer(
  http.get('*/api/v1/access/center', () => {
    reads += 1;
    return HttpResponse.json({ items: members, count: members.length, roles });
  }),
  http.get('*/api/v1/member/invitations', () => HttpResponse.json({
    items: invitationRecords,
    count: invitationRecords.length,
  })),
  http.put('*/api/v1/access/roles/:roleId', async ({ request, params }) => {
    const body = await request.json() as RoleWriteBody | RoleAssignmentBody | Readonly<{ action: 'delete' }>;
    if (conflict) return HttpResponse.json({ code: 'VERSION_CONFLICT', message: 'stale role version', requestId: 'request:conflict' }, { status: 409 });
    if ('action' in body) {
      if (body.action === 'delete') return HttpResponse.json(deleteRole(String(params.roleId)));
      assignmentWrites = [...assignmentWrites, { body, expectedVersion: request.headers.get('if-match'), roleId: String(params.roleId) }];
      return HttpResponse.json(updateAssignment(String(params.roleId), body));
    }
    writes = [...writes, { body, expectedVersion: request.headers.get('if-match'), roleId: String(params.roleId) }];
    const current = roles.find(({ id }) => id === params.roleId);
    const version = current === undefined ? 0 : Number(current.version) + 1;
    const saved: WireRole = {
      id: String(params.roleId), name: body.name, permissions: body.permissions, status: 'active', version: String(version),
      member_count: current?.member_count ?? '0', governance: false, editable: true,
      members: current?.members ?? [], scopes: current?.scopes ?? [],
    };
    roles = [...roles.filter(({ id }) => id !== saved.id), saved];
    const affected = members.flatMap((member) => {
      if (!member.roles.some((assignment) => assignment.role === saved.id)) return [];
      member.access_version = String(Number(member.access_version) + 1);
      recompute(member);
      return [{ membership: member.id, access_version: member.access_version }];
    });
    syncRoleMetadata();
    return HttpResponse.json({ ...roles.find(({ id }) => id === saved.id), affected_memberships: affected });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  roles = initialRoles();
  members = [];
  invitationRecords = [];
  writes = [];
  assignmentWrites = [];
  conflict = false;
  reads = 0;
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

describe('custom identity and permission directory', () => {
  it('accepts the authoritative L1 Owner assignment source', async () => {
    const member = memberFixture();
    server.use(http.get('*/api/v1/access/center', () => HttpResponse.json({
      items: [{ ...member, roles: [{
        ...assignment('role-l1-owner-v1:tenant-zhudatuan', 'L1 Owner', mallScope, 'direct'),
        scope_source: 'l1_owner',
      }] }],
      count: 1,
      roles,
    })));

    renderWorkspace();

    expect(await screen.findByRole('heading', { name: '编辑身份' })).toBeTruthy();
    expect(screen.queryByText('身份目录读取失败')).toBeNull();
  });

  it('separates governance and custom identities and renders the complete authoritative permission catalog', async () => {
    renderWorkspace();

    expect(await screen.findByRole('heading', { name: '编辑身份' })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: '会员与权限工作台' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '成员' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '身份与权限' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('button', { name: '邀请记录' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '治理身份' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '自定义业务身份' })).toBeTruthy();
    expect(screen.getByText('平台 Owner')).toBeTruthy();
    expect(screen.getAllByRole('checkbox')).toHaveLength(PERMISSION_CATALOG.length);
    expect(screen.queryByText(/Smart Wing|智慧翼|築店|租户/)).toBeNull();
  });

  it('creates a freely named identity with finance, order, and product permissions and verifies it by rereading', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await screen.findByRole('heading', { name: '编辑身份' });

    await user.click(screen.getByRole('button', { name: '＋ 新建自定义身份' }));
    const name = screen.getByPlaceholderText('例如：财务');
    await user.type(name, '财务');
    expect(screen.getAllByRole('checkbox').filter((item) => (item as HTMLInputElement).checked)).toHaveLength(0);
    await user.click(screen.getByRole('checkbox', { name: /finance\.overview\.read/ }));
    await user.click(screen.getByRole('checkbox', { name: /order\.read/ }));
    await user.click(screen.getByRole('checkbox', { name: /catalog\.product\.manage/ }));
    await user.click(screen.getByRole('button', { name: '保存身份' }));

    expect(await screen.findByText(/“财务”已保存，并已通过正式接口重读核对名称、权限与版本 v0/)).toBeTruthy();
    expect(writes).toHaveLength(1);
    expect(writes[0]?.body).toEqual({ name: '财务', permissions: ['finance.overview.read', 'order.read', 'catalog.product.manage'] });
    expect(writes[0]?.expectedVersion).toBeNull();
    expect(reads).toBeGreaterThanOrEqual(2);
  });

  it('preserves permissions on rename and preserves the name on permission changes', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    const name = await screen.findByPlaceholderText('例如：财务');

    await user.clear(name);
    await user.type(name, '财务主管');
    await user.click(screen.getByRole('button', { name: '保存身份' }));
    await screen.findByText(/“财务主管”已保存/);
    expect(writes[0]?.body).toEqual({ name: '财务主管', permissions: ['finance.overview.read', 'order.read'] });
    expect(writes[0]?.expectedVersion).toBe('"1"');

    await user.click(screen.getByRole('checkbox', { name: /catalog\.product\.manage/ }));
    await user.click(screen.getByRole('button', { name: '保存身份' }));
    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[1]?.body.name).toBe('财务主管');
    expect(writes[1]?.body.permissions).toEqual(['finance.overview.read', 'order.read', 'catalog.product.manage']);
  });

  it('rereads affected members, effective permissions, scopes, denies and Access Version after an identity save', async () => {
    const member = memberFixture();
    member.roles.push(assignment('role-finance', '财务观察', tenantScope, 'direct'));
    member.denies = ['finance.overview.read'];
    members = [member];
    recompute(member);
    syncRoleMetadata();
    const scopesBefore = structuredClone(member.scopes);
    const user = userEvent.setup();
    renderWorkspace();
    await screen.findByRole('heading', { name: '编辑身份' });

    await user.click(screen.getByRole('checkbox', { name: /catalog\.product\.manage/ }));
    await user.click(screen.getByRole('button', { name: '保存身份' }));

    expect(await screen.findByText(/Access Version v4/)).toBeTruthy();
    expect(member.access_version).toBe('4');
    expect(member.roles.map(({ role }) => role)).toEqual(['role-finance']);
    expect(member.scopes).toEqual(scopesBefore);
    expect(member.denies).toEqual(['finance.overview.read']);
    expect(member.effective_permissions).toEqual(['catalog.product.manage', 'order.read']);
  });

  it('shows a version conflict without claiming that the draft was saved', async () => {
    conflict = true;
    const user = userEvent.setup();
    renderWorkspace();
    const name = await screen.findByPlaceholderText('例如：财务');
    await user.clear(name);
    await user.type(name, '冲突中的财务');
    await user.click(screen.getByRole('button', { name: '保存身份' }));

    expect((await screen.findByRole('alert')).textContent).toContain('版本冲突');
    expect(screen.getByText(/当前草稿未保存/)).toBeTruthy();
    expect(screen.queryByText(/已保存，并已通过正式接口/)).toBeNull();
  });

  it('shows explicit no-permission and real invitation-record states', async () => {
    const denied = { ...context, session: { ...context.session, permissions: [], capabilities: [] } };
    const view = renderWorkspace(denied);
    expect(screen.getByText('无权读取身份目录')).toBeTruthy();
    view.unmount();

    invitationRecords = [{
      id: 'invite:one', scope: 'tenant:one', scope_name: '主打团商户', label: '134****7586',
      governance_level: 'senior_administrator', created_by: 'membership:owner', created_by_name: 'Ethan',
      accepted_membership_id: null, invitee_name: null, destination_masked: '134****7586',
      max_uses: 1, use_count: 0, starts_at: '2026-09-02T12:00:00.000Z', expires_at: '2026-09-09T12:00:00.000Z',
      accepted_at: null, status: 'active', created_at: '2026-09-02T12:00:00.000Z', version: '0',
    }, {
      id: 'invite:used', scope: 'tenant:one', scope_name: '主打团商户', label: '李厚亿 · 134****7586',
      governance_level: 'senior_administrator', created_by: 'membership:owner', created_by_name: 'Ethan',
      accepted_membership_id: 'membership:li', invitee_name: '李厚亿', destination_masked: '134****7586',
      max_uses: 1, use_count: 1, starts_at: '2026-09-01T12:00:00.000Z', expires_at: '2026-09-08T12:00:00.000Z',
      accepted_at: '2026-09-02T10:00:00.000Z', status: 'used', created_at: '2026-09-01T12:00:00.000Z', version: '1',
    }, {
      id: 'invite:revoked', scope: 'tenant:one', scope_name: '主打团商户', label: '历史记录，邀请对象不可还原',
      governance_level: 'administrator', created_by: 'membership:owner', created_by_name: 'Ethan',
      accepted_membership_id: null, invitee_name: null, destination_masked: null,
      max_uses: 1, use_count: 0, starts_at: '2026-08-31T12:00:00.000Z', expires_at: '2026-09-07T12:00:00.000Z',
      accepted_at: null, status: 'revoked', created_at: '2026-08-31T12:00:00.000Z', version: '1',
    }];
    renderWorkspace(context, '/scopes/tenant/tenant%3Aone/settings/access?section=invitations');
    expect(screen.getByRole('heading', { name: '邀请记录' })).toBeTruthy();
    const table = await screen.findByRole('table', { name: '邀请记录，共 3 条' });
    expect(within(table).getAllByRole('columnheader').map(({ textContent }) => textContent)).toEqual([
      '被邀请人', '邀请人', '管理员级别', '状态', '创建时间', '接受时间',
    ]);
    expect(within(table).getAllByRole('row')).toHaveLength(4);
    const liRow = within(table).getByText('李厚亿 · 134****7586').closest('tr');
    expect(liRow).not.toBeNull();
    expect(within(liRow as HTMLElement).getByText('Ethan')).toBeTruthy();
    expect(within(table).getByText('历史记录，邀请对象不可还原')).toBeTruthy();
    expect(within(table).getAllByText('高级管理员')).toHaveLength(2);
    expect(within(table).getByText('生效中')).toBeTruthy();
    expect(within(table).getByText('已使用')).toBeTruthy();
    expect(within(table).getByText('已作废')).toBeTruthy();
  });

  it('assigns two custom identities to one member and rereads their overlaid permissions and Access Version', async () => {
    members = [memberFixture()];
    syncRoleMetadata();
    const user = userEvent.setup();
    renderWorkspace();
    await screen.findByRole('heading', { name: '编辑身份' });

    await user.click(screen.getByRole('button', { name: '＋ 分配成员' }));
    await user.click(screen.getByRole('button', { name: '确认分配并重读' }));
    expect(await screen.findByText(/“财务观察”已分配给 张三/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /运营协作/ }));
    await user.click(screen.getByRole('button', { name: '＋ 分配成员' }));
    await user.click(screen.getByRole('button', { name: '确认分配并重读' }));
    expect(await screen.findByText(/“运营协作”已分配给 张三/)).toBeTruthy();

    expect(members[0]?.roles.map(({ role }) => role).sort()).toEqual(['role-finance', 'role-operations']);
    expect(members[0]?.effective_permissions).toEqual(['catalog.product.manage', 'finance.overview.read', 'order.read']);
    expect(members[0]?.access_version).toBe('5');
    expect(assignmentWrites.map(({ body }) => body.action)).toEqual(['assign', 'assign']);
    expect(reads).toBeGreaterThanOrEqual(3);
  });

  it('persists an inherited scope and revokes only that identity while keeping the other identity and member account', async () => {
    const member = memberFixture();
    member.scopes.push(scopeGrant(mallScope));
    member.scopes.push(scopeGrant(outsideMallScope));
    member.roles.push(assignment('role-operations', '运营协作', tenantScope, 'direct'));
    members = [member];
    recompute(member);
    syncRoleMetadata();
    const user = userEvent.setup();
    renderWorkspace();
    await screen.findByRole('heading', { name: '编辑身份' });

    await user.click(screen.getByRole('button', { name: '＋ 分配成员' }));
    await user.selectOptions(screen.getByLabelText('范围来源'), 'inherited');
    expect(screen.queryByRole('option', { name: /范围外商城/ })).toBeNull();
    await user.selectOptions(screen.getByLabelText('生效范围'), 'mall:mall:one');
    await user.click(screen.getByRole('button', { name: '确认分配并重读' }));
    expect(await screen.findByText(/继承来源 商城 · 一号商城/)).toBeTruthy();
    expect(screen.getAllByText('继承来源').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: '撤销' }));
    expect(await screen.findByText(/其他身份与成员账户保持不变/)).toBeTruthy();
    expect(members).toHaveLength(1);
    expect(members[0]?.roles.map(({ role }) => role)).toEqual(['role-operations']);
    expect(members[0]?.effective_permissions).toEqual(['catalog.product.manage', 'order.read']);
  });

  it('deletes a custom identity after detaching it without deleting members or their other identities', async () => {
    const member = memberFixture();
    member.roles.push(assignment('role-finance', '财务观察', tenantScope, 'direct'));
    member.roles.push(assignment('role-operations', '运营协作', tenantScope, 'direct'));
    members = [member];
    recompute(member);
    syncRoleMetadata();
    const user = userEvent.setup();
    renderWorkspace();
    await screen.findByRole('heading', { name: '编辑身份' });

    await user.click(screen.getByRole('button', { name: '删除身份' }));
    await user.click(screen.getByRole('button', { name: '确认删除“财务观察”' }));
    expect(await screen.findByText(/成员关系已解除，身份已删除/)).toBeTruthy();

    expect(roles.some(({ id }) => id === 'role-finance')).toBe(false);
    expect(members).toHaveLength(1);
    expect(members[0]?.roles.map(({ role }) => role)).toEqual(['role-operations']);
    expect(members[0]?.effective_permissions).toEqual(['catalog.product.manage', 'order.read']);
  });
});

function renderWorkspace(value: ConsoleContext = context, entry = '/scopes/tenant/tenant%3Aone/settings/access') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <QueryClientProvider client={client}>
        <ConsoleContextProvider value={value}><Component /></ConsoleContextProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

const tenantScope = { kind: 'tenant', id: 'tenant:one', tenant: 'tenant:one', name: '主打团商户' } as const;
const mallScope: WireScope = { kind: 'mall', id: 'mall:one', tenant: tenantScope.id, name: '一号商城',
  path: [{ kind: 'tenant', id: tenantScope.id }] };
const context: ConsoleContext = {
  session: {
    actor: 'actor:owner', membership: 'membership:owner', accessVersion: 7,
    permissions: ['access.center.read', 'access.role.manage', 'access.scope.manage', 'identity.invitation.manage'],
    capabilities: ['access.center.read', 'access.roles.manage', 'access.scopes.manage', 'identity.invitations.create', 'member.invitations.read'],
    governance: { level: 'owner', exactOwner: true, organization: 'tenant:one' },
    assurance: { level: 2 }, target: 'console', scope: tenantScope, scopes: [tenantScope, mallScope], csrf: 'csrf:test',
    syncedAt: '2026-09-01T00:00:00.000Z',
  },
  profile: { display_name: 'Ethan', employee_no: null }, scope: tenantScope, scopes: [tenantScope, mallScope],
};

function initialRoles(): WireRole[] {
  return [
    { id: 'role-platform-owner-v2', name: '平台 Owner', status: 'active', version: '9', permissions: ['access.role.manage'], member_count: '1', governance: true, editable: false, members: [], scopes: [] },
    { id: 'role-finance', name: '财务观察', status: 'active', version: '1', permissions: ['finance.overview.read', 'order.read'], member_count: '4', governance: false, editable: true, members: [], scopes: [] },
    { id: 'role-operations', name: '运营协作', status: 'active', version: '2', permissions: ['order.read', 'catalog.product.manage'], member_count: '0', governance: false, editable: true, members: [], scopes: [] },
  ];
}

interface WireScope {
  kind: 'tenant' | 'mall';
  id: string;
  tenant: string;
  name: string;
  path?: { kind: 'tenant'; id: string }[];
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
  effect: 'allow' | 'deny';
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

const outsideMallScope: WireScope = { kind: 'mall', id: 'mall:outside', tenant: 'tenant:outside', name: '范围外商城',
  path: [{ kind: 'tenant', id: 'tenant:outside' }] };

function memberFixture(): WireMembership {
  return {
    id: 'membership:zhangsan', status: 'active', access_version: '3', member_id: 'member:zhangsan',
    display_name: '张三', employee_no: 'EMP003', roles: [], scopes: [scopeGrant(tenantScope)],
    denies: [], effective_permissions: [],
  };
}

function assignment(role: string, name: string, scope: WireScope, scopeSource: 'direct' | 'inherited'): WireAssignment {
  return { role, name, scope, scope_source: scopeSource, effective_at: '2026-09-01T00:00:00.000Z', expires: null };
}

function scopeGrant(scope: WireScope): WireScopeGrant {
  return { id: `scope:${scope.id}`, kind: scope.kind, scope: scope.id, effect: 'allow', expires: null };
}

function updateAssignment(roleId: string, body: RoleAssignmentBody) {
  const member = members.find(({ id }) => id === body.membership);
  const role = roles.find(({ id }) => id === roleId);
  if (member === undefined || role === undefined) throw new Error('fixture assignment target missing');
  const scope = body.scope === mallScope.id ? mallScope : tenantScope;
  const index = member.roles.findIndex((item) => item.role === roleId && item.scope.id === scope.id);
  let changed = false;
  if (body.action === 'assign' && index < 0) {
    member.roles.push(assignment(roleId, role.name, scope, body.scopeSource));
    if (body.scopeSource === 'direct' && !member.scopes.some((grant) => grant.effect === 'allow' && grant.scope === scope.id)) {
      member.scopes.push(scopeGrant(scope));
    }
    changed = true;
  } else if (body.action === 'revoke' && index >= 0) {
    member.roles.splice(index, 1);
    changed = true;
  }
  if (changed) member.access_version = String(Number(member.access_version) + 1);
  recompute(member);
  syncRoleMetadata();
  return { action: body.action, changed, role: roleId, membership: member.id, scope,
    scope_source: body.scopeSource, access_version: member.access_version };
}

function deleteRole(roleId: string) {
  const role = roles.find(({ id }) => id === roleId);
  if (role === undefined) throw new Error('fixture role missing');
  const affected = members.flatMap((member) => {
    const before = member.roles.length;
    member.roles = member.roles.filter((item) => item.role !== roleId);
    if (member.roles.length === before) return [];
    member.access_version = String(Number(member.access_version) + 1);
    return [{ membership: member.id, access_version: member.access_version }];
  });
  roles = roles.filter(({ id }) => id !== roleId);
  members.forEach(recompute);
  syncRoleMetadata();
  return { action: 'delete', deleted: true, role: roleId, name: role.name, affected_memberships: affected };
}

function recompute(member: WireMembership) {
  const denied = new Set(member.denies);
  member.effective_permissions = [...new Set(member.roles.flatMap((item) => roles.find(({ id }) => id === item.role)?.permissions ?? []))]
    .filter((permission) => !denied.has(permission)).sort();
}

function syncRoleMetadata() {
  roles = roles.map((role) => {
    const assigned = members.flatMap((member) => member.roles.filter((item) => item.role === role.id).map((item) => ({ member, item })));
    const scopeMembers = new Map<string, { scope: WireScope; source: 'direct' | 'inherited'; members: Set<string> }>();
    assigned.forEach(({ member, item }) => {
      const key = `${item.scope.kind}:${item.scope.id}:${item.scope_source}`;
      const current = scopeMembers.get(key) ?? { scope: item.scope, source: item.scope_source, members: new Set<string>() };
      current.members.add(member.id);
      scopeMembers.set(key, current);
    });
    return { ...role,
      member_count: String(new Set(assigned.map(({ member }) => member.id)).size),
      members: assigned.map(({ member, item }) => ({ membership: member.id, member_id: member.member_id,
        display_name: member.display_name, employee_no: member.employee_no, access_version: member.access_version,
        scope: item.scope, scope_source: item.scope_source, effective_at: item.effective_at, expires: null })),
      scopes: [...scopeMembers.values()].map((item) => ({ scope: item.scope, source: item.source,
        member_count: String(item.members.size) })),
    };
  });
}

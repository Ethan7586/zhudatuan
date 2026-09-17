import { PERMISSION_CATALOG } from '@shop/authz';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ConsoleContextProvider } from '../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { Component } from './AccessRoute';
import { MemberAccessWorkspace } from './MemberAccessWorkspace';

interface WireRole {
  id: string;
  name: string;
  status: 'active' | 'disabled';
  version: string;
  permissions: string[];
  member_count: string;
  governance: boolean;
  governance_level?: 'owner' | 'senior_administrator' | 'administrator' | null;
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
let invitationReads = 0;

const server = setupServer(
  http.get('*/api/v1/access/center', () => {
    reads += 1;
    return HttpResponse.json({ items: members, count: members.length, roles });
  }),
  http.get('*/api/v1/members', () => HttpResponse.json({ items: [], count: 0 })),
  http.get('*/api/v1/member/invitations', () => {
    invitationReads += 1;
    return HttpResponse.json({ items: invitationRecords, count: invitationRecords.length });
  }),
  http.put('*/api/v1/access/roles/:roleId', async ({ request, params }) => {
    const body = (await request.json()) as RoleWriteBody | RoleAssignmentBody | Readonly<{ action: 'delete' }>;
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
      id: String(params.roleId),
      name: body.name,
      permissions: body.permissions,
      status: 'active',
      version: String(version),
      member_count: current?.member_count ?? '0',
      governance: false,
      editable: true,
      members: current?.members ?? [],
      scopes: current?.scopes ?? [],
    };
    roles = [...roles.filter(({ id }) => id !== saved.id), saved];
    const affected = members.flatMap((member) => {
      if (!member.roles.some((assignment) => assignment.role === saved.id)) return [];
      member.access_version = String(Number(member.access_version) + 1);
      recompute(member);
      return [{ membership: member.id, access_version: member.access_version }];
    });
    syncRoleMetadata();
    return HttpResponse.json({
      id: saved.id,
      name: saved.name,
      status: saved.status,
      version: saved.version,
      affected_memberships: affected,
    });
  })
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
  invitationReads = 0;
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

describe('custom identity and permission directory', () => {
  it('accepts the authoritative L1 Owner assignment source', async () => {
    const member = memberFixture();
    server.use(
      http.get('*/api/v1/access/center', () =>
        HttpResponse.json({
          items: [
            {
              ...member,
              roles: [
                {
                  ...assignment('role-l1-owner-v1:tenant-zhudatuan', 'L1 Owner', mallScope, 'direct'),
                  scope_source: 'l1_owner',
                },
              ],
            },
          ],
          count: 1,
          roles,
        })
      )
    );

    renderWorkspace();

    expect(await screen.findByRole('heading', { name: '财务观察' })).toBeTruthy();
    expect(screen.queryByText('身份目录读取失败')).toBeNull();
  });

  it('keeps the authoritative permission catalog collapsed and mounts one category on demand', async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await openRolePermissions();
    expect(screen.getAllByRole('heading', { name: '角色模板' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('navigation', { name: '管理与权限工作台' })).toBeNull();
    expect(screen.getByRole('button', { name: '返回管理员' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '角色列表' })).toBeTruthy();
    expect(screen.getByRole('complementary', { name: '权限影响预览' })).toBeTruthy();
    expect(within(screen.getByRole('region', { name: '选择功能权限' })).getAllByRole('button')).toHaveLength(4);
    expect(screen.getByText('平台 Owner')).toBeTruthy();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    await user.click(within(screen.getByRole('region', { name: '选择功能权限' })).getByRole('button', { name: /^系统设置/ }));
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('checkbox').length).toBeLessThan(PERMISSION_CATALOG.length);
    expect(screen.getByRole('checkbox', { name: /runtime\.health\.read/ })).toBeTruthy();
    await user.click(within(screen.getByRole('region', { name: '选择功能权限' })).getByRole('button', { name: /^系统设置/ }));
    expect(screen.queryByRole('checkbox', { name: /runtime\.health\.read/ })).toBeNull();
    expect(screen.queryByText(/Smart Wing|智慧翼|築店|租户/)).toBeNull();
  });

  it('mounts only permission matches while filtering', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await openRolePermissions();

    await user.type(screen.getByPlaceholderText('输入权限代码'), 'finance.overview.read');

    expect(screen.getByRole('checkbox', { name: /finance\.overview\.read/ })).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: /order\.read/ })).toBeNull();
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
  });

  it('reuses the member page access directory cache when entering identity permissions', async () => {
    const user = userEvent.setup();
    renderSwitchWorkspace();
    await screen.findByRole('heading', { name: '管理员目录' });
    await waitFor(() => expect(reads).toBe(1));

    await user.click(screen.getByRole('button', { name: '角色模板' }));

    expect(await screen.findByRole('heading', { name: '财务观察' })).toBeTruthy();
    expect(reads).toBe(1);
  });

  it('opens the selected role template directly in member scheduling', async () => {
    renderWorkspace(context, '/scopes/tenant/tenant%3Aone/settings/access?role=role-finance&view=members');

    expect(await screen.findByRole('heading', { name: '财务观察' })).toBeTruthy();
    expect(await screen.findByRole('button', { name: '＋ 分配成员' })).toBeTruthy();
    expect(within(screen.getByRole('navigation', { name: '角色详情' })).getByRole('button', { name: /^成员与范围/ }).getAttribute('aria-selected')).toBe('true');
  });

  it('keeps the storefront consumer role out of administrator role templates', async () => {
    roles = [{
      id: 'role-zhudatuan-storefront-member:mall-one',
      name: '商城会员',
      status: 'active',
      version: '1',
      permissions: ['order.read'],
      member_count: '12',
      governance: false,
      editable: true,
      members: [],
      scopes: [],
    }];

    renderWorkspace();

    expect(await screen.findByText('暂无自定义身份')).toBeTruthy();
    expect(screen.queryByText('商城会员')).toBeNull();
  });

  it('keeps the explicit member refresh authoritative', async () => {
    const user = userEvent.setup();
    renderSwitchWorkspace();
    await waitFor(() => expect(reads).toBe(1));

    await user.click(screen.getByRole('button', { name: '刷新成员名单' }));

    await waitFor(() => expect(reads).toBe(2));
  });

  it('keeps ordinary members separate and nests administrator tools inside administrator details', async () => {
    roles = [
      ...roles,
      {
        id: 'role-consumer',
        name: '商城会员',
        status: 'active',
        version: '1',
        permissions: ['order.read'],
        member_count: '1',
        governance: false,
        editable: true,
        members: [],
        scopes: [],
      },
    ];
    members = [
      {
        ...memberFixture(),
        id: 'membership:owner',
        member_id: 'member:administrator',
        display_name: '小白管理员',
        roles: [assignment('role-finance', '财务观察', mallScope, 'direct')],
      },
    ];
    invitationRecords = [
      {
        id: 'invite:administrator',
        scope: 'tenant:one',
        scope_name: '主打团商户',
        label: '管理员发出的邀请',
        governance_level: 'administrator',
        created_by: 'membership:owner',
        created_by_name: '小白管理员',
        accepted_membership_id: null,
        invitee_name: '受邀管理员',
        destination_masked: '138****0000',
        max_uses: 1,
        use_count: 0,
        starts_at: '2026-09-10T12:00:00.000Z',
        expires_at: '2026-09-17T12:00:00.000Z',
        accepted_at: null,
        status: 'active',
        created_at: '2026-09-10T12:00:00.000Z',
        version: '0',
      },
      {
        id: 'invite:other',
        scope: 'tenant:one',
        scope_name: '主打团商户',
        label: '其他人的邀请',
        governance_level: 'administrator',
        created_by: 'membership:other',
        created_by_name: '其他管理员',
        accepted_membership_id: null,
        invitee_name: '不应出现',
        destination_masked: '139****0000',
        max_uses: 1,
        use_count: 0,
        starts_at: '2026-09-10T12:00:00.000Z',
        expires_at: '2026-09-17T12:00:00.000Z',
        accepted_at: null,
        status: 'active',
        created_at: '2026-09-10T12:00:00.000Z',
        version: '0',
      },
    ];
    server.use(
      http.get('*/api/v1/members', () =>
        HttpResponse.json({
          items: [
            {
              id: 'member:administrator',
              display_name: '小白管理员',
              status: 'active',
              membership_id: 'membership:owner',
              employee_no: null,
              membership_status: 'active',
              access_version: 7,
              joined_at: '2026-09-02T03:28:35.000Z',
              principal_id: 'principal:administrator',
              principal_version: 1,
              client: 'operator',
              login_identity_bound: true,
              reset_allowed: false,
              reset_block_reason: null,
              governance_parent_membership_id: 'membership:root',
              governance_parent_name: 'Ethan',
            },
          ],
          count: 1,
        })
      )
    );
    const user = userEvent.setup();
    renderSwitchWorkspace();

    expect(await screen.findByRole('heading', { name: '管理员目录' })).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: '管理与权限工作台' })).toBeNull();
    expect(screen.getByRole('button', { name: '角色模板' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '邀请管理员' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '邀请码' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '待补充' })).toBeNull();

    const administratorRow = await screen.findByRole('row', { name: '查看管理员 小白管理员' });
    expect(screen.queryByRole('row', { name: '查看管理员 普通消费者' })).toBeNull();
    expect(within(administratorRow).getByText('财务观察')).toBeTruthy();

    await user.click(administratorRow);
    expect(screen.getByRole('heading', { name: '管理员详情' })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: '管理员档案' })).toBeTruthy();
    expect(invitationReads).toBe(0);

    await user.click(screen.getByRole('tab', { name: '邀请记录' }));
    expect(await screen.findByText('受邀管理员')).toBeTruthy();
    expect(screen.queryByText('不应出现')).toBeNull();
    expect(invitationReads).toBe(1);
  });

  it('opens the existing invitation management page from the administrator directory', async () => {
    const user = userEvent.setup();
    renderSwitchWorkspace();

    await user.click(await screen.findByRole('button', { name: '邀请码' }));

    expect(await screen.findByRole('heading', { name: '邀请管理' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '邀请记录' })).toBeTruthy();
  });

  it('creates a freely named identity with finance, order, and product permissions and verifies it by rereading', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await openRolePermissions();

    await user.click(screen.getByRole('button', { name: '新建角色' }));
    const name = screen.getByPlaceholderText('例如：财务管理员');
    await user.type(name, '财务');
    expect(screen.queryAllByRole('checkbox').filter((item) => (item as HTMLInputElement).checked)).toHaveLength(0);
    const permissionOverview = within(screen.getByRole('region', { name: '选择功能权限' }));
    await user.click(permissionOverview.getByRole('button', { name: /^财务/ }));
    await user.click(screen.getByRole('checkbox', { name: /finance\.overview\.read/ }));
    await user.click(permissionOverview.getByRole('button', { name: /^订单与售后/ }));
    await user.click(screen.getByRole('checkbox', { name: /order\.read/ }));
    await user.click(screen.getByRole('checkbox', { name: /catalog\.product\.manage/ }));
    await user.click(screen.getByRole('button', { name: '保存修改' }));

    expect(await screen.findByText(/“财务”已保存，并已通过正式接口重读核对名称、权限与版本 v0/)).toBeTruthy();
    expect(writes).toHaveLength(1);
    expect(writes[0]?.body).toEqual({ name: '财务', permissions: ['finance.overview.read', 'order.read', 'catalog.product.manage'] });
    expect(writes[0]?.expectedVersion).toBeNull();
    expect(reads).toBeGreaterThanOrEqual(2);
  });

  it('preserves permissions on rename and preserves the name on permission changes', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await openRolePermissions();
    const name = screen.getByPlaceholderText('例如：财务管理员');

    await user.clear(name);
    await user.type(name, '财务主管');
    await user.click(screen.getByRole('button', { name: '保存修改' }));
    await screen.findByText(/“财务主管”已保存/);
    expect(writes[0]?.body).toEqual({ name: '财务主管', permissions: ['finance.overview.read', 'order.read'] });
    expect(writes[0]?.expectedVersion).toBe('"1"');

    await waitFor(() =>
      expect(
        within(screen.getByRole('navigation', { name: '角色详情' }))
          .getByRole('button', { name: '权限配置' })
          .getAttribute('aria-selected')
      ).toBe('true')
    );
    await openRolePermissions('财务主管');
    await user.click(within(screen.getByRole('region', { name: '选择功能权限' })).getByRole('button', { name: /^订单与售后/ }));
    await user.click(screen.getByRole('checkbox', { name: /catalog\.product\.manage/ }));
    await user.click(screen.getByRole('button', { name: '保存修改' }));
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
    await openRolePermissions();

    await user.click(within(screen.getByRole('region', { name: '选择功能权限' })).getByRole('button', { name: /^订单与售后/ }));
    await user.click(screen.getByRole('checkbox', { name: /catalog\.product\.manage/ }));
    await user.click(screen.getByRole('button', { name: '保存修改' }));

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
    await openRolePermissions();
    const name = screen.getByPlaceholderText('例如：财务管理员');
    await user.clear(name);
    await user.type(name, '冲突中的财务');
    await user.click(screen.getByRole('button', { name: '保存修改' }));

    expect((await screen.findByRole('alert')).textContent).toContain('版本冲突');
    expect(screen.getByText(/当前草稿未保存/)).toBeTruthy();
    expect(screen.queryByText(/已保存，并已通过正式接口/)).toBeNull();
  });

  it('shows explicit no-permission and real invitation-record states', async () => {
    const denied = { ...context, session: { ...context.session, permissions: [], capabilities: [] } };
    const view = renderWorkspace(denied);
    expect(screen.getByText('无权读取身份目录')).toBeTruthy();
    view.unmount();

    invitationRecords = [
      {
        id: 'invite:one',
        scope: 'tenant:one',
        scope_name: '主打团商户',
        label: '134****7586',
        governance_level: 'senior_administrator',
        created_by: 'membership:owner',
        created_by_name: 'Ethan',
        accepted_membership_id: null,
        invitee_name: null,
        destination_masked: '134****7586',
        max_uses: 1,
        use_count: 0,
        starts_at: '2026-09-02T12:00:00.000Z',
        expires_at: '2026-09-09T12:00:00.000Z',
        accepted_at: null,
        status: 'active',
        created_at: '2026-09-02T12:00:00.000Z',
        version: '0',
      },
      {
        id: 'invite:used',
        scope: 'tenant:one',
        scope_name: '主打团商户',
        label: '李厚亿 · 134****7586',
        governance_level: 'senior_administrator',
        created_by: 'membership:owner',
        created_by_name: 'Ethan',
        accepted_membership_id: 'membership:li',
        invitee_name: '李厚亿',
        destination_masked: '134****7586',
        max_uses: 1,
        use_count: 1,
        starts_at: '2026-09-01T12:00:00.000Z',
        expires_at: '2026-09-08T12:00:00.000Z',
        accepted_at: '2026-09-02T10:00:00.000Z',
        status: 'used',
        created_at: '2026-09-01T12:00:00.000Z',
        version: '1',
      },
      {
        id: 'invite:revoked',
        scope: 'tenant:one',
        scope_name: '主打团商户',
        label: '历史记录，邀请对象不可还原',
        governance_level: 'administrator',
        created_by: 'membership:owner',
        created_by_name: 'Ethan',
        accepted_membership_id: null,
        invitee_name: null,
        destination_masked: null,
        max_uses: 1,
        use_count: 0,
        starts_at: '2026-08-31T12:00:00.000Z',
        expires_at: '2026-09-07T12:00:00.000Z',
        accepted_at: null,
        status: 'revoked',
        created_at: '2026-08-31T12:00:00.000Z',
        version: '1',
      },
    ];
    renderWorkspace(context, '/scopes/tenant/tenant%3Aone/settings/access?section=invitations');
    expect(screen.getByRole('heading', { name: '邀请记录' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '生成管理员邀请码' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '邀请新成员' })).toBeNull();
    const table = await screen.findByRole('table', { name: '邀请记录，共 3 条' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map(({ textContent }) => textContent)
    ).toEqual(['被邀请人', '邀请人', '管理员级别', '状态', '创建时间', '接受时间', '操作']);
    expect(within(table).getAllByRole('row')).toHaveLength(4);
    const liRow = within(table).getByText('李厚亿 · 134****7586').closest('tr');
    expect(liRow).not.toBeNull();
    expect(within(liRow as HTMLElement).getByText('Ethan')).toBeTruthy();
    expect(within(table).getByText('历史记录，邀请对象不可还原')).toBeTruthy();
    expect(within(table).getAllByText('高级管理员')).toHaveLength(2);
    expect(within(table).getByText('未使用')).toBeTruthy();
    expect(within(table).getByText('已使用')).toBeTruthy();
    expect(within(table).getByText('已作废')).toBeTruthy();
  });

  it('reads invitation records for an administrator with the granted permission and capability', async () => {
    invitationRecords = [
      {
        id: 'invite:administrator',
        scope: 'tenant:one',
        scope_name: '主打团商户',
        label: '管理员发起的邀请',
        governance_level: 'administrator',
        created_by: 'membership:administrator',
        created_by_name: '小白管理员',
        accepted_membership_id: null,
        invitee_name: null,
        destination_masked: '138****0000',
        max_uses: 1,
        use_count: 0,
        starts_at: '2026-09-10T12:00:00.000Z',
        expires_at: '2026-09-17T12:00:00.000Z',
        accepted_at: null,
        status: 'active',
        created_at: '2026-09-10T12:00:00.000Z',
        version: '0',
      },
    ];
    const administrator = {
      ...context,
      session: {
        ...context.session,
        governance: { level: 'administrator' as const, exactOwner: false, organization: 'tenant:one' },
      },
    };

    renderWorkspace(administrator, '/scopes/tenant/tenant%3Aone/settings/access?section=invitations');

    const table = await screen.findByRole('table', { name: '邀请记录，共 1 条' });
    expect(within(table).getByText('138****0000')).toBeTruthy();
    expect(within(table).getByText('小白管理员')).toBeTruthy();
    expect(screen.queryByText('无权读取邀请记录')).toBeNull();
  });

  it('deletes only an unused invitation through the existing revoke operation and refreshes its history', async () => {
    invitationRecords = [{
      id: 'invite:unused', scope: 'tenant:one', scope_name: '主打团商户', label: '138****0000',
      governance_level: 'administrator', created_by: 'membership:owner', created_by_name: 'Ethan',
      accepted_membership_id: null, invitee_name: null, destination_masked: '138****0000',
      max_uses: 1, use_count: 0, starts_at: '2026-09-17T08:00:00.000Z',
      expires_at: '2026-09-24T08:00:00.000Z', accepted_at: null, status: 'active',
      created_at: '2026-09-17T08:00:00.000Z', version: '0',
    }, {
      id: 'invite:used', scope: 'tenant:one', scope_name: '主打团商户', label: '139****0000',
      governance_level: 'administrator', created_by: 'membership:owner', created_by_name: 'Ethan',
      accepted_membership_id: 'membership:used', invitee_name: null, destination_masked: '139****0000',
      max_uses: 1, use_count: 1, starts_at: '2026-09-17T08:00:00.000Z',
      expires_at: '2026-09-24T08:00:00.000Z', accepted_at: '2026-09-17T09:00:00.000Z', status: 'used',
      created_at: '2026-09-17T08:00:00.000Z', version: '1',
    }];
    const deleted: Array<{ id: string; version: string | null; reason: string }> = [];
    server.use(http.delete('*/api/v1/identity/invitations/:invitationId', async ({ request, params }) => {
      const body = await request.json() as { reason: string };
      deleted.push({ id: String(params.invitationId), version: request.headers.get('if-match'), reason: body.reason });
      invitationRecords = invitationRecords.map((record) => record.id === params.invitationId
        ? { ...record, status: 'revoked', version: '1' } : record);
      return HttpResponse.json({ id: String(params.invitationId), status: 'disabled', version: 1 });
    }));
    const withRevoke = { ...context, session: { ...context.session,
      capabilities: [...context.session.capabilities, 'identity.invitations.revoke'],
    } };
    const user = userEvent.setup();
    renderWorkspace(withRevoke, '/scopes/tenant/tenant%3Aone/settings/access?section=invitations');
    const table = await screen.findByRole('table', { name: '邀请记录，共 2 条' });
    expect(within(table).getByRole('button', { name: '删除邀请码 138****0000' })).toBeTruthy();
    expect(within(table).queryByRole('button', { name: '删除邀请码 139****0000' })).toBeNull();

    await user.click(within(table).getByRole('button', { name: '删除邀请码 138****0000' }));

    expect(await screen.findByText('邀请码已作废，历史记录仍保留。')).toBeTruthy();
    await waitFor(() => expect(within(table).getByText('已作废')).toBeTruthy());
    expect(deleted).toEqual([{ id: 'invite:unused', version: '"0"', reason: '管理员删除未使用邀请码' }]);
    expect(within(table).queryByRole('button', { name: '删除邀请码 138****0000' })).toBeNull();
  });

  it('refreshes invitation records after a successful administrator invitation', async () => {
    server.use(http.post('*/api/v1/identity/invitations', () => {
      invitationRecords = [{
        id: 'invite:new', scope: 'tenant:one', scope_name: '主打团商户',
        label: '138****0000', governance_level: 'administrator',
        created_by: 'membership:owner', created_by_name: 'Ethan',
        accepted_membership_id: null, invitee_name: null, destination_masked: '138****0000',
        max_uses: 1, use_count: 0, starts_at: '2026-09-17T08:00:00.000Z',
        expires_at: '2026-09-24T08:00:00.000Z', accepted_at: null,
        status: 'active', created_at: '2026-09-17T08:00:00.000Z', version: '0',
      }];
      return HttpResponse.json({
        id: 'invite:new', code: 'AAAAAAAAAA', label: '管理员邀请', target: 'console',
        max_uses: 1, use_count: 0, starts_at: '2026-09-17T08:00:00.000Z',
        expires_at: '2026-09-24T08:00:00.000Z', status: 'active',
        created_at: '2026-09-17T08:00:00.000Z', version: '0',
      }, { status: 201 });
    }));
    const user = userEvent.setup();
    renderWorkspace(context, '/scopes/tenant/tenant%3Aone/settings/access?section=invitations');
    expect(await screen.findByText('还没有邀请记录')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '生成管理员邀请码' }));
    const dialog = await screen.findByRole('dialog', { name: '邀请管理员' });
    await user.type(within(dialog).getByLabelText('受邀管理员手机号'), '13800138000');
    await user.click(within(dialog).getByRole('button', { name: '生成管理员邀请' }));
    const receipt = await screen.findByRole('dialog', { name: '管理员邀请已生成' });
    await user.click(within(receipt).getByRole('button', { name: '完成' }));

    const table = await screen.findByRole('table', { name: '邀请记录，共 1 条' });
    expect(within(table).getByText('138****0000')).toBeTruthy();
    expect(invitationReads).toBeGreaterThan(1);
  });

  it('assigns two custom identities to one member and rereads their overlaid permissions and Access Version', async () => {
    members = [memberFixture()];
    syncRoleMetadata();
    const user = userEvent.setup();
    renderWorkspace();
    await openRoleMembers();

    await user.click(screen.getByRole('button', { name: '＋ 分配成员' }));
    await user.click(screen.getByRole('button', { name: '确认分配并重读' }));
    expect(await screen.findByText(/“财务观察”已分配给 张三/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /运营协作/ }));
    await openRoleMembers('运营协作');
    await user.click(screen.getByRole('button', { name: '＋ 分配成员' }));
    await user.click(screen.getByRole('button', { name: '确认分配并重读' }));
    expect(await screen.findByText(/“运营协作”已分配给 张三/)).toBeTruthy();

    expect(members[0]?.roles.map(({ role }) => role).sort()).toEqual(['role-finance', 'role-operations']);
    expect(members[0]?.effective_permissions).toEqual(['catalog.product.manage', 'finance.overview.read', 'order.read']);
    expect(members[0]?.access_version).toBe('5');
    expect(assignmentWrites.map(({ body }) => body.action)).toEqual(['assign', 'assign']);
    expect(reads).toBeGreaterThanOrEqual(3);
  });

  it('lets the authoritative Owner principal upgrade and demote an administrator from the senior role template', async () => {
    roles.push({ id: 'role-senior-administrator-v1:tenant:one', name: '高级管理员', status: 'active', version: '1',
      permissions: ['order.read', 'member.members.read'], member_count: '0', governance: true,
      governance_level: 'senior_administrator', editable: false, members: [], scopes: [] });
    const member = memberFixture();
    member.roles.push(assignment('role-finance', '财务观察', tenantScope, 'direct'));
    members = [member];
    recompute(member);
    syncRoleMetadata();
    const user = userEvent.setup();
    const mallOwner: ConsoleContext = { ...context, scope: mallScope, scopes: [tenantScope, mallScope],
      session: { ...context.session, scope: mallScope, scopes: [tenantScope, mallScope],
        governance: { ...context.session.governance!, exactOwner: false } } };

    renderWorkspace(mallOwner, '/scopes/mall/mall%3Aone/settings/access?role=role-senior-administrator-v1%3Atenant%3Aone&view=members');

    await user.click(await screen.findByRole('button', { name: '升级为高级管理员' }));
    expect(screen.getByText('选择要升级的普通管理员')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '确认升级并重读' }));
    expect(await screen.findByText(/已升级为高级管理员/)).toBeTruthy();
    expect(member.roles.map(({ role }) => role).sort()).toEqual([
      'role-finance', 'role-senior-administrator-v1:tenant:one',
    ]);
    expect(assignmentWrites[0]?.body).toMatchObject({ action: 'assign', kind: 'tenant', scope: 'tenant:one' });

    await user.click(screen.getByRole('button', { name: '降级为普通管理员' }));
    expect(await screen.findByText(/已降级为普通管理员/)).toBeTruthy();
    expect(member.roles.map(({ role }) => role)).toEqual(['role-finance']);
    expect(member.effective_permissions).toEqual(['finance.overview.read', 'order.read']);
    expect(assignmentWrites.map(({ body }) => body.action)).toEqual(['assign', 'revoke']);
  });

  it('keeps senior administrator scheduling read-only for non-Owner sessions', async () => {
    roles.push({ id: 'role-senior-administrator-v1:tenant:one', name: '高级管理员', status: 'active', version: '1',
      permissions: ['order.read'], member_count: '0', governance: true, governance_level: 'senior_administrator',
      editable: false, members: [], scopes: [] });
    members = [memberFixture()];
    syncRoleMetadata();
    const administrator: ConsoleContext = { ...context, session: { ...context.session,
      governance: { level: 'administrator', exactOwner: false, organization: 'tenant:one' } } };

    renderWorkspace(administrator, '/scopes/tenant/tenant%3Aone/settings/access?role=role-senior-administrator-v1%3Atenant%3Aone&view=members');

    expect(await screen.findByText('只有当前唯一 Owner 可以升级或降级高级管理员。')).toBeTruthy();
    expect((screen.getByRole('button', { name: '升级为高级管理员' }) as HTMLButtonElement).disabled).toBe(true);
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
    await openRoleMembers();

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
    await openRoleMembers();

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
        <ConsoleContextProvider value={value}>
          <Component />
        </ConsoleContextProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

async function openRolePermissions(roleName = '财务观察') {
  await screen.findByRole('heading', { name: roleName });
  fireEvent.click(within(screen.getByRole('navigation', { name: '角色详情' })).getByRole('button', { name: /^权限/ }));
  await screen.findByPlaceholderText('例如：财务管理员');
}

async function openRoleMembers(roleName = '财务观察') {
  await screen.findByRole('heading', { name: roleName });
  fireEvent.click(within(screen.getByRole('navigation', { name: '角色详情' })).getByRole('button', { name: /^成员与范围/ }));
  await screen.findByRole('button', { name: '＋ 分配成员' });
}

function renderSwitchWorkspace() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={['/scopes/tenant/tenant%3Aone/settings/members']}>
      <QueryClientProvider client={client}>
        <ConsoleContextProvider value={context}>
          <Routes>
            <Route path="/scopes/:scopeKind/:scopeId/settings/members" element={<MemberAccessWorkspace primary="members" />} />
            <Route path="/scopes/:scopeKind/:scopeId/settings/access" element={<Component />} />
          </Routes>
        </ConsoleContextProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

const tenantScope = { kind: 'tenant', id: 'tenant:one', tenant: 'tenant:one', name: '主打团商户' } as const;
const mallScope: WireScope = { kind: 'mall', id: 'mall:one', tenant: tenantScope.id, name: '一号商城', path: [{ kind: 'tenant', id: tenantScope.id }] };
const context: ConsoleContext = {
  session: {
    actor: 'actor:owner',
    membership: 'membership:owner',
    accessVersion: 7,
    permissions: ['access.center.read', 'access.role.manage', 'access.scope.manage', 'identity.invitation.manage'],
    capabilities: ['access.center.read', 'access.roles.manage', 'access.scopes.manage', 'identity.invitations.create', 'member.invitations.read'],
    governance: { level: 'owner', exactOwner: true, organization: 'tenant:one' },
    assurance: { level: 2 },
    target: 'console',
    scope: tenantScope,
    scopes: [tenantScope, mallScope],
    csrf: 'csrf:test',
    syncedAt: '2026-09-01T00:00:00.000Z',
  },
  profile: { display_name: 'Ethan', employee_no: null },
  scope: tenantScope,
  scopes: [tenantScope, mallScope],
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

interface RoleWriteBody {
  name: string;
  permissions: string[];
}
interface RoleAssignmentBody {
  action: 'assign' | 'revoke';
  membership: string;
  kind: WireScope['kind'];
  scope: string;
  scopeSource: 'direct' | 'inherited';
}

const outsideMallScope: WireScope = { kind: 'mall', id: 'mall:outside', tenant: 'tenant:outside', name: '范围外商城', path: [{ kind: 'tenant', id: 'tenant:outside' }] };

function memberFixture(): WireMembership {
  return {
    id: 'membership:zhangsan',
    status: 'active',
    access_version: '3',
    member_id: 'member:zhangsan',
    display_name: '张三',
    employee_no: 'EMP003',
    roles: [],
    scopes: [scopeGrant(tenantScope)],
    denies: [],
    effective_permissions: [],
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
  return { action: body.action, changed, role: roleId, membership: member.id, scope, scope_source: body.scopeSource, access_version: member.access_version };
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
  member.effective_permissions = [...new Set(member.roles.flatMap((item) => roles.find(({ id }) => id === item.role)?.permissions ?? []))].filter((permission) => !denied.has(permission)).sort();
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
    return {
      ...role,
      member_count: String(new Set(assigned.map(({ member }) => member.id)).size),
      members: assigned.map(({ member, item }) => ({
        membership: member.id,
        member_id: member.member_id,
        display_name: member.display_name,
        employee_no: member.employee_no,
        access_version: member.access_version,
        scope: item.scope,
        scope_source: item.scope_source,
        effective_at: item.effective_at,
        expires: null,
      })),
      scopes: [...scopeMembers.values()].map((item) => ({ scope: item.scope, source: item.source, member_count: String(item.members.size) })),
    };
  });
}

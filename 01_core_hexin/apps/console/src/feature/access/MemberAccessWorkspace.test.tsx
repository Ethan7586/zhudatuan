import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, delay, http } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ConsoleContextProvider } from '../../entity/session/ConsoleContext';
import type { ConsoleContext, ConsoleScope } from '../../entity/session/ConsoleSession';
import { memberKey } from '../member/MemberQuery';
import { MemberAccessWorkspace } from './MemberAccessWorkspace';

const scope: ConsoleScope = { kind: 'platform', id: 'organization-platform-root', name: '主打团平台' };
const context: ConsoleContext = {
  session: {
    actor: 'principal:owner',
    membership: 'membership:owner',
    accessVersion: 7,
    permissions: [],
    capabilities: ['member.members.read'],
    target: 'console',
    scope,
    scopes: [scope],
    assurance: { level: 2 },
    syncedAt: '2026-09-02T11:14:00.000Z',
  },
  profile: { display_name: 'Ethan', employee_no: null },
  scope,
  scopes: [scope],
};

const server = setupServer(
  http.get('*/api/v1/members', async ({ request }) => {
    const cursor = new URL(request.url).searchParams.get('cursor');
    if (cursor !== null) {
      await delay(250);
      return HttpResponse.json({ items: [member('member:second', '第二页成员')], count: 1 });
    }
    return HttpResponse.json({
      items: [member('member:first', '第一页成员')],
      count: 1,
      nextCursor: 'cursor:second',
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

describe('member directory pagination', () => {
  it('keeps the current page visible while the next cursor page loads', async () => {
    const user = userEvent.setup();
    const view = renderWorkspace();

    expect((await screen.findAllByText('第一页成员')).length).toBeGreaterThan(0);
    expect(view.container.querySelector('.storefrontmembersworkspace')).not.toBeNull();
    expect(view.container.querySelector('.storefrontmemberstage')).not.toBeNull();
    await user.click(screen.getByRole('row', { name: '查看管理员 第一页成员' }));
    expect(screen.getByText('治理邀请人')).toBeTruthy();
    expect(screen.getByText('Ethan')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '全屏查看成员目录' }));
    await user.click(screen.getByRole('button', { name: '下一页' }));

    expect(screen.getAllByText('第一页成员').length).toBeGreaterThan(0);
    expect(screen.queryByText('正在读取真实会员与授权关系…')).toBeNull();
    expect(screen.getByRole('button', { name: '加载中…' }).hasAttribute('disabled')).toBe(true);

    expect((await screen.findAllByText('第二页成员')).length).toBeGreaterThan(0);
    expect(screen.queryAllByText('第一页成员')).toHaveLength(0);
  });

  it('uses operator member rows as the only directory source and only enriches matching rows with access data', async () => {
    const sharedOperator = {
      ...member('operator:shared', '同主体管理员'),
      membership_id: 'membership:operator:shared',
      principal_id: 'principal:shared',
    };
    const sharedStorefront = {
      ...member('storefront:shared', '同主体 L6 会员'),
      membership_id: 'membership:storefront:shared',
      principal_id: 'principal:shared',
      client: 'storefront' as const,
    };
    server.use(
      http.get('*/api/v1/members', () => HttpResponse.json({ items: [sharedOperator, sharedStorefront], count: 2 })),
      http.get('*/api/v1/access/center', () => HttpResponse.json({
        items: [
          accessMembership('membership:operator:shared', '同主体管理员', true),
          accessMembership('membership:role-only', '权限角色幽灵', true),
          accessMembership('membership:owner', '当前登录者', false),
        ],
        count: 3,
        roles: [],
      })),
    );

    renderWorkspace({
      ...context,
      session: { ...context.session, capabilities: ['member.members.read', 'access.center.read'] },
    });

    expect(await screen.findByRole('row', { name: '查看管理员 同主体管理员' })).toBeTruthy();
    expect((await screen.findAllByText('高级管理员')).length).toBeGreaterThan(0);
    expect(screen.queryByText('同主体 L6 会员')).toBeNull();
    expect(screen.queryByText('权限角色幽灵')).toBeNull();
    expect(screen.queryByText('当前登录者')).toBeNull();
  });

  it('shows the authoritative administrator mobile in the directory and detail panel', async () => {
    const target = { ...member('target', '李厚亿'), mobile: '19287247586', mobile_masked: '192****7586' };
    server.use(
      http.get('*/api/v1/members', () => HttpResponse.json({ items: [target], count: 1 })),
      http.get('*/api/v1/access/center', () => HttpResponse.json({
        items: [accessMembership('membership:target', '李厚亿', true)], count: 1, roles: [],
      })),
    );
    const user = userEvent.setup();

    renderWorkspace();

    expect(await screen.findByText('19287247586')).toBeTruthy();
    await user.click(screen.getByRole('row', { name: '查看管理员 李厚亿' }));
    expect(screen.getByText('管理员手机号')).toBeTruthy();
    expect(screen.getAllByText('19287247586')).toHaveLength(2);
  });

  it('upgrades an ordinary administrator from the detail panel and verifies the authoritative reread', async () => {
    let senior = false;
    let requestBody: unknown;
    const tenantScope: ConsoleScope = { kind: 'tenant', id: 'tenant-zhudatuan', name: '宏泰甄选' };
    const target = { ...member('target', '李厚亿'), mobile: '19287247586' };
    const seniorRole = () => ({ id: 'role-senior-administrator-v1:tenant-zhudatuan', name: '高级管理员', status: 'active' as const,
      version: 1, permissions: ['member.members.read'], member_count: senior ? 1 : 0, governance: true,
      governance_level: 'senior_administrator' as const, editable: false,
      members: senior ? [{ membership: 'membership:target', member_id: 'member:membership:target', display_name: '李厚亿',
        employee_no: null, access_version: 8, scope: tenantScope, scope_source: 'direct' as const,
        effective_at: '2026-09-01T00:00:00.000Z', expires: null }] : [],
      scopes: [{ scope: tenantScope, source: 'direct' as const, member_count: senior ? 1 : 0 }] });
    server.use(
      http.get('*/api/v1/members', () => HttpResponse.json({ items: [{ ...target, access_version: senior ? 8 : 7 }], count: 1 })),
      http.get('*/api/v1/access/center', () => HttpResponse.json({
        items: [{ ...accessMembership('membership:target', '李厚亿', senior), access_version: senior ? 8 : 7,
          roles: senior ? accessMembership('membership:target', '李厚亿', true).roles.map((role) => ({ ...role, scope: tenantScope })) : [],
          scopes: senior ? [{ id: 'scope:target', kind: tenantScope.kind, scope: tenantScope.id, effect: 'allow', expires: null }] : [],
          effective_permissions: senior ? ['member.members.read'] : [] }],
        count: 1,
        roles: [seniorRole()],
      })),
      http.put('*/api/v1/access/roles/:roleid', async ({ request }) => {
        requestBody = await request.json();
        senior = true;
        return HttpResponse.json({ action: 'assign', changed: true,
          role: 'role-senior-administrator-v1:tenant-zhudatuan', membership: 'membership:target', scope: tenantScope,
          scope_source: 'direct', access_version: 8 });
      }),
    );
    const user = userEvent.setup();
    renderWorkspace(ownerContext(tenantScope));
    await user.click(await screen.findByRole('row', { name: '查看管理员 李厚亿' }));

    await user.click(screen.getByRole('button', { name: '升级为高级管理员' }));

    expect((await screen.findAllByText('高级管理员')).length).toBeGreaterThan(0);
    expect(requestBody).toMatchObject({ action: 'assign', membership: 'membership:target',
      kind: 'tenant', scope: 'tenant-zhudatuan', scopeSource: 'direct' });
    expect(screen.queryByRole('button', { name: '升级为高级管理员' })).toBeNull();
    expect(screen.getByRole('button', { name: '降级为普通管理员' })).toBeTruthy();
  });

  it('keeps cached members visible when the background refresh fails', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    client.setQueryData(memberKey(context), { items: [member('member:cached', '缓存会员')], count: 1 });
    server.use(http.get('*/api/v1/members', async () => {
      await delay(20);
      return HttpResponse.json({ code: 'MEMBER_REFRESH_UNAVAILABLE' }, { status: 503 });
    }));

    renderWorkspace(context, client);

    expect(await screen.findByRole('row', { name: '查看管理员 缓存会员' })).toBeTruthy();
    expect(await screen.findByText('刷新失败，已保留已有会员名单')).toBeTruthy();
    expect(screen.getByRole('row', { name: '查看管理员 缓存会员' })).toBeTruthy();
  });

  it('offboards the operator identity only after confirmation and removes it after authoritative reread', async () => {
    let offboarded = false;
    server.use(
      http.get('*/api/v1/members', () => HttpResponse.json(offboarded
        ? { items: [], count: 0 }
        : { items: [{ ...member('target', '高级管理员 · 7586'), mobile: '19287247586' }], count: 1 })),
      http.get('*/api/v1/access/center', () => HttpResponse.json(offboarded
        ? { items: [], count: 0, roles: [] }
        : { items: [accessMembership('membership:target', '高级管理员 · 7586', true)], count: 1, roles: [] })),
      http.put('*/api/v1/access/roles/:roleid', () => {
        offboarded = true;
        return HttpResponse.json({ action: 'offboard', changed: true, membership: 'membership:target',
          status: 'offboarded', access_version: 8 });
      }),
    );
    const user = userEvent.setup();
    renderWorkspace(ownerContext());
    await user.click(await screen.findByRole('row', { name: '查看管理员 高级管理员 · 7586' }));

    await user.click(screen.getByRole('button', { name: '删除管理员' }));
    expect(screen.getByText('只移除管理身份；商城 L 等级、订单与会员关系不会改变。再次点击确认。')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '确认移除管理员' }));

    expect(await screen.findByText('暂无管理员')).toBeTruthy();
    expect(screen.queryByRole('row', { name: '查看管理员 高级管理员 · 7586' })).toBeNull();
  });

  it('lets a senior administrator remove an ordinary administrator without exposing peer-governance controls', async () => {
    let offboarded = false;
    const target = { ...member('target', '普通管理员 · 7586'), mobile: '19287247586' };
    server.use(
      http.get('*/api/v1/members', () => HttpResponse.json(offboarded
        ? { items: [], count: 0 }
        : { items: [target], count: 1 })),
      http.get('*/api/v1/access/center', () => HttpResponse.json({
        items: offboarded ? [] : [accessMembership('membership:target', '普通管理员 · 7586', false)], count: offboarded ? 0 : 1,
        roles: [{ id: 'role-senior-administrator-v1:tenant-zhudatuan', name: '高级管理员', status: 'active',
          version: 1, permissions: ['member.members.read'], member_count: 1, governance: true,
          governance_level: 'senior_administrator', editable: false, members: [], scopes: [] }],
      })),
      http.put('*/api/v1/access/roles/:roleid', () => {
        offboarded = true;
        return HttpResponse.json({ action: 'offboard', changed: true, membership: 'membership:target',
          status: 'offboarded', access_version: 8 });
      }),
    );
    const user = userEvent.setup();

    renderWorkspace(seniorAdministratorContext());
    await user.click(await screen.findByRole('row', { name: '查看管理员 普通管理员 · 7586' }));

    expect(screen.getByRole('button', { name: '删除管理员' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '升级为高级管理员' })).toBeNull();
    expect(screen.queryByRole('button', { name: '降级为普通管理员' })).toBeNull();
    await user.click(screen.getByRole('button', { name: '删除管理员' }));
    await user.click(screen.getByRole('button', { name: '确认移除管理员' }));
    expect(await screen.findByText('暂无管理员')).toBeTruthy();
  });

  it('does not let a senior administrator manage a peer senior administrator', async () => {
    const target = { ...member('target', '高级管理员 · 7586'), mobile: '19287247586' };
    server.use(
      http.get('*/api/v1/members', () => HttpResponse.json({ items: [target], count: 1 })),
      http.get('*/api/v1/access/center', () => HttpResponse.json({
        items: [accessMembership('membership:target', '高级管理员 · 7586', true)], count: 1, roles: [],
      })),
    );
    const user = userEvent.setup();

    renderWorkspace(seniorAdministratorContext());
    await user.click(await screen.findByRole('row', { name: '查看管理员 高级管理员 · 7586' }));

    expect(screen.queryByRole('button', { name: '删除管理员' })).toBeNull();
    expect(screen.queryByRole('button', { name: '降级为普通管理员' })).toBeNull();
  });

  it('demotes a senior administrator from the detail panel and verifies the authoritative reread', async () => {
    let senior = true;
    let requestBody: unknown;
    const target = { ...member('target', '高级管理员 · 7586'), mobile: '19287247586' };
    server.use(
      http.get('*/api/v1/members', () => HttpResponse.json({ items: [{ ...target,
        display_name: senior ? '高级管理员 · 7586' : '管理员 · 7586', access_version: senior ? 7 : 8 }], count: 1 })),
      http.get('*/api/v1/access/center', () => HttpResponse.json({
        items: [{ ...accessMembership('membership:target', senior ? '高级管理员 · 7586' : '管理员 · 7586', senior),
          access_version: senior ? 7 : 8, effective_permissions: senior ? ['member.members.read'] : [] }],
        count: 1,
        roles: [{ id: 'role-senior-administrator-v1:tenant-zhudatuan', name: '高级管理员', status: 'active',
          version: 1, permissions: ['member.members.read'], member_count: senior ? 1 : 0, governance: true,
          governance_level: 'senior_administrator', editable: false, members: [], scopes: [] }],
      })),
      http.put('*/api/v1/access/roles/:roleid', async ({ request }) => {
        requestBody = await request.json();
        senior = false;
        return HttpResponse.json({ action: 'revoke', changed: true,
          role: 'role-senior-administrator-v1:tenant-zhudatuan', membership: 'membership:target', scope,
          scope_source: 'direct', access_version: 8 });
      }),
    );
    const user = userEvent.setup();
    renderWorkspace(ownerContext());
    await user.click(await screen.findByRole('row', { name: '查看管理员 高级管理员 · 7586' }));

    await user.click(screen.getByRole('button', { name: '降级为普通管理员' }));

    expect((await screen.findAllByText('管理员 · 7586')).length).toBeGreaterThan(0);
    expect(requestBody).toMatchObject({ action: 'revoke', membership: 'membership:target',
      scope: 'organization-platform-root', scopeSource: 'direct' });
    expect(screen.queryByRole('button', { name: '降级为普通管理员' })).toBeNull();
  });

});

function renderWorkspace(value: ConsoleContext = context, client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })) {
  return render(
    <MemoryRouter initialEntries={['/scopes/platform/organization-platform-root/settings/members']}>
      <QueryClientProvider client={client}>
        <ConsoleContextProvider value={value}>
          <MemberAccessWorkspace primary="members" />
        </ConsoleContextProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

function ownerContext(extraScope?: ConsoleScope): ConsoleContext {
  return {
    ...context,
    scopes: extraScope === undefined ? context.scopes : [...context.scopes, extraScope],
    session: {
      ...context.session,
      permissions: ['access.role.manage', 'access.scope.manage'],
      capabilities: ['member.members.read', 'access.center.read', 'access.roles.manage'],
      csrf: 'csrf:owner',
      governance: { level: 'owner', organization: 'tenant-zhudatuan', exactOwner: true },
      scopes: extraScope === undefined ? context.session.scopes : [...context.session.scopes, extraScope],
    },
  };
}

function seniorAdministratorContext(): ConsoleContext {
  const value = ownerContext();
  return { ...value, session: { ...value.session, membership: 'membership:senior',
    governance: { ...value.session.governance!, level: 'senior_administrator', exactOwner: false } } };
}

function accessMembership(id: string, displayName: string, managementRole: boolean) {
  return {
    id,
    status: 'active',
    access_version: 7,
    member_id: `member:${id}`,
    display_name: displayName,
    employee_no: null,
    roles: managementRole ? [{
      role: 'role-senior-administrator-v1:tenant-zhudatuan',
      name: '高级管理员',
      scope,
      scope_source: 'direct',
      effective_at: '2026-09-01T00:00:00.000Z',
      expires: null,
    }] : [],
    scopes: [{ id: `scope:${id}`, kind: scope.kind, scope: scope.id, effect: 'allow', expires: null }],
    denies: [],
    effective_permissions: ['member.members.read'],
  };
}

function member(id: string, displayName: string) {
  return {
    id,
    display_name: displayName,
    status: 'active',
    membership_id: `membership:${id}`,
    employee_no: null,
    membership_status: 'active',
    access_version: 7,
    joined_at: '2026-09-02T03:28:35.000Z',
    principal_id: `principal:${id}`,
    principal_version: 1,
    client: 'operator',
    login_identity_bound: true,
    reset_allowed: false,
    reset_block_reason: null,
    governance_parent_membership_id: 'membership:owner',
    governance_parent_name: 'Ethan',
  };
}

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
    const target = { ...member('target', '高级管理员 · 7586'), mobile: '19287247586', mobile_masked: '192****7586' };
    server.use(
      http.get('*/api/v1/members', () => HttpResponse.json({ items: [target], count: 1 })),
      http.get('*/api/v1/access/center', () => HttpResponse.json({
        items: [accessMembership('membership:target', '高级管理员 · 7586', true)], count: 1, roles: [],
      })),
    );
    const user = userEvent.setup();

    renderWorkspace();

    expect(await screen.findByText('19287247586')).toBeTruthy();
    await user.click(screen.getByRole('row', { name: '查看管理员 高级管理员 · 7586' }));
    expect(screen.getByText('管理员手机号')).toBeTruthy();
    expect(screen.getAllByText('19287247586')).toHaveLength(2);
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

function accessMembership(id: string, displayName: string, managementRole: boolean) {
  return {
    id,
    status: 'active',
    access_version: 7,
    member_id: `member:${id}`,
    display_name: displayName,
    employee_no: null,
    roles: managementRole ? [{
      role: 'role:senior-administrator',
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

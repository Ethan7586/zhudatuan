import { PERMISSION_CATALOG } from '@shop/authz';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
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
}

let roles: WireRole[] = [];
let writes: Readonly<{ body: Readonly<{ name: string; permissions: string[] }>; expectedVersion: string | null; roleId: string }>[] = [];
let conflict = false;
let reads = 0;

const server = setupServer(
  http.get('*/api/v1/access/center', () => {
    reads += 1;
    return HttpResponse.json({ items: [], count: 0, roles });
  }),
  http.put('*/api/v1/access/roles/:roleId', async ({ request, params }) => {
    const body = await request.json() as { name: string; permissions: string[] };
    writes = [...writes, { body, expectedVersion: request.headers.get('if-match'), roleId: String(params.roleId) }];
    if (conflict) return HttpResponse.json({ code: 'VERSION_CONFLICT', message: 'stale role version', requestId: 'request:conflict' }, { status: 409 });
    const current = roles.find(({ id }) => id === params.roleId);
    const version = current === undefined ? 0 : Number(current.version) + 1;
    const saved: WireRole = {
      id: String(params.roleId), name: body.name, permissions: body.permissions, status: 'active', version: String(version),
      member_count: current?.member_count ?? '0', governance: false, editable: true,
    };
    roles = [...roles.filter(({ id }) => id !== saved.id), saved];
    return HttpResponse.json(saved);
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  roles = initialRoles();
  writes = [];
  conflict = false;
  reads = 0;
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

describe('custom identity and permission directory', () => {
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

  it('shows explicit no-permission and truthful invitation-record states', async () => {
    const denied = { ...context, session: { ...context.session, permissions: [], capabilities: [] } };
    const view = renderWorkspace(denied);
    expect(screen.getByText('无权读取身份目录')).toBeTruthy();
    view.unmount();

    renderWorkspace(context, '/scopes/tenant/tenant%3Aone/settings/access?section=invitations');
    expect(screen.getByRole('heading', { name: '邀请记录' })).toBeTruthy();
    expect(screen.getByText(/尚未提供邀请记录列表读取/)).toBeTruthy();
    expect(screen.getByText(/不会用模拟记录伪造闭环/)).toBeTruthy();
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
const context: ConsoleContext = {
  session: {
    actor: 'actor:owner', membership: 'membership:owner', accessVersion: 7,
    permissions: ['access.center.read', 'access.role.manage', 'identity.invitation.manage'],
    capabilities: ['access.center.read', 'access.roles.manage', 'identity.invitations.create'],
    assurance: { level: 2 }, target: 'console', scope: tenantScope, scopes: [tenantScope], csrf: 'csrf:test',
    syncedAt: '2026-09-01T00:00:00.000Z',
  },
  profile: { display_name: 'Ethan', employee_no: null }, scope: tenantScope, scopes: [tenantScope],
};

function initialRoles(): WireRole[] {
  return [
    { id: 'role-platform-owner-v2', name: '平台 Owner', status: 'active', version: '9', permissions: ['access.role.manage'], member_count: '1', governance: true, editable: false },
    { id: 'role-finance', name: '财务观察', status: 'active', version: '1', permissions: ['finance.overview.read', 'order.read'], member_count: '4', governance: false, editable: true },
  ];
}

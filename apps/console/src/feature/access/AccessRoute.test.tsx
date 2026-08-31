import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ConsoleContextProvider } from '../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { Component } from './AccessRoute';

const server = setupServer(
  http.get('*/api/v1/access/center', () => HttpResponse.json(accessPage())),
  http.get('*/api/v1/members', () => HttpResponse.json(memberPage()))
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

describe('classic member access workspace', () => {
  it('joins current member and access projections without dropping either capability', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MemoryRouter>
        <QueryClientProvider client={client}>
          <ConsoleContextProvider value={context}>
            <Component />
          </ConsoleContextProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );

    await screen.findByRole('table', { name: '成员管理' });
    expect(screen.getByRole('heading', { name: '会员与权限控制中心' })).toBeTruthy();
    expect((await screen.findAllByText('测试员工')).length).toBe(2);
    expect(screen.getAllByText('运营经理').length).toBeGreaterThan(0);
    expect(screen.getByText('福利商城主站')).toBeTruthy();
    expect(screen.getByText('客户服务中心')).toBeTruthy();
    expect(screen.getByText('成员管理与邀请码')).toBeTruthy();
  });
});

const tenantScope = { kind: 'tenant', id: 'tenant:one', tenant: 'tenant:one', name: '主打团租户' } as const;
const context: ConsoleContext = {
  session: {
    actor: 'actor:owner',
    membership: 'membership:owner',
    accessVersion: 7,
    permissions: ['access.center.read', 'member.read'],
    capabilities: ['access.center.read', 'member.members.read'],
    assurance: { level: 2 },
    target: 'console',
    scope: tenantScope,
    scopes: [tenantScope],
    syncedAt: '2026-08-29T00:00:00.000Z',
  },
  profile: { display_name: 'Ethan', employee_no: null },
  scope: tenantScope,
  scopes: [tenantScope],
};

function accessPage() {
  return {
    items: [
      {
        id: 'membership:employee',
        status: 'active',
        access_version: '7',
        roles: [{ role: 'role-operations', name: '运营经理' }],
        scopes: [
          { id: 'scope:mall', kind: 'mall', scope: '福利商城主站', effect: 'allow', expires: null },
          { id: 'scope:department', kind: 'department', scope: '客户服务中心', effect: 'deny', expires: null },
        ],
      },
    ],
    count: 1,
  };
}

function memberPage() {
  return {
    items: [
      {
        id: 'member:employee',
        display_name: '测试员工',
        status: 'active',
        membership_id: 'membership:employee',
        employee_no: 'OPS-001',
        membership_status: 'active',
        access_version: '7',
        joined_at: '2026-08-29T00:00:00.000Z',
        principal_id: 'principal:employee',
        principal_version: '11',
        client: 'operator',
        login_identity_bound: true,
        reset_allowed: false,
        reset_block_reason: 'OWNER_PROTECTED',
      },
    ],
    count: 1,
  };
}

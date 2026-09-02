import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router';
import { ConsoleContextProvider } from '../../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { Component } from './InvitationRoute';

const server = setupServer(
  http.get('*/api/v1/identity/invitations', () => HttpResponse.json({ items: [], count: 0 })),
  http.get('*/api/v1/access/center', () => HttpResponse.json({ items: [], count: 0 }))
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

describe('InvitationRoute assurance boundary', () => {
  it('explains why all invitation actions are unavailable below AAL2', async () => {
    renderRoute(context(1));
    expect(await screen.findByRole('heading', { level: 1, name: '员工邀请' })).toBeTruthy();
    expect((screen.getByRole('button', { name: '邀请员工' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '登录邀请' }) as HTMLButtonElement).disabled).toBe(true);
    expect(await screen.findByText('需要重新验证身份')).toBeTruthy();
    expect(screen.getByText(/员工邀请至少需要双因素验证/)).toBeTruthy();
  });

  it('enables employee enrollment at AAL2 while keeping signin and campaign at AAL3', async () => {
    renderRoute(context(2));
    expect(await screen.findByRole('heading', { level: 1, name: '员工邀请' })).toBeTruthy();
    expect((screen.getByRole('button', { name: '邀请员工' }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole('button', { name: '登录邀请' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '共享邀请' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

function renderRoute(value: ConsoleContext) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <ConsoleContextProvider value={value}>
          <Component />
        </ConsoleContextProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

function context(level: number): ConsoleContext {
  const scope = { kind: 'enterprise' as const, id: 'enterprise:one', name: '示例企业' };
  const mall = { kind: 'mall' as const, id: 'mall:one', name: '示例商城', path: [{ kind: 'platform' as const, id: 'platform' }, { kind: 'enterprise' as const, id: scope.id }, { kind: 'mall' as const, id: 'mall:one' }] };
  return {
    session: {
      actor: 'actor:one',
      membership: 'membership:one',
      accessVersion: 7,
      permissions: ['identity.invitation.issue', 'identity.invitation.read', 'identity.invitation.revoke'],
      capabilities: ['identity.invitations.create', 'identity.invitations.read', 'identity.invitations.revoke'],
      target: 'console',
      scope,
      scopes: [scope, mall],
      assurance: { level },
      security: { hasLocalCredential: true, phoneMasked: '138****8000', passwordChangedAt: null },
      csrf: 'csrf-token-long-enough',
      syncedAt: '2026-09-02T12:00:00.000Z',
    },
    profile: { display_name: '管理员', employee_no: null },
    scope,
    scopes: [scope, mall],
  };
}

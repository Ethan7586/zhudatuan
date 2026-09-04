import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router';
import { createConsoleDependencies } from '../../../app/Dependencies';
import { DependencyProvider } from '../../../app/DependencyContext';
import { ConsoleContextProvider } from '../../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { Component } from '../route/InvitationRoute';

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
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '邀请员工' }).disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '登录邀请' }).disabled).toBe(true);
    expect(await screen.findByText('需要重新验证身份')).toBeTruthy();
    expect(screen.getByText(/员工邀请至少需要双因素验证/)).toBeTruthy();
  });

  it('enables employee enrollment at AAL2 while keeping signin and campaign at AAL3', async () => {
    renderRoute(context(2));
    expect(await screen.findByRole('heading', { level: 1, name: '员工邀请' })).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '邀请员工' }).disabled).toBe(false);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '登录邀请' }).disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '共享邀请' }).disabled).toBe(true);
  });

  it('shows readable issuer and recipient accounts without exposing membership identifiers', async () => {
    server.use(
      http.get('*/api/v1/identity/invitations', () =>
        HttpResponse.json({
          items: [invitation()],
          count: 1,
        })
      )
    );
    renderRoute(context(3));

    expect(await screen.findByText('李小明')).toBeTruthy();
    expect(screen.getByText('员工号 E1002')).toBeTruthy();
    expect(screen.getByText('王主管')).toBeTruthy();
    expect(screen.getByText('员工号 E1001')).toBeTruthy();
    expect(screen.queryByText('membership:owner')).toBeNull();
    expect(screen.queryByText('membership:employee')).toBeNull();
  });

  it('reuses the infrastructure identity when the exact create command is retried', async () => {
    const identities: string[] = [];
    let attempts = 0;
    server.use(
      http.post('*/api/v1/identity/invitations', ({ request }) => {
        attempts += 1;
        identities.push(request.headers.get('idempotency-key') ?? '');
        if (attempts <= 3) return HttpResponse.json({ code: 'INTERNAL_ERROR', message: '暂时失败', requestId: `request:${attempts}`, retryable: true }, { status: 500 });
        return HttpResponse.json({
          id: 'invitation:new',
          kind: 'enrollment',
          target: 'storefront',
          organizationId: 'mall:one',
          maxUses: 1,
          useCount: 0,
          expiresAt: '2026-09-09T00:00:00.000Z',
          status: 'active',
          version: 1,
          code: 'SAFE-CODE',
          employee: { displayName: '李小明', employeeNo: 'E1002' },
        });
      })
    );
    const user = userEvent.setup();
    renderRoute(context(2));
    await user.click(await screen.findByRole('button', { name: '邀请员工' }));
    await user.type(screen.getByLabelText('姓名'), '李小明');
    await user.type(screen.getByLabelText('手机号'), '13900139000');
    await user.type(screen.getByLabelText('邀请原因'), '新员工入职');
    await user.click(screen.getByRole('button', { name: '创建员工邀请' }));
    await waitFor(() => expect(attempts).toBe(3));
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: '创建员工邀请' }));
    expect(await screen.findByLabelText('一次性邀请码')).toBeTruthy();
    expect(identities).toHaveLength(4);
    expect(identities[0]).toBeTruthy();
    expect(new Set(identities)).toEqual(new Set([identities[0]!]));
  });
});

function invitation() {
  return {
    id: 'invitation:one',
    kind: 'enrollment',
    target: 'storefront',
    organization_id: 'mall:one',
    membership_id: 'membership:employee',
    recipient_display_name: '李小明',
    recipient_employee_no: 'E1002',
    recipient_mobile_masked: '139****0002',
    issuer_membership_id: 'membership:owner',
    issuer_display_name: '王主管',
    issuer_employee_no: 'E1001',
    issuer_mobile_masked: '138****0001',
    issuer_access_version: 3,
    minimum_assurance: 2,
    max_uses: 1,
    use_count: 0,
    not_before: '2026-09-03T00:00:00.000Z',
    expires_at: '2026-09-06T00:00:00.000Z',
    status: 'active',
    reason: '新员工入职',
    created_at: '2026-09-03T00:00:00.000Z',
    revoked_at: null,
    revoked_by: null,
    revoke_reason: null,
    version: 1,
  } as const;
}

function renderRoute(value: ConsoleContext) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <DependencyProvider value={createConsoleDependencies()}>
          <ConsoleContextProvider value={value}>
            <Component />
          </ConsoleContextProvider>
        </DependencyProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

function context(level: number): ConsoleContext {
  const scope = { kind: 'enterprise' as const, id: 'enterprise:one', name: '示例企业' };
  const mall = {
    kind: 'mall' as const,
    id: 'mall:one',
    name: '示例商城',
    path: [
      { kind: 'platform' as const, id: 'platform' },
      { kind: 'enterprise' as const, id: scope.id },
      { kind: 'mall' as const, id: 'mall:one' },
    ],
  };
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

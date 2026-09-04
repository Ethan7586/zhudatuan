import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter, useLocation } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DependencyProvider } from '../../../../app/DependencyContext';
import { createConsoleDependencies } from '../../../../app/Dependencies';
import { ConsoleContextProvider } from '../../../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { StepupProvider } from '../../../../entity/session/StepupContext';
import { Component } from './MemberRoute';

const server = setupServer(
  http.get('*/api/v1/members', () =>
    HttpResponse.json({
      items: [
        {
          id: 'member:one',
          display_name: '李小明',
          status: 'active',
          membership_id: 'membership:internal',
          organization_id: 'mall:server-owned',
          employee_no: 'E1002',
          membership_status: 'suspended',
          access_version: 8,
          joined_at: '2026-09-03T00:00:00.000Z',
        },
      ],
      count: 1,
    })
  )
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

describe('MemberRoute', () => {
  it('renders service-owned member state and scope without exposing membership ids', async () => {
    renderRoute();
    expect(await screen.findByText('李小明')).toBeTruthy();
    expect(screen.getByText('已暂停')).toBeTruthy();
    expect(screen.getByText(/组织范围/)).toBeTruthy();
    expect(screen.queryByText('membership:internal')).toBeNull();
  });

  it('moves an accepted member import into the durable task center route', async () => {
    server.use(
      http.post('*/api/v1/members/imports', async ({ request }) => {
        expect(request.headers.get('idempotency-key')).toBeTruthy();
        expect(await request.json()).toEqual({ objectRef: 'object:clean:members', sha256: 'a'.repeat(64) });
        return HttpResponse.json(
          { id: 'memberimport:new', state: 'uploaded', total_count: 0, cursor_value: 0, success_count: 0, failure_count: 0, created_at: '2026-09-03T00:00:00.000Z', updated_at: '2026-09-03T00:00:00.000Z' },
          { status: 202 }
        );
      })
    );
    renderRoute(true);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '批量导入' }));
    await user.type(screen.getByLabelText('安全文件引用'), 'object:clean:members');
    await user.type(screen.getByLabelText('SHA-256 校验值'), 'a'.repeat(64));
    await user.click(screen.getByRole('button', { name: '进入长任务中心' }));
    expect((await screen.findByTestId('location')).textContent).toBe('/scopes/mall/mall%3Aroute/imports/member/memberimport%3Anew');
  });
});

function renderRoute(privileged = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const value = privileged ? { ...context, session: { ...context.session, permissions: ['member.read', 'member.import'], capabilities: ['member.members.read', 'member.imports.create'] } } : context;
  render(
    <MemoryRouter>
      <LocationProbe />
      <QueryClientProvider client={client}>
        <DependencyProvider value={createConsoleDependencies()}>
          <ConsoleContextProvider value={value}>
            <StepupProvider controller={{ request: () => undefined }}>
              <Component />
            </StepupProvider>
          </ConsoleContextProvider>
        </DependencyProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}
function LocationProbe() {
  return <span data-testid="location">{useLocation().pathname}</span>;
}
const scope = { kind: 'mall', id: 'mall:route', name: '路由商城' } as const;
const context: ConsoleContext = {
  session: {
    actor: 'actor:one',
    membership: 'membership:admin',
    accessVersion: 7,
    permissions: ['member.read'],
    capabilities: ['member.members.read'],
    target: 'console',
    scope,
    scopes: [scope],
    assurance: { level: 2 },
    security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null },
    csrf: 'csrf-token',
    syncedAt: '2026-09-03T00:00:00Z',
  },
  profile: { display_name: '管理员', employee_no: 'A001' },
  scope,
  scopes: [scope],
};

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DependencyProvider } from '../../../../app/DependencyContext';
import { createConsoleDependencies } from '../../../../app/Dependencies';
import { ConsoleContextProvider } from '../../../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { StepupProvider } from '../../../../entity/session/StepupContext';
import { Component } from './PartnerRoute';

const server = setupServer(http.get('*/api/v1/partners', () => HttpResponse.json({ items: [partner], count: 1 })));
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

describe('PartnerRoute', () => {
  it('renders service-owned supplier scope and qualification summary', async () => {
    renderRoute();
    expect(await screen.findByText('云海供应商')).toBeTruthy();
    expect(screen.getByText('2 项')).toBeTruthy();
    await userEvent.setup().click(screen.getByRole('button', { name: '查看' }));
    expect(screen.getByText('1 / 0 / 0')).toBeTruthy();
  });

  it('creates a real supplier with version, csrf and idempotency protection', async () => {
    server.use(
      http.put('*/api/v1/partners/:id', async ({ request, params }) => {
        expect(request.headers.get('if-match')).toBe('"0"');
        expect(request.headers.get('x-csrf-token')).toBe('csrf-token');
        expect(request.headers.get('idempotency-key')).toBeTruthy();
        expect(await request.json()).toEqual({ kind: 'supplier', name: '新供应商', status: 'pending' });
        return HttpResponse.json({ ...partner, id: String(params.id), name: '新供应商', status: 'pending', version: 0 });
      })
    );
    renderRoute();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '新建供应商' }));
    await user.type(screen.getByLabelText('名称'), '新供应商');
    await user.click(screen.getByRole('button', { name: '预览变更' }));
    await user.click(screen.getByRole('button', { name: '确认保存' }));
    expect(await screen.findByText('保存成功')).toBeTruthy();
  });
});

function renderRoute() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <DependencyProvider value={createConsoleDependencies()}>
          <ConsoleContextProvider value={context}>
            <StepupProvider controller={{ request: () => undefined }}>
              <Component />
            </StepupProvider>
          </ConsoleContextProvider>
        </DependencyProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}
const qualification = { valid: 2, pending: 1, rejected: 0, expired: 0, nearest_expiry: '2027-01-01T00:00:00.000Z' };
const partner = { id: 'supplier:one', scope_id: 'enterprise:server', kind: 'supplier', name: '云海供应商', status: 'active', version: 3, qualification, created_at: '2026-09-03T00:00:00.000Z', updated_at: '2026-09-03T00:00:00.000Z' };
const scope = { kind: 'enterprise', id: 'enterprise:one', name: '测试集团' } as const;
const context: ConsoleContext = {
  session: {
    actor: 'actor:one',
    membership: 'membership:one',
    accessVersion: 7,
    permissions: ['partner.read', 'partner.manage'],
    capabilities: ['partner.partners.read', 'partner.partners.manage', 'organization.stores.read', 'organization.stores.manage'],
    target: 'console',
    scope,
    scopes: [scope],
    assurance: { level: 2 },
    security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null },
    csrf: 'csrf-token',
    syncedAt: '2026-09-03T00:00:00.000Z',
  },
  profile: { display_name: '管理员', employee_no: 'A001' },
  scope,
  scopes: [scope],
};

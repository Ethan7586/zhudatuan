import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter, useLocation } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createConsoleDependencies } from '../../../app/Dependencies';
import { DependencyProvider } from '../../../app/DependencyContext';
import { ConsoleContextProvider } from '../../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { StepupProvider } from '../../../entity/session/StepupContext';
import { Component } from './ReferralRoute';

let reads = 0;
let command: Readonly<{ body: unknown; headers: Headers }> | undefined;
const server = setupServer(
  http.get('*/api/v1/referral/settings', () => {
    reads += 1;
    return HttpResponse.json(setting());
  }),
  http.put('*/api/v1/referral/settings/:id', async ({ request }) => {
    command = { body: await request.json(), headers: request.headers };
    return HttpResponse.json({ ...setting(), enabled: false, version: 8 });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  reads = 0;
  command = undefined;
});
afterAll(() => server.close());

describe('Referral MVVM workspace', () => {
  it('shares one router across the six canonical referral sections', async () => {
    renderRoute('/scopes/mall/mall:1/referral/settings');
    expect(await screen.findByRole('table', { name: '分销设定' })).toBeTruthy();
    const navigation = screen.getByRole('navigation', { name: '分销返佣工作台' });
    expect(within(navigation).getAllByRole('button')).toHaveLength(6);
    expect(within(navigation).getByRole('button', { name: '分销设定' }).getAttribute('aria-current')).toBe('page');
    expect(screen.queryByText('功能暂未开放')).toBeNull();
  });

  it('hard-cuts invalid section paths to the canonical Settings page', async () => {
    renderRoute('/scopes/mall/mall:1/referral/members?cursor=old');
    await waitFor(() => expect(currentLocation()).toBe('/scopes/mall/mall%3A1/referral/settings'));
    expect(await screen.findByRole('table', { name: '分销设定' })).toBeTruthy();
  });

  it('fails closed outside a mall and offers no invalid retry', async () => {
    renderRoute('/scopes/enterprise/enterprise:1/referral/settings', enterpriseContext);
    expect(await screen.findByText('分销返佣仅在商城范围可用，请先切换到具体商城。')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '重试' })).toBeNull();
    expect(reads).toBe(0);
  });

  it('executes a real setting command with version, proof, identity and authoritative reread', async () => {
    const user = userEvent.setup();
    renderRoute('/scopes/mall/mall:1/referral/settings', authorizedContext);
    await user.click(await screen.findByRole('button', { name: '编辑设定' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('审计原因'), '调整年度分销政策');
    await user.type(within(dialog).getByLabelText('一次性操作凭证'), 'a'.repeat(43));
    await user.click(within(dialog).getByRole('checkbox', { name: /我已核对操作目标/ }));
    await user.click(within(dialog).getByRole('button', { name: '确认执行' }));
    expect(await screen.findByRole('heading', { name: '操作已完成' })).toBeTruthy();
    expect(command?.body).toEqual({ enabled: true, firstTouchDays: 7, rateBasisPoints: 500, minimumWithdrawalMinor: 1000, currency: 'CNY', expectedVersion: 7, reason: '调整年度分销政策' });
    expect(command?.headers.get('if-match')).toBe('"7"');
    expect(command?.headers.get('x-action-proof')).toBe('a'.repeat(43));
    expect(command?.headers.get('idempotency-key')).toBeTruthy();
    expect(reads).toBe(2);
  });
});

const scope = { kind: 'mall' as const, id: 'mall:1' };
const baseSession = {
  actor: 'actor:referral',
  membership: 'membership:referral',
  accessVersion: 7,
  permissions: ['referral.setting.read'],
  capabilities: ['referral.settings.read'],
  target: 'console',
  scope,
  scopes: [scope],
  assurance: { level: 3 },
  security: { hasLocalCredential: true, phoneMasked: '138****0000', passwordChangedAt: null },
  syncedAt: '2026-08-26T00:00:00Z',
};
const context: ConsoleContext = { session: baseSession, profile: { display_name: '测试分销', employee_no: null }, scope, scopes: [scope] };
const authorizedContext: ConsoleContext = {
  ...context,
  session: { ...baseSession, csrf: 'csrf:referral:1234', permissions: [...baseSession.permissions, 'referral.setting.manage'], capabilities: [...baseSession.capabilities, 'referral.settings.manage'] },
};
const enterpriseScope = { kind: 'enterprise' as const, id: 'enterprise:1' };
const enterpriseContext: ConsoleContext = { ...context, scope: enterpriseScope, scopes: [enterpriseScope], session: { ...baseSession, scope: enterpriseScope, scopes: [enterpriseScope] } };

function renderRoute(entry: string, routeContext = context) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <LocationProbe />
      <DependencyProvider value={createConsoleDependencies()}>
        <QueryClientProvider client={client}>
          <ConsoleContextProvider value={routeContext}>
            <StepupProvider controller={{ request: () => undefined }}>
              <Component />
            </StepupProvider>
          </ConsoleContextProvider>
        </QueryClientProvider>
      </DependencyProvider>
    </MemoryRouter>
  );
}

function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="referral-location">
      {location.pathname}
      {location.search}
    </output>
  );
}
function currentLocation(): string {
  return screen.getByTestId('referral-location').textContent ?? '';
}
function setting() {
  return { id: 'referralsetting:1', scopeId: 'scope:1', enabled: true, firstTouchDays: 7, rateBasisPoints: 500, minimumWithdrawalMinor: 1000, currency: 'CNY', version: 7, updatedAt: '2026-08-26T00:00:00Z' };
}

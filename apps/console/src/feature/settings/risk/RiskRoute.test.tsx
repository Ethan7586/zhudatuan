import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { Outlet, MemoryRouter, Route, Routes } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ConsoleContextProvider } from '../../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { StepupProvider } from '../../../entity/session/StepupContext';
import { Component } from './RiskRoute';

const empty = { items: [], count: 0 };
const server = setupServer(http.get('*/api/v1/risks', () => HttpResponse.json(empty)));
const context: ConsoleContext = {
  session: {
    actor: 'actor:one',
    membership: 'membership:one',
    accessVersion: 7,
    permissions: ['risk.read'],
    capabilities: ['risk.center.read'],
    target: 'console',
    scope: { kind: 'enterprise', id: 'enterprise:one' },
    scopes: [{ kind: 'enterprise', id: 'enterprise:one' }],
    assurance: { level: 2 },
    security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null },
    syncedAt: '2026-08-31T00:00:00Z',
  },
  profile: { display_name: '治理管理员', employee_no: null },
  scope: { kind: 'enterprise', id: 'enterprise:one' },
  scopes: [{ kind: 'enterprise', id: 'enterprise:one' }],
};

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

describe('system governance route', () => {
  it('renders a complete governance workspace for an authoritative empty result', async () => {
    renderRoute(vi.fn());
    expect(await screen.findByRole('heading', { level: 1, name: '系统治理台' })).toBeTruthy();
    expect(await screen.findByText('风险边界清晰，异常处置有据可循')).toBeTruthy();
    expect(screen.getByText('暂无自定义风险策略')).toBeTruthy();
    expect(screen.getByText('暂无待复核风险事件')).toBeTruthy();
    expect(screen.getByRole('heading', { name: '治理安全边界' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: '暂无数据' })).toBeNull();
  });

  it('maps policies and review cases to human-readable governance cards', async () => {
    server.use(
      http.get('*/api/v1/risks', () =>
        HttpResponse.json({
          items: [
            riskItem({ id: 'riskpolicy:one', kind: 'policy', name: '大额订单策略', status: 'active', active_version: 3, rollout_percent: 100, replay_state: 'passed', sample_count: 120, changed_count: 2, false_positive_rate: 0.01 }),
            riskItem({ id: 'riskcase:one', kind: 'case', outcome: 'deny', safe_reason: 'velocity', actor_id: 'actor:sensitive-identity', decision_id: 'riskdecision:one', score: 90, created_at: '2026-08-31T08:00:00Z' }),
          ],
          count: 2,
        })
      )
    );
    renderRoute(vi.fn());
    expect(await screen.findByText('大额订单策略')).toBeTruthy();
    expect(screen.getByText('回放通过')).toBeTruthy();
    expect(screen.getByText('已拦截')).toBeTruthy();
    expect(screen.getByText('频次异常')).toBeTruthy();
    expect(screen.queryByText('actor:sensitive-identity')).toBeNull();
  });

  it('turns STEPUP_REQUIRED into a visible Chinese verification action', async () => {
    const request = vi.fn();
    server.use(http.get('*/api/v1/risks', () => HttpResponse.json({ code: 'STEPUP_REQUIRED', message: 'STEPUP_REQUIRED', requestId: 'request:test', retryable: false }, { status: 403 })));
    renderRoute(request);
    const action = await screen.findByRole('button', { name: '立即完成二次验证' });
    expect(screen.queryByText(/request:test/)).toBeNull();
    fireEvent.click(action);
    expect(request).toHaveBeenCalledOnce();
  });
});

function renderRoute(request: () => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  render(
    <MemoryRouter initialEntries={['/risk']}>
      <QueryClientProvider client={client}>
        <ConsoleContextProvider value={context}>
          <StepupProvider controller={{ request }}>
            <Routes>
              <Route element={<Outlet context={{ nodes: [{ id: 'notification', title: '通知管理', component: 'notification', route: 'settings/notifications', permissions: [], capabilities: [], children: [] }], scope: context.scope }} />}>
                <Route path="risk" element={<Component />} />
              </Route>
            </Routes>
          </StepupProvider>
        </ConsoleContextProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

function riskItem(overrides: Readonly<Record<string, unknown>>) {
  return {
    id: 'risk:item',
    kind: 'policy',
    name: null,
    status: null,
    active_version: null,
    baseline_version: null,
    rollout_percent: null,
    rule_hash: null,
    rule: null,
    candidate_version: null,
    candidate_rollout: null,
    candidate_hash: null,
    candidate_rule: null,
    replay_state: null,
    sample_count: null,
    changed_count: null,
    false_positive_rate: null,
    preview: null,
    decision_id: null,
    outcome: null,
    safe_reason: null,
    actor_id: null,
    score: null,
    evidence: null,
    created_at: null,
    ...overrides,
  };
}

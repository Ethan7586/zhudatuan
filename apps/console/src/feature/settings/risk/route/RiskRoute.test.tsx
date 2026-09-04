import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { Outlet, MemoryRouter, Route, Routes } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DependencyProvider } from '../../../../app/DependencyContext';
import { createConsoleDependencies } from '../../../../app/Dependencies';
import { ConsoleContextProvider } from '../../../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { StepupProvider } from '../../../../entity/session/StepupContext';
import { Component } from './RiskRoute';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

describe('RiskRoute', () => {
  it('keeps authoritative group reads and exposes the real scoped governance flow', async () => {
    server.use(http.get('*/api/v1/risks', () => HttpResponse.json({ items: [policy], count: 1 })));
    renderRoute(context('enterprise'));
    expect(await screen.findByText('结算风险')).toBeTruthy();
    expect(screen.getByText('风险策略按当前业务范围独立生效')).toBeTruthy();
    expect(screen.getByRole('button', { name: '新建候选策略' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '核对并激活' })).toBeTruthy();
  });

  it('shows real mall replay and review actions without disabled placeholders', async () => {
    server.use(http.get('*/api/v1/risks', () => HttpResponse.json({ items: [policy, riskCase], count: 2 })));
    renderRoute(context('mall'));
    expect(await screen.findByText('回放通过')).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '核对并激活' }).disabled).toBe(false);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '排除风险' }).disabled).toBe(false);
    expect(screen.getByText('李小明')).toBeTruthy();
    expect(screen.queryByText('actor:sensitive')).toBeNull();
  });

  it('keeps a rejected policy command local while the risk center remains usable', async () => {
    server.use(
      http.get('*/api/v1/risks', () => HttpResponse.json({ items: [policy], count: 1 })),
      http.put('*/api/v1/risks/policies/:id', () =>
        HttpResponse.json({ code: 'DEPENDENCY_UNAVAILABLE', message: '风险策略服务暂时不可用。', requestId: 'request:risk-policy', retryable: true }, { status: 503 })
      )
    );
    renderRoute(context('enterprise'));
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '核对并激活' }));
    await user.click(screen.getByRole('button', { name: '进入最终预览' }));
    await user.type(screen.getByLabelText('一次性复核凭证'), 'p'.repeat(43));
    await user.click(screen.getByLabelText('我已核对回放或处置预览、目标版本、影响范围和不可逆后果'));
    await user.click(screen.getByRole('button', { name: '确认执行' }));
    expect((await screen.findByRole('alert')).textContent).toContain('依赖服务暂时不可用，请稍后重试');
    expect(screen.getAllByText('结算风险').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('dialog', { name: '激活风险策略' })).toBeTruthy();
  });
});

function renderRoute(value: ConsoleContext) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <MemoryRouter initialEntries={['/risk']}>
      <QueryClientProvider client={client}>
        <DependencyProvider value={createConsoleDependencies()}>
          <ConsoleContextProvider value={value}>
            <StepupProvider controller={{ request: () => undefined }}>
              <Routes>
                <Route element={<Outlet context={{ nodes: [], scope: value.scope }} />}>
                  <Route path="risk" element={<Component />} />
                </Route>
              </Routes>
            </StepupProvider>
          </ConsoleContextProvider>
        </DependencyProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

function context(kind: 'enterprise' | 'mall'): ConsoleContext {
  const scope = { kind, id: `${kind}:one`, name: kind === 'mall' ? '测试商城' : '测试集团' } as const;
  return {
    session: {
      actor: 'actor:admin',
      membership: 'membership:admin',
      accessVersion: 7,
      permissions: ['risk.read', 'risk.manage'],
      capabilities: ['risk.center.read', 'risk.policies.manage', 'risk.cases.review'],
      target: 'console',
      scope,
      scopes: [scope],
      assurance: { level: 3 },
      security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null },
      csrf: 'csrf-token',
      syncedAt: '2026-09-03T00:00:00.000Z',
    },
    profile: { display_name: '管理员', employee_no: null },
    scope,
    scopes: [scope],
  };
}

const policy = {
  id: 'riskpolicy:one',
  kind: 'policy',
  version: 4,
  name: '结算风险',
  status: 'active',
  active_version: 2,
  baseline_version: 1,
  rollout_percent: 100,
  rule_hash: 'a'.repeat(64),
  rule: {},
  candidate_version: 3,
  candidate_rollout: 50,
  candidate_hash: 'b'.repeat(64),
  candidate_rule: {},
  replay_state: 'passed',
  sample_count: 100,
  changed_count: 2,
  false_positive_rate: 0.01,
  preview: {},
  decision_id: null,
  outcome: null,
  case_state: null,
  safe_reason: null,
  actor_id: null,
  actor_display_name: null,
  actor_mobile_masked: null,
  score: null,
  evidence: null,
  created_at: null,
};
const riskCase = {
  id: 'riskcase:one',
  kind: 'case',
  version: 2,
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
  decision_id: 'riskdecision:one',
  outcome: 'deny',
  case_state: 'reviewing',
  safe_reason: 'velocity',
  actor_id: 'actor:sensitive',
  actor_display_name: '李小明',
  actor_mobile_masked: '139****0002',
  score: 90,
  evidence: {},
  created_at: '2026-09-03T00:00:00.000Z',
};

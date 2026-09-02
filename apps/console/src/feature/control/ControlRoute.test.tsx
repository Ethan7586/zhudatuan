import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { Component } from './ControlRoute';

describe('Merchant management preview', () => {
  it('renders the approved presentation without exposing unfinished writes', () => {
    render(<MemoryRouter><Component /></MemoryRouter>);

const controlHealth = {
  status: 'degraded',
  queue: { queued: 12, running: 3, deadletters: 1, oldest_seconds: 720 },
  cache: { available: true },
  databaseQueries: [],
  compatibility: {
    healthy: true,
    contract: { checksum: 'contract:control', matches: true },
    schema: { version: 'schema:control', matches: true },
    registries: { operations: 204, events: 55, jobs: 18 },
    database: { writable: true, schema: true, contract: true, operations: 204, capabilities: 96, events: 55 },
  },
  controlPlane: {
    evaluatedAt: '2026-08-26T00:00:00Z',
    coverageRatio: 0.96,
    region: '华北',
    cell: 'Cell C03',
    assurance: 'AAL2',
    conclusion: '平台整体稳定，但有 1 项需要立即处置。',
    summary: '当前覆盖 11/12 项能力；其他 Cell 正常。',
    incidents: [
      {
        id: 'OP-240824-1042',
        priority: 'P1',
        title: '商品同步连续失败',
        impact: '影响：2 个商城 · 436 个商品',
        startedAt: '20:47',
        retryCount: 2,
        cause: '供应商授权凭证过期',
        owner: '张睿',
        slaMinutes: 18,
        action: '执行恢复',
        affectedCapabilities: ['catalog', 'supplier'],
      },
    ],
    capabilities: [
      { id: 'identity', title: '身份与 Scope', status: 'stable', group: 'core' },
      { id: 'catalog', title: '商品能力', status: 'action', group: 'core' },
      { id: 'supplier', title: '供应商协同', status: 'attention', group: 'side' },
    ],
    changes: [
      {
        id: 'change:v34',
        title: '配置版本 v34 · 灰度 10%',
        target: '鸿泰集团 2 个商城',
        stopCondition: '失败率 ≥ 1%',
        rollbackEstimate: '2 分钟',
        status: 'running',
      },
    ],
    audits: [{ id: 'audit:1', time: '20:47', title: '供应商授权校验失败', detail: 'OP-240824-1042', status: 'failed' }],
  },
} as const;

const server = setupServer(
  http.get('*/health/dependency', ({ request }) => {
    if (request.headers.get('x-scope-hint') !== 'enterprise:1' || request.headers.get('x-access-version') !== '7') {
      return HttpResponse.json({ code: 'TEST_CONTEXT_MISSING', requestId: 'request:control' }, { status: 400 });
    }
    return HttpResponse.json(controlHealth);
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

describe('Control route', () => {
  it('renders authority health, evidence, and the Preview → Confirm → Step-up → Receipt boundary', async () => {
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    render(
      <MemoryRouter>
        <QueryClientProvider client={client}>
          <ConsoleContextProvider value={context}>
            <Component />
          </ConsoleContextProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { level: 1, name: '智慧翼中控台' })).toBeTruthy();
    expect(screen.getByText('平台整体稳定，但有 1 项需要立即处置。')).toBeTruthy();
    expect(screen.getByRole('heading', { name: '优先处置' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '平台能力链' })).toBeTruthy();
    expect(screen.getByText('商品能力')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '查看证据' }));
    const evidence = await screen.findByRole('dialog', { name: '处置证据' });
    expect(within(evidence).getByText('供应商授权凭证过期')).toBeTruthy();
    expect(within(evidence).getByText('catalog、supplier')).toBeTruthy();
    expect(within(evidence).getByText(/不在浏览器补造诊断结论/)).toBeTruthy();
    await user.click(within(evidence).getByRole('button', { name: '关闭' }));
    expect(screen.queryByRole('dialog', { name: '处置证据' })).toBeNull();

    await user.click(screen.getByRole('button', { name: '执行恢复' }));
    const preview = await screen.findByRole('dialog', { name: '恢复影响预览' });
    expect(within(preview).getByText('PREVIEW → CONFIRM → STEP-UP')).toBeTruthy();
    expect(within(preview).getByText(/执行前将重新读取状态并要求 Step-up/)).toBeTruthy();
    await user.click(within(preview).getByRole('button', { name: '确认并进入 Step-up' }));

    const receipt = await screen.findByRole('dialog', { name: '恢复请求待执行' });
    expect(within(receipt).getByRole('status').textContent).toContain('预览与确认已完成');
    expect(within(receipt).getByText(/正式 Execute 必须由 action-bound proof/)).toBeTruthy();
  });
});

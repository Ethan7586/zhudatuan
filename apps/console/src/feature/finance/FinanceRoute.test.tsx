import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter, useLocation } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ConsoleContextProvider } from '../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { Component } from './FinanceRoute';

const requests: URL[] = [];
const writes: string[] = [];
const server = setupServer(
  http.get('*/api/v1/finance/overview', () => HttpResponse.json(previewOverview())),
  http.get('*/api/v1/finance/reconciliations', ({ request }) => {
    requests.push(new URL(request.url));
    return HttpResponse.json(previewPage());
  }),
  http.all('*/api/v1/finance/**', ({ request }) => {
    writes.push(request.method);
    return HttpResponse.json({ code: 'UNEXPECTED_FINANCE_WRITE' }, { status: 500 });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  requests.length = 0;
  writes.length = 0;
});
afterAll(() => server.close());

describe('Finance reconciliation workspace', () => {
  it('renders the server-backed control surface and never derives the reference totals in the browser', async () => {
    renderRoute('/finance', previewContext);
    expect(await screen.findByRole('table', { name: '支付对账批次' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: '财务与对账系统' })).toBeTruthy();
    expect(screen.getByText('差异待处理').parentElement?.textContent).toContain('1 项');
    expect(screen.getByRole('columnheader', { name: '渠道金额' })).toBeTruthy();
    expect(screen.getByText('¥119.00')).toBeTruthy();
    expect(screen.getByText('1–1 / 共 7 笔')).toBeTruthy();
    expect(requests[0]?.searchParams.get('limit')).toBe('50');
  });

  it('renders the calm access boundary instead of a finance load failure on 403', async () => {
    server.use(http.get('*/api/v1/finance/reconciliations', () => HttpResponse.json({ code: 'FINANCE_READ_DENIED', requestId: 'request:denied' }, { status: 403 })));
    renderRoute('/finance', previewContext);

    const boundary = await screen.findByRole('region', { name: '暂无访问权限' });
    expect(within(boundary).getByText('当前账号无法查看「财务与对账系统」。')).toBeTruthy();
    expect(screen.queryByRole('table', { name: '支付对账批次' })).toBeNull();
    expect(screen.queryByText('对账数据读取失败')).toBeNull();
  });

  it('fails closed when cached finance data loses access during refresh', async () => {
    let attempts = 0;
    server.use(
      http.get('*/api/v1/finance/reconciliations', () => {
        attempts += 1;
        return attempts === 1 ? HttpResponse.json(previewPage()) : HttpResponse.json({ code: 'FINANCE_READ_DENIED', requestId: 'request:revoked' }, { status: 403 });
      })
    );
    const user = userEvent.setup();
    renderRoute('/finance', previewContext);
    expect(await screen.findByRole('table', { name: '支付对账批次' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '刷新财务数据' }));
    expect(await screen.findByRole('region', { name: '暂无访问权限' })).toBeTruthy();
    expect(screen.queryByRole('table', { name: '支付对账批次' })).toBeNull();
    expect(screen.queryByText('RCN-20260824-WECHAT-001')).toBeNull();
  });

  it('keeps checkbox selection separate from the URL-backed review drawer and fails every final action closed', async () => {
    const user = userEvent.setup();
    renderRoute('/finance?campaign=keep', previewContext);
    await screen.findByRole('table', { name: '支付对账批次' });

    await user.click(screen.getByRole('checkbox', { name: '选择对账批次 RCN-20260824-WECHAT-001' }));
    expect(currentParams().get('selected')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(screen.getByRole('button', { name: '查看差异' }));
    const drawer = await screen.findByRole('dialog', { name: '差异处理 · 复核预览' });
    expect(currentParams().get('selected')).toBe(row.id);
    expect(currentParams().get('campaign')).toBe('keep');
    expect(within(drawer).getByRole('heading', { name: '1修复方案（服务端生成）' })).toBeTruthy();
    expect(within(drawer).getByText('preview:sha256:1')).toBeTruthy();
    expect(within(drawer).getByText(/发起人不能审批自己的处理方案/)).toBeTruthy();

    await user.click(within(drawer).getByRole('button', { name: '保存草稿' }));
    expect((await within(drawer).findByRole('status')).textContent).toContain('草稿未写入');
    await user.click(within(drawer).getByRole('button', { name: '提交财务复核' }));
    expect((await within(drawer).findByRole('status')).textContent).toContain('提交已安全拦截');
    expect(writes).toHaveLength(0);

    await user.click(within(drawer).getByRole('button', { name: '关闭复核预览' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(currentParams().get('selected')).toBeNull();
  });

  it('restores selected difference from the URL and applies preview filters on the server', async () => {
    const user = userEvent.setup();
    renderRoute(`/finance?selected=${encodeURIComponent(row.id)}&cursor=old&campaign=keep`, previewContext);
    expect(await screen.findByRole('dialog', { name: '差异处理 · 复核预览' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '关闭复核预览' }));

    await user.selectOptions(screen.getByRole('combobox', { name: '支付渠道' }), 'wechat');
    await waitFor(() => expect(currentParams().get('channel')).toBe('wechat'));
    expect(currentParams().get('cursor')).toBeNull();
    expect(currentParams().get('campaign')).toBe('keep');
    await waitFor(() => expect(requests.some((url) => url.searchParams.get('channel') === 'wechat')).toBe(true));
  });

  it('removes preview-only filters and hides preview metadata in production scope', async () => {
    renderRoute('/finance?q=demo&channel=wechat&reconPeriod=2026-08-24&campaign=keep', productionContext);
    expect(await screen.findByRole('table', { name: '支付对账批次' })).toBeTruthy();
    await waitFor(() => expect(currentParams().has('channel')).toBe(false));
    expect(currentParams().get('campaign')).toBe('keep');
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: '搜索对账记录' }).disabled).toBe(true);
    expect(screen.getByText('reconciliation:preview:wechat:1')).toBeTruthy();
    expect(screen.queryByText('RCN-20260824-WECHAT-001')).toBeNull();
    expect(screen.getByText('本页 1 笔')).toBeTruthy();
    expect(requests.every((url) => !url.searchParams.has('q') && !url.searchParams.has('channel'))).toBe(true);
  });

  it('routes supported tabs and labels unavailable read contracts honestly', async () => {
    const user = userEvent.setup();
    renderRoute('/finance', previewContext);
    await screen.findByRole('table', { name: '支付对账批次' });
    await user.click(screen.getByRole('button', { name: '退款对账' }));
    expect(await screen.findByRole('heading', { name: '退款对账' })).toBeTruthy();
    expect(screen.getByText(/不会用演示数据替代生产事实/)).toBeTruthy();
    expect(currentParams().get('tab')).toBe('refunds');

    await user.click(screen.getByRole('button', { name: '结算单' }));
    expect(currentLocation()).toContain('/finance/settlements');
  });

  it('shows only non-mutating safety dialogs for preview header actions', async () => {
    const user = userEvent.setup();
    renderRoute('/finance', previewContext);
    await screen.findByRole('table', { name: '支付对账批次' });
    await user.click(screen.getByRole('button', { name: '导出对账单' }));
    const exportDialog = await screen.findByRole('dialog', { name: '导出对账单 · 安全预览' });
    expect(within(exportDialog).getByText(/当前不会生成或下载正式账单/)).toBeTruthy();
    await user.click(within(exportDialog).getByRole('button', { name: '我知道了' }));
    await user.click(screen.getByRole('button', { name: '发起对账' }));
    const startDialog = await screen.findByRole('dialog', { name: '发起对账 · 安全预览' });
    expect(within(startDialog).getByText(/不会创建对账批次/)).toBeTruthy();
    expect(writes).toHaveLength(0);
  });
});

const row = {
  id: 'reconciliation:preview:wechat:1',
  scope_id: 'platform:preview',
  provider: 'wechat_pay',
  partner_id: 'mall:1',
  period: '2026-08-24',
  statement_ref: 'statement:1',
  statement_hash: 'a'.repeat(64),
  debit_minor: 31_500,
  credit_minor: 19_600,
  difference_minor: 11_900,
  state: 'difference',
  evidence: {},
  approved_by: null,
  updated_at: '2026-08-24T13:26:00.000Z',
  version: 7,
  item_counts: { matched: 2, difference: 1 },
  preview: {
    source: 'local-preview',
    batchId: 'RCN-20260824-WECHAT-001',
    accountingDate: '2026-08-24',
    channelLabel: '微信支付',
    dataSourceLabel: '渠道账单',
    scopeLabel: '鸿泰集团 / 鸿泰惠民通',
    expectedCount: 3,
    matchedCount: 2,
    differenceCount: 1,
    paymentChannel: 'wechat',
    mall: 'mall:1',
    differenceType: 'journal-missing',
    completedAt: '2026-08-24T13:26:00.000Z',
  },
  items: [
    {
      id: 'DIFF-20260824-0001',
      externalMinor: 11_900,
      internalMinor: 0,
      differenceMinor: 11_900,
      state: 'difference',
      reasonCode: 'INTERNAL_REFERENCE_MISSING',
      evidence: {},
      resolution: null,
      resolvedBy: null,
      approvedBy: null,
      preview: repairPreview(),
    },
  ],
};

function previewPage() {
  return {
    items: [row],
    count: 1,
    preview: {
      source: 'local-preview',
      total: 7,
      page: 1,
      asOf: '2026-08-24T13:31:00.000Z',
      accountingDate: '2026-08-24',
      lastReconciledAt: '2026-08-24T13:26:00.000Z',
      pendingDifferenceCount: 1,
      pendingReviewCount: 0,
      facets: {
        periods: [{ value: '2026-08-24', label: '2026-08-24', count: 7 }],
        channels: [{ value: 'wechat', label: '微信支付', count: 1 }],
        malls: [{ value: 'mall:1', label: '鸿泰惠民通', count: 7 }],
        statuses: [{ value: 'difference', label: '有差异', count: 1 }],
        differenceTypes: [{ value: 'journal-missing', label: '记账事件缺失', count: 1 }],
      },
    },
  };
}

function previewOverview() {
  return {
    items: [
      {
        currency: 'CNY',
        balance_minor: 78_599_300,
        liability_minor: 13_826_400,
        income_minor: 24_863_200,
        expense_minor: 6_961_696,
        cash_minor: 31_500,
        journal_count: 18_642,
        watermark: '2026-08-24T13:26:00.000Z',
      },
    ],
    preview: {
      source: 'local-preview',
      asOf: '2026-08-24T13:31:00.000Z',
      accountingDate: '2026-08-24',
      lastReconciledAt: '2026-08-24T13:26:00.000Z',
      pendingDifferenceCount: 1,
      pendingReviewCount: 0,
    },
  };
}

function repairPreview() {
  return {
    source: 'local-preview',
    status: 'service-preview',
    expiresAt: '2026-08-24T13:46:00.000Z',
    plan: { title: '重放缺失记账事件', description: '不修改历史账本', operation: 'finance.reconciliation.replay', relatedPayment: 'PAY-20260824-0119', accountingDate: '2026-08-24', scope: '鸿泰集团 / 鸿泰惠民通' },
    entries: [
      { side: 'debit', account: 'cash', amountMinor: 11_900, currency: 'CNY' },
      { side: 'credit', account: 'commerce.clearing', amountMinor: 11_900, currency: 'CNY' },
    ],
    result: { ledgerBeforeMinor: 19_600, ledgerAfterMinor: 31_500, differenceBeforeMinor: 11_900, differenceAfterMinor: 0, settlementImpact: '重新计算当前结算基础' },
    checks: [{ label: '财务权限与 Level 3', state: 'passed', detail: '已验证' }],
    reason: '记账事件未消费',
    evidence: [{ label: '渠道账单', value: 'SHA-256' }],
    previewHash: 'preview:sha256:1',
    idempotencyKey: 'FIN-20260824-0001',
    sourceHash: 'source:sha256:1',
    itemVersion: 7,
    previewVersion: 7,
  };
}

const previewScope = { kind: 'platform', id: 'platform:preview' } as const;
const productionScope = { kind: 'enterprise', id: 'enterprise:1' } as const;
const previewContext = context(previewScope);
const productionContext = context(productionScope);

function context(scope: ConsoleContext['scope']): ConsoleContext {
  return {
    session: { actor: 'actor:finance', membership: 'membership:finance', accessVersion: 7, permissions: [], capabilities: [], target: 'console', scope, scopes: [scope], assurance: { level: 3 }, syncedAt: '2026-08-24T13:31:00.000Z' },
    profile: { display_name: '测试财务', employee_no: null },
    scope,
    scopes: [scope],
  };
}

function renderRoute(entry: string, initialContext: ConsoleContext) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <LocationProbe />
      <QueryClientProvider client={client}>
        <ConsoleContextProvider value={initialContext}>
          <Component />
        </ConsoleContextProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}
function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="finance-location">
      {location.pathname}
      {location.search}
    </output>
  );
}
function currentLocation(): string {
  return screen.getByTestId('finance-location').textContent ?? '';
}
function currentParams(): URLSearchParams {
  return new URL(currentLocation(), 'https://console.test').searchParams;
}

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
import { Component as OverviewRoute } from './FinanceRoute';
import { Component as ReconciliationRoute } from './ReconciliationRoute';

const requests: URL[] = [];
const writes: string[] = [];
const row = {
  id: 'reconciliation:wechat:1', scope_id: 'enterprise:1', provider: 'wechat_pay', partner_id: 'mall:1', period: '2026-08-24', statement_ref: 'statement:1', statement_hash: 'a'.repeat(64), state: 'difference', debit_minor: 31_500, credit_minor: 19_600, difference_minor: 11_900, created_by: 'membership:maker', approved_by: null, evidence: {}, updated_at: '2026-08-24T13:26:00.000Z', version: 7, item_counts: { matched: 2, difference: 1 },
  items: [{ id: 'reconciliationdifference:1', externalMinor: 11_900, internalMinor: 0, differenceMinor: 11_900, state: 'difference', reasonCode: 'INTERNAL_REFERENCE_MISSING', evidence: {}, resolution: null, resolvedBy: null, approvedBy: null }],
} as const;

const server = setupServer(
  http.get('*/api/v1/finance/overview', () => HttpResponse.json({ items: [{ currency: 'CNY', balance_minor: 78_599_300, liability_minor: 13_826_400, income_minor: 24_863_200, expense_minor: 6_961_696, cash_minor: 31_500, journal_count: 18_642, watermark: '2026-08-24T13:26:00.000Z' }] })),
  http.get('*/api/v1/finance/reconciliations', ({ request }) => { requests.push(new URL(request.url)); return HttpResponse.json({ items: [row], count: 1, nextCursor: 'cursor:next' }); }),
  http.all('*/api/v1/finance/**', ({ request }) => { writes.push(request.method); return HttpResponse.json({ code: 'UNEXPECTED_FINANCE_WRITE' }, { status: 500 }); })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => { cleanup(); server.resetHandlers(); requests.length = 0; writes.length = 0; });
afterAll(() => server.close());

describe('Finance MVVM workspace', () => {
  it('shows the authoritative overview instead of invented empty metrics', async () => {
    renderRoute('/finance', OverviewRoute);
    expect(await screen.findByRole('heading', { level: 1, name: '财务总览' })).toBeTruthy();
    expect(screen.getAllByText('¥785,993.00').length).toBeGreaterThan(0);
    expect(screen.getByText('18,642')).toBeTruthy();
    expect(screen.queryByText('服务端未提供')).toBeNull();
    expect(screen.queryByRole('button', { name: '发起对账' })).toBeNull();
  });

  it('retains the authoritative reconciliation list and URL-driven detail', async () => {
    const user = userEvent.setup();
    renderRoute('/finance/reconciliations?campaign=keep', ReconciliationRoute);
    expect(await screen.findByRole('table', { name: '支付对账批次' })).toBeTruthy();
    expect(screen.getByText(/^对账批次 \d{4} \d{4}$/)).toBeTruthy();
    expect(screen.getByText('微信支付')).toBeTruthy();
    expect(screen.queryByText(row.id)).toBeNull();
    expect(screen.getByText('¥119.00')).toBeTruthy();
    expect(requests[0]?.searchParams.get('limit')).toBe('50');

    await user.click(screen.getByRole('checkbox', { name: /^选择对账批次 \d{4} \d{4}$/ }));
    expect(currentParams().get('selected')).toBeNull();
    await user.click(screen.getByRole('button', { name: '查看差异' }));
    const drawer = await screen.findByRole('dialog', { name: '对账差异详情' });
    expect(currentParams().get('selected')).toBe(row.id);
    expect(currentParams().get('campaign')).toBe('keep');
    expect(within(drawer).getByText('内部引用缺失')).toBeTruthy();
    expect(within(drawer).getByText('¥119.00')).toBeTruthy();
    expect(within(drawer).queryByText('最终动作未接入')).toBeNull();
    expect(within(drawer).queryByRole('button', { name: '保存草稿' })).toBeNull();
    await user.click(within(drawer).getByRole('button', { name: '关闭差异详情' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(writes).toHaveLength(0);
  });

  it('removes stale unsupported URL state and exposes only the seven real sections', async () => {
    renderRoute('/finance/reconciliations?q=demo&channel=wechat&reconPeriod=2026-08-24&campaign=keep', ReconciliationRoute);
    await screen.findByRole('table', { name: '支付对账批次' });
    await waitFor(() => expect(currentParams().has('channel')).toBe(false));
    expect(currentParams().has('q')).toBe(false);
    expect(currentParams().has('reconPeriod')).toBe(false);
    expect(currentParams().get('campaign')).toBe('keep');
    expect(screen.queryByRole('textbox', { name: '搜索对账记录' })).toBeNull();
    expect(screen.getAllByRole('navigation', { name: '财务工作台' })[0]?.querySelectorAll('button')).toHaveLength(7);
    expect(screen.queryByText('退款对账')).toBeNull();
    expect(requests.every((url) => !url.searchParams.has('q') && !url.searchParams.has('channel'))).toBe(true);
  });
});

const context: ConsoleContext = {
  session: { actor: 'actor:finance', membership: 'membership:finance', accessVersion: 7, permissions: [], capabilities: [], target: 'console', scope: { kind: 'enterprise', id: 'enterprise:1' }, scopes: [{ kind: 'enterprise', id: 'enterprise:1' }], assurance: { level: 3 }, security: { hasLocalCredential: true, phoneMasked: '138****0000', passwordChangedAt: null }, syncedAt: '2026-08-24T13:31:00.000Z' },
  profile: { display_name: '测试财务', employee_no: null }, scope: { kind: 'enterprise', id: 'enterprise:1' }, scopes: [{ kind: 'enterprise', id: 'enterprise:1' }],
};

function renderRoute(entry: string, Route: () => JSX.Element) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
  return render(<MemoryRouter initialEntries={[entry]}><LocationProbe /><DependencyProvider value={createConsoleDependencies()}><QueryClientProvider client={client}><ConsoleContextProvider value={context}><Route /></ConsoleContextProvider></QueryClientProvider></DependencyProvider></MemoryRouter>);
}

function LocationProbe() { const location = useLocation(); return <output data-testid="finance-location">{location.pathname}{location.search}</output>; }
function currentParams(): URLSearchParams { return new URL(screen.getByTestId('finance-location').textContent ?? '', 'https://console.test').searchParams; }

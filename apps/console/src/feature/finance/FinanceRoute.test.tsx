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
const row = {
  id: 'reconciliation:wechat:1',
  scope_id: 'enterprise:1',
  provider: 'wechat_pay',
  partner_id: 'mall:1',
  period: '2026-08-24',
  statement_ref: 'statement:1',
  statement_hash: 'a'.repeat(64),
  state: 'difference',
  debit_minor: 31_500,
  credit_minor: 19_600,
  difference_minor: 11_900,
  created_by: 'membership:maker',
  approved_by: null,
  evidence: {},
  updated_at: '2026-08-24T13:26:00.000Z',
  version: 7,
  item_counts: { matched: 2, difference: 1 },
  items: [
    {
      id: 'reconciliationdifference:1',
      externalMinor: 11_900,
      internalMinor: 0,
      differenceMinor: 11_900,
      state: 'difference',
      reasonCode: 'INTERNAL_REFERENCE_MISSING',
      evidence: {},
      resolution: null,
      resolvedBy: null,
      approvedBy: null,
    },
  ],
} as const;

const server = setupServer(
  http.get('*/api/v1/finance/overview', () =>
    HttpResponse.json({
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
    })
  ),
  http.get('*/api/v1/finance/reconciliations', ({ request }) => {
    requests.push(new URL(request.url));
    return HttpResponse.json({ items: [row], count: 1, nextCursor: 'cursor:next' });
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
  it('renders only the authoritative reconciliation read model', async () => {
    renderRoute('/finance');
    expect(await screen.findByRole('table', { name: '支付对账批次' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: '财务' })).toBeTruthy();
    expect(screen.getByText(row.id)).toBeTruthy();
    expect(screen.getByText('wechat_pay')).toBeTruthy();
    expect(screen.getByText('¥119.00')).toBeTruthy();
    expect(screen.getByText('本页 1 笔')).toBeTruthy();
    expect(requests[0]?.searchParams.get('limit')).toBe('50');
    expect(requests[0]?.searchParams.has('channel')).toBe(false);
  });

  it('keeps selection local and opens a read-only difference drawer through the URL', async () => {
    const user = userEvent.setup();
    renderRoute('/finance?campaign=keep');
    await screen.findByRole('table', { name: '支付对账批次' });

    await user.click(screen.getByRole('checkbox', { name: `选择对账批次 ${row.id}` }));
    expect(currentParams().get('selected')).toBeNull();
    await user.click(screen.getByRole('button', { name: '查看差异' }));

    const drawer = await screen.findByRole('dialog', { name: '差异处理 · 复核预览' });
    expect(currentParams().get('selected')).toBe(row.id);
    expect(currentParams().get('campaign')).toBe('keep');
    expect(within(drawer).getByText('最终动作未接入')).toBeTruthy();
    expect(within(drawer).getByText('INTERNAL_REFERENCE_MISSING')).toBeTruthy();
    expect(within(drawer).getByRole('button', { name: '保存草稿' }).hasAttribute('disabled')).toBe(true);
    expect(within(drawer).getByRole('button', { name: '提交财务复核' }).hasAttribute('disabled')).toBe(true);
    await user.click(within(drawer).getByRole('button', { name: '关闭复核预览' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(writes).toHaveLength(0);
  });

  it('removes unsupported filters and preserves unrelated URL state', async () => {
    renderRoute('/finance?q=demo&channel=wechat&reconPeriod=2026-08-24&campaign=keep');
    await screen.findByRole('table', { name: '支付对账批次' });
    await waitFor(() => expect(currentParams().has('channel')).toBe(false));
    expect(currentParams().has('q')).toBe(false);
    expect(currentParams().has('reconPeriod')).toBe(false);
    expect(currentParams().get('campaign')).toBe('keep');
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: '搜索对账记录' }).disabled).toBe(true);
    expect(requests.every((url) => !url.searchParams.has('q') && !url.searchParams.has('channel'))).toBe(true);
  });

  it('keeps unsupported final actions disabled and never sends a write', async () => {
    renderRoute('/finance');
    await screen.findByRole('table', { name: '支付对账批次' });
    expect(screen.getByRole('button', { name: '导出对账单' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: '发起对账' }).hasAttribute('disabled')).toBe(true);
    expect(writes).toHaveLength(0);
  });
});

const context: ConsoleContext = {
  session: {
    actor: 'actor:finance',
    membership: 'membership:finance',
    accessVersion: 7,
    permissions: [],
    capabilities: [],
    target: 'console',
    scope: { kind: 'enterprise', id: 'enterprise:1' },
    scopes: [{ kind: 'enterprise', id: 'enterprise:1' }],
    assurance: { level: 3 },
    syncedAt: '2026-08-24T13:31:00.000Z',
  },
  profile: { display_name: '测试财务', employee_no: null },
  scope: { kind: 'enterprise', id: 'enterprise:1' },
  scopes: [{ kind: 'enterprise', id: 'enterprise:1' }],
};

function renderRoute(entry: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <LocationProbe />
      <QueryClientProvider client={client}>
        <ConsoleContextProvider value={context}>
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

function currentParams(): URLSearchParams {
  return new URL(screen.getByTestId('finance-location').textContent ?? '', 'https://console.test').searchParams;
}

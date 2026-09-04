import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http, type JsonBodyType } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter } from 'react-router';
import type { ComponentType } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createConsoleDependencies } from '../../../app/Dependencies';
import { DependencyProvider } from '../../../app/DependencyContext';
import { ConsoleContextProvider } from '../../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { StepupProvider } from '../../../entity/session/StepupContext';
import { Component as OverviewRoute } from './FinanceRoute';
import { Component as InvoiceRoute } from './InvoiceRoute';
import { Component as ReconciliationRoute } from './ReconciliationRoute';
import { Component as SettlementRoute } from './SettlementRoute';
import { Component as StatementRoute } from './StatementRoute';
import { Component as WithdrawalRoute } from './WithdrawalRoute';

const reads: URL[] = [];
let failedPath = '';
let statementRows = 0;
const server = setupServer(
  http.get('*/api/v1/finance/overview', ({ request }) => response(request, { items: [] })),
  http.get('*/api/v1/finance/statements', ({ request }) => response(request, statementPage(request))),
  http.get('*/api/v1/finance/reconciliations', ({ request }) => response(request, { items: [], count: 0 })),
  http.get('*/api/v1/finance/settlements', ({ request }) => response(request, { items: [], count: 0 })),
  http.get('*/api/v1/finance/withdrawals', ({ request }) => response(request, { items: [], count: 0 })),
  http.get('*/api/v1/invoices/requests', ({ request }) => response(request, { items: [], count: 0 }))
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => { cleanup(); server.resetHandlers(); reads.length = 0; failedPath = ''; statementRows = 0; });
afterAll(() => server.close());

const routes = [
  ['/finance', OverviewRoute, '/api/v1/finance/overview', '财务总览', 'finance.overview.read', 'finance.overview.read'],
  ['/finance/statements', StatementRoute, '/api/v1/finance/statements', '账单', 'finance.statement.read', 'finance.statements.read'],
  ['/finance/reconciliations', ReconciliationRoute, '/api/v1/finance/reconciliations', '对账', 'finance.reconciliation.read', 'finance.reconciliations.read'],
  ['/finance/settlements', SettlementRoute, '/api/v1/finance/settlements', '结算单', 'finance.settlement.read', 'finance.settlements.read'],
  ['/finance/withdrawals', WithdrawalRoute, '/api/v1/finance/withdrawals', '提现', 'finance.withdrawal.read', 'finance.withdrawals.read'],
  ['/finance/invoices', InvoiceRoute, '/api/v1/invoices/requests', '发票', 'invoice.request.read', 'invoice.requests.read'],
] as const;

describe('finance tab isolation and bounded rendering', () => {
  it.each(routes)('keeps the finance shell usable when %s fails independently', async (path, Route, endpoint, title, permission, capability) => {
    failedPath = endpoint;
    renderRoute(path, Route, access(permission, capability));

    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeTruthy();
    const navigation = screen.getByRole('navigation', { name: '财务工作台' });
    expect(within(navigation).getAllByRole('button')).toHaveLength(6);
    expect(await screen.findByRole('alert')).toBeTruthy();
    const attempts = reads.filter(({ pathname }) => pathname === endpoint).length;
    expect(attempts).toBeGreaterThanOrEqual(1);
    const retry = screen.getByRole('button', { name: '重试' });
    await userEvent.setup().click(retry);
    await waitFor(() => expect(reads.filter(({ pathname }) => pathname === endpoint).length).toBeGreaterThan(attempts));
  });

  it('renders only one bounded 50-row statement page and advances with the server cursor', async () => {
    statementRows = 50;
    const user = userEvent.setup();
    renderRoute('/finance/statements', StatementRoute, access('finance.statement.read', 'finance.statements.read'));

    const table = await screen.findByRole('table', { name: '账单' });
    expect(within(table).getAllByRole('row')).toHaveLength(51);
    expect(document.querySelector('.financepagination span')?.textContent).toBe('服务端共 50000 条');
    expect(reads[0]?.searchParams.get('limit')).toBe('50');
    expect(reads[0]?.searchParams.has('cursor')).toBe(false);
    await user.click(screen.getByRole('button', { name: '下一页' }));
    await waitFor(() => expect(reads).toHaveLength(2));
    expect(reads[1]?.searchParams.get('cursor')).toBe('statement:050');
    expect(within(screen.getByRole('table', { name: '账单' })).getAllByRole('row')).toHaveLength(51);
  });
});

function response(request: Request, body: JsonBodyType) {
  const url = new URL(request.url);
  reads.push(url);
  return url.pathname === failedPath ? HttpResponse.json({ code: 'INTERNAL_ERROR', requestId: `trace:${url.pathname}` }, { status: 503 }) : HttpResponse.json(body);
}

function statementPage(request: Request) {
  if (statementRows === 0) return { items: [], count: 0 };
  const offset = new URL(request.url).searchParams.has('cursor') ? 50 : 0;
  return {
    items: Array.from({ length: statementRows }, (_, index) => ({ id: `statement:${String(offset + index + 1).padStart(3, '0')}`, scope_id: 'enterprise:1', period_start: '2026-08-01', period_end: '2026-08-31', currency: 'CNY', opening_minor: index * 100, debit_minor: 100, credit_minor: 50, closing_minor: index * 100 + 50, state: 'final', object_ref: null, sha256: null, generated_at: '2026-09-01T00:00:00.000Z' })),
    count: 50_000,
    nextCursor: offset === 0 ? 'statement:050' : 'statement:100',
  };
}

function renderRoute(entry: string, Route: ComponentType, context: ConsoleContext) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<MemoryRouter initialEntries={[entry]}><DependencyProvider value={createConsoleDependencies()}><QueryClientProvider client={client}><ConsoleContextProvider value={context}><StepupProvider controller={{ request: () => undefined }}><Route /></StepupProvider></ConsoleContextProvider></QueryClientProvider></DependencyProvider></MemoryRouter>);
}

function access(permission: string, capability: string): ConsoleContext {
  return {
    session: { actor: 'actor:finance', membership: 'membership:finance', accessVersion: 7, target: 'console', scope: { kind: 'enterprise', id: 'enterprise:1' }, scopes: [{ kind: 'enterprise', id: 'enterprise:1' }], assurance: { level: 3 }, security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null }, syncedAt: '2026-09-07T08:00:00.000Z', permissions: [permission], capabilities: [capability] },
    profile: { display_name: '测试财务', employee_no: null }, scope: { kind: 'enterprise', id: 'enterprise:1' }, scopes: [{ kind: 'enterprise', id: 'enterprise:1' }],
  };
}

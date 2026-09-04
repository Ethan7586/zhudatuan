// @vitest-environment node
import { HttpResponse, delay, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { financeReconciliationKey, financeSectionKey } from '../viewmodel/FinanceQueryKey';
import { FinanceGateway } from './FinanceGateway';

const gateway = new FinanceGateway('http://localhost');

const requests: URL[] = [];
let command: Readonly<{ headers: Headers; body: unknown }> | undefined;
const server = setupServer(
  http.get('*/api/v1/finance/audit', ({ request }) => {
    requests.push(new URL(request.url));
    return HttpResponse.json(audit());
  }),
  http.get('*/api/v1/finance/facets', () => HttpResponse.json({
    periods: { items: [{ value: '2026-08', label: '2026 年 8 月', count: 2 }], reason: null },
    providers: { items: [{ value: 'supplier', label: '自有供应商', count: 2, available: true }], reason: null },
    malls: { items: [], reason: '当前范围没有可用商城。' },
    states: { items: [{ value: 'difference', label: '有差异', count: 1 }], reason: null },
    differenceTypes: { items: [], reason: '当前范围还没有对账差异类型。' },
    watermark: '2026-08-26T00:00:00.000Z',
  })),
  http.get('*/api/v1/finance/entries', trackEmptyPage),
  http.get('*/api/v1/finance/statements', trackEmptyPage),
  http.get('*/api/v1/finance/settlements', trackEmptyPage),
  http.get('*/api/v1/finance/withdrawals', trackEmptyPage),
  http.get('*/api/v1/invoices/requests', trackEmptyPage),
  http.get('*/api/v1/finance/policies', trackEmptyPage),
  http.get('*/api/v1/finance/reconciliations', ({ request }) => {
    requests.push(new URL(request.url));
    expect(request.headers.get('x-scope-hint')).toBe('enterprise:1');
    expect(request.headers.get('x-access-version')).toBe('7');
    return HttpResponse.json(page());
  }),
  http.put('*/api/v1/finance/reconciliations/:id', async ({ request }) => {
    command = { headers: request.headers, body: await request.json() };
    return HttpResponse.json({
      id: 'reconciliationdifference:1',
      reconciliation_id: 'reconciliation:1',
      statement_line_id: 'statementline:1',
      scope_id: 'enterprise:1',
      internal_type: null,
      internal_id: null,
      external_minor: 31_500,
      internal_minor: 43_400,
      difference_minor: -11_900,
      state: 'resolutionpending',
      reason_code: 'JOURNAL_MISSING',
      evidence: {},
      resolution: { reason: '核对渠道回单后提交差异处理' },
      resolved_by: 'actor:finance',
      approved_by: null,
      resolved_at: '2026-08-26T00:00:00Z',
      approved_at: null,
      version: 8,
    });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  requests.length = 0;
  command = undefined;
  server.resetHandlers();
});
afterAll(() => server.close());

describe('Finance gateway', () => {
  it('maps a complete audit evidence chain and sends only the business reference', async () => {
    const result = await gateway.audit(context(), 'order:one', new AbortController().signal);
    expect(Object.fromEntries(requests[0]?.searchParams ?? [])).toEqual({ reference: 'order:one' });
    expect(result.facts[0]).toMatchObject({ kind: 'journal', businessReference: 'order:one', amountMinor: 100 });
    expect(result.events[0]).toMatchObject({ type: 'finance.entry.posted', traceId: 'trace:one' });
    expect(result.records[0]).toMatchObject({ action: 'finance.post', recordHash: 'b'.repeat(64) });
    expect(Object.isFrozen(result.records)).toBe(true);
  });

  it('parses server-owned facet labels, counts, availability and empty reasons', async () => {
    const result = await gateway.facets(context(), new AbortController().signal);
    expect(result.providers.items[0]).toEqual({ value: 'supplier', label: '自有供应商', count: 2, available: true });
    expect(result.malls.items).toEqual([]);
    expect(result.malls.reason).toMatch(/商城/);
    expect(Object.isFrozen(result.providers.items)).toBe(true);
  });

  it('parses signed differences and preserves authoritative evidence', async () => {
    const result = await gateway.reconciliations(context(), { limit: 50 }, new AbortController().signal);
    expect(result.items[0]).toMatchObject({ differenceMinor: -11_900, itemCounts: { matched: 2, difference: 1 } });
    expect(result.items[0]?.items[0]).toMatchObject({ id: 'reconciliationdifference:1', differenceMinor: -11_900, evidence: { reference: 'PAY-20260824-0119' } });
    expect(Object.isFrozen(result.items[0]?.items[0])).toBe(true);
  });

  it('sends only cursor and limit and isolates the query key', async () => {
    await gateway.reconciliations(context(), { limit: 50, cursor: 'cursor:2' }, new AbortController().signal);
    expect(Object.fromEntries(requests[0]?.searchParams ?? [])).toEqual({ limit: '50', cursor: 'cursor:2' });
    expect(financeReconciliationKey(context(), { limit: 50, cursor: 'cursor:1' })).not.toEqual(financeReconciliationKey(context(), { limit: 50, cursor: 'cursor:2' }));
  });

  it('routes every tab to its own endpoint and cache namespace', async () => {
    const sections = ['entries', 'statements', 'reconciliations', 'settlements', 'withdrawals', 'invoices', 'policies'] as const;
    for (const section of sections) await gateway.section(context(), section, undefined, new AbortController().signal);

    expect(requests.map(({ pathname }) => pathname)).toEqual([
      '/api/v1/finance/entries',
      '/api/v1/finance/statements',
      '/api/v1/finance/reconciliations',
      '/api/v1/finance/settlements',
      '/api/v1/finance/withdrawals',
      '/api/v1/invoices/requests',
      '/api/v1/finance/policies',
    ]);
    expect(new Set(sections.map((section) => JSON.stringify(financeSectionKey(context(), section)))).size).toBe(sections.length);
  });

  it('propagates cancellation', async () => {
    server.use(
      http.get('*/api/v1/finance/reconciliations', async () => {
        await delay('infinite');
        return HttpResponse.json(page());
      })
    );
    const controller = new AbortController();
    const pending = gateway.reconciliations(context(), { limit: 50 }, controller.signal);
    controller.abort(new Error('SCOPE_CHANGED'));
    await expect(pending).rejects.toThrow();
  });

  it('preserves the authoritative total when a cursor page contains fewer items', async () => {
    server.use(http.get('*/api/v1/finance/reconciliations', () => HttpResponse.json({ ...page(), count: 2 })));
    await expect(gateway.reconciliations(context(), { limit: 50 }, new AbortController().signal)).resolves.toMatchObject({ count: 2, items: [{ id: 'reconciliation:1' }] });
  });

  it('binds reconciliation commands to scope, version, identity and action proof', async () => {
    await gateway.manageReconciliation(context(), 'reconciliation:1', 7, { action: 'resolve', item: 'reconciliationdifference:1', reason: '核对渠道回单后提交差异处理' }, 'a'.repeat(43), 'command:finance:1');
    expect(command?.body).toEqual({ action: 'resolve', item: 'reconciliationdifference:1', reason: '核对渠道回单后提交差异处理' });
    expect(command?.headers.get('x-scope-hint')).toBe('enterprise:1');
    expect(command?.headers.get('if-match')).toBe('"7"');
    expect(command?.headers.get('idempotency-key')).toBe('command:finance:1');
    expect(command?.headers.get('x-action-proof')).toBe('a'.repeat(43));
    expect(command?.headers.get('x-csrf-token')).toBe('csrf:finance');
  });
});

function context(): ConsoleContext {
  const scope = { kind: 'enterprise' as const, id: 'enterprise:1' };
  return {
    session: {
      actor: 'actor:finance',
      membership: 'membership:finance',
      accessVersion: 7,
      permissions: [],
      capabilities: [],
      target: 'console',
      scope,
      scopes: [scope],
      assurance: { level: 3 },
      security: { hasLocalCredential: true, phoneMasked: '138****0000', passwordChangedAt: null },
      syncedAt: '2026-08-26T00:00:00Z',
      csrf: 'csrf:finance',
    },
    profile: { display_name: '测试财务', employee_no: null },
    scope,
    scopes: [scope],
  };
}

function trackEmptyPage({ request }: Readonly<{ request: Request }>) {
  requests.push(new URL(request.url));
  return HttpResponse.json({ items: [], count: 0 });
}

function page() {
  return {
    count: 1,
    nextCursor: 'cursor:3',
    items: [
      {
        id: 'reconciliation:1',
        scope_id: 'mall:1',
        provider: 'wechat',
        partner_id: 'partner:1',
        period: '2026-08-24/2026-08-24',
        statement_ref: 'statement:1',
        statement_hash: 'a'.repeat(64),
        debit_minor: 31_500,
        credit_minor: 43_400,
        difference_minor: -11_900,
        state: 'difference',
        created_by: 'membership:1',
        approved_by: null,
        evidence: { statement: 'channel:statement:1' },
        updated_at: '2026-08-24T13:26:00.000Z',
        version: 7,
        item_counts: { matched: 2, difference: 1 },
        items: [
          {
            id: 'reconciliationdifference:1',
            externalMinor: 31_500,
            internalMinor: 43_400,
            differenceMinor: -11_900,
            state: 'difference',
            reasonCode: 'JOURNAL_MISSING',
            evidence: { reference: 'PAY-20260824-0119' },
            resolution: null,
            resolvedBy: null,
            approvedBy: null,
          },
        ],
      },
    ],
  };
}

function audit() {
  return {
    reference: 'order:one',
    facts: [{ id: 'journal:one', kind: 'journal', label: '账本凭证', business_reference: 'order:one', state: 'posted', amount_minor: 100, currency: 'CNY', occurred_at: '2026-09-05T10:00:00.000Z', version: 1 }],
    events: [{ id: 'event:one', type: 'finance.entry.posted', event_version: 1, aggregate_type: 'journal', aggregate_id: 'journal:one', state: 'published', occurred_at: '2026-09-05T10:00:01.000Z', trace_id: 'trace:one' }],
    records: [{ id: 'audit:one', kind: 'command', action: 'finance.post', resource_type: 'journal', resource_id: 'journal:one', actor_id: 'actor:one', actor_type: 'member', before_hash: null, after_hash: 'a'.repeat(64), record_hash: 'b'.repeat(64), evidence: {}, occurred_at: '2026-09-05T10:00:02.000Z', trace_id: 'trace:one' }],
    watermark: '2026-09-05T10:00:02.000Z',
  };
}

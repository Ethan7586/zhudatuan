// @vitest-environment node
import { HttpResponse, delay, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { financeReconciliationKey } from '../viewmodel/FinanceQueryKey';
import { FinanceGateway } from './FinanceGateway';

const gateway = new FinanceGateway('http://localhost');

const requests: URL[] = [];
const server = setupServer(
  http.get('*/api/v1/finance/reconciliations', ({ request }) => {
    requests.push(new URL(request.url));
    expect(request.headers.get('x-scope-hint')).toBe('enterprise:1');
    expect(request.headers.get('x-access-version')).toBe('7');
    return HttpResponse.json(page());
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  requests.length = 0;
  server.resetHandlers();
});
afterAll(() => server.close());

describe('Finance gateway', () => {
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

  it('rejects a page whose count does not match its item payload', async () => {
    server.use(http.get('*/api/v1/finance/reconciliations', () => HttpResponse.json({ ...page(), count: 2 })));
    await expect(gateway.reconciliations(context(), { limit: 50 }, new AbortController().signal)).rejects.toThrow('FINANCE_PAGE_COUNT_MISMATCH');
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
    },
    profile: { display_name: '测试财务', employee_no: null },
    scope,
    scopes: [scope],
  };
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

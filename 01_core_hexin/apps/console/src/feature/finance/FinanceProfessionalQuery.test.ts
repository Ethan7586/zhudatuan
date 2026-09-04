// @vitest-environment node
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { readFinanceProfessional } from './FinanceProfessionalQuery';

interface RequestFact {
  readonly accessVersion: string | null;
  readonly path: string;
  readonly scope: string | null;
  readonly search: string;
}

const requests: RequestFact[] = [];
const server = setupServer(
  http.get('*/api/v1/finance/entries', ({ request }) => {
    remember(request);
    return HttpResponse.json(entryPage);
  }),
  http.get('*/api/v1/finance/settlements', ({ request }) => {
    remember(request);
    return HttpResponse.json(settlementPage);
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  requests.length = 0;
  server.resetHandlers();
});
afterAll(() => server.close());

describe('Finance professional authoritative reads', () => {
  it('normalizes the service entry and settlement payloads without a production fallback', async () => {
    const signal = new AbortController().signal;
    const [entries, settlements] = await Promise.all([readFinanceProfessional(context, 'entries', 'cursor:2', signal), readFinanceProfessional(context, 'settlements', 'cursor:3', signal)]);

    expect(entries).toEqual({
      items: [
        {
          id: 'entry:1',
          label: 'cash.wechat',
          reference: 'payment:PAY-20260824-0119',
          amountMinor: 11_900,
          currency: 'CNY',
          state: 'debit',
          occurredAt: '2026-08-24T13:26:00.000Z',
          version: null,
        },
      ],
      count: 1,
    });
    expect(settlements).toEqual({
      items: [
        {
          id: 'settlement:1',
          label: 'partner:mall:huimin · 2026-08-24',
          reference: 'reconciliation:1',
          amountMinor: 42_600,
          currency: 'CNY',
          state: 'payable',
          occurredAt: null,
          version: 3,
        },
      ],
      count: 1,
    });
    expect(requests).toHaveLength(2);
    expect(requests.every((request) => request.scope === 'enterprise:1')).toBe(true);
    expect(requests.every((request) => request.accessVersion === '9')).toBe(true);
    expect(requests.map((request) => new URLSearchParams(request.search).get('limit'))).toEqual(['50', '50']);
    expect(new Set(requests.map((request) => new URLSearchParams(request.search).get('cursor')))).toEqual(new Set(['cursor:2', 'cursor:3']));
  });

  it.each([
    ['entries', '/api/v1/finance/entries'],
    ['settlements', '/api/v1/finance/settlements'],
  ] as const)('rejects malformed %s records instead of synthesizing display data', async (section, path) => {
    server.use(http.get(`*${path}`, () => HttpResponse.json({ items: [{ id: 'malformed' }], count: 1 })));
    await expect(readFinanceProfessional(context, section, undefined, new AbortController().signal)).rejects.toThrow();
  });
});

const entryPage = Object.freeze({
  items: Object.freeze([
    Object.freeze({
      id: 'entry:1',
      side: 'debit',
      amount_minor: '11900',
      code: 'cash.wechat',
      currency: 'CNY',
      reference_type: 'payment',
      reference_id: 'PAY-20260824-0119',
      description: '微信渠道资金记账',
      posted_at: '2026-08-24T13:26:00.000Z',
    }),
  ]),
  count: 1,
});

const settlementPage = Object.freeze({
  items: Object.freeze([
    Object.freeze({
      id: 'settlement:1',
      scope_id: 'enterprise:1',
      partner_id: 'partner:mall:huimin',
      period: '2026-08-24',
      reconciliation_id: 'reconciliation:1',
      amount_minor: '42600',
      currency: 'CNY',
      state: 'payable',
      version: '3',
      gross_minor: '42600',
      fee_minor: '0',
      invoice_basis: '42600',
      lines: [],
      splits: [],
      adjustments: [],
    }),
  ]),
  count: 1,
});

const scope = { kind: 'enterprise', id: 'enterprise:1' } as const;
const context: ConsoleContext = {
  session: {
    actor: 'actor:finance',
    membership: 'membership:finance',
    accessVersion: 9,
    permissions: ['finance.entries.read', 'finance.settlements.read'],
    capabilities: ['finance.entries.read', 'finance.settlements.read'],
    target: 'console',
    scope,
    scopes: [scope],
    assurance: { level: 1 },
    syncedAt: '2026-08-24T13:31:00.000Z',
  },
  profile: { display_name: '测试财务', employee_no: null },
  scope,
  scopes: [scope],
};

function remember(request: Request): void {
  const url = new URL(request.url);
  requests.push({
    accessVersion: request.headers.get('x-access-version'),
    path: url.pathname,
    scope: request.headers.get('x-scope-hint'),
    search: url.search,
  });
}

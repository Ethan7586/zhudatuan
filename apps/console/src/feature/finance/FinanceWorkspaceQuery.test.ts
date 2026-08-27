// @vitest-environment node
import type { ScopeKind } from '@shop/authz';
import { HttpResponse, delay, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { readFinanceReconciliations, type FinanceReconciliationQuery } from './FinanceWorkspaceQuery';

interface RequestFact {
  readonly accessVersion: string | null;
  readonly scope: string | null;
  readonly url: URL;
}

const requests: RequestFact[] = [];
const server = setupServer(
  http.get('*/api/v1/finance/reconciliations', ({ request }) => {
    requests.push({ accessVersion: request.headers.get('x-access-version'), scope: request.headers.get('x-scope-hint'), url: new URL(request.url) });
    return HttpResponse.json(reconciliationPage());
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  requests.length = 0;
  server.resetHandlers();
});
afterAll(() => server.close());

describe('Finance reconciliation workspace query', () => {
  it('parses signed differences while preserving nested evidence and every local preview layer', async () => {
    const page = await readFinanceReconciliations(context('platform', 'platform:preview', 7), filter(), new AbortController().signal);

    expect(page.items[0]?.difference_minor).toBe(-11_900);
    expect(page.items[0]?.item_counts).toEqual({ matched: 2, difference: 1 });
    expect(page.items[0]?.items[0]).toMatchObject({
      id: 'difference:1',
      differenceMinor: -11_900,
      evidence: { reference: 'PAY-20260824-0119' },
    });
    expect(page.preview).toMatchObject({ source: 'local-preview', total: 7, pendingDifferenceCount: 1 });
    expect(page.items[0]?.preview).toMatchObject({ source: 'local-preview', batchId: 'RCN-20260824-WECHAT-001' });
    expect(page.items[0]?.items[0]?.preview).toMatchObject({
      source: 'local-preview',
      status: 'service-preview',
      result: { differenceBeforeMinor: -11_900, differenceAfterMinor: 0 },
      previewHash: 'preview:sha256:1',
    });
  });

<<<<<<< HEAD
  it('sends authoritative filters in every scope and always carries scope, access version, cursor, kind, and limit', async () => {
=======
  it('sends preview filters only for platform:preview and always carries scope, access version, cursor, and limit', async () => {
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
    const selected = filter({ cursor: 'cursor:2' });
    await readFinanceReconciliations(context('platform', 'platform:preview', 11), selected, new AbortController().signal);
    await readFinanceReconciliations(context('enterprise', 'enterprise:1', 12), selected, new AbortController().signal);

    const preview = requests[0];
    const production = requests[1];
    expect(preview).toMatchObject({ scope: 'platform:preview', accessVersion: '11' });
    expect(production).toMatchObject({ scope: 'enterprise:1', accessVersion: '12' });
    expect(preview?.url.searchParams.get('limit')).toBe('50');
    expect(preview?.url.searchParams.get('cursor')).toBe('cursor:2');
    expect(production?.url.searchParams.get('limit')).toBe('50');
    expect(production?.url.searchParams.get('cursor')).toBe('cursor:2');
<<<<<<< HEAD
    expect(preview?.url.searchParams.get('kind')).toBe('payment');
    expect(production?.url.searchParams.get('kind')).toBe('payment');
    for (const [key, value] of Object.entries(previewFilters)) {
      expect(preview?.url.searchParams.get(key), key).toBe(value);
      expect(production?.url.searchParams.get(key), key).toBe(value);
=======
    for (const [key, value] of Object.entries(previewFilters)) {
      expect(preview?.url.searchParams.get(key), key).toBe(value);
      expect(production?.url.searchParams.has(key), key).toBe(false);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
    }
  });

  it('propagates AbortSignal through the scoped SDK request', async () => {
    let markStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    server.use(
      http.get('*/api/v1/finance/reconciliations', async ({ request }) => {
        expect(request.headers.get('x-scope-hint')).toBe('enterprise:1');
        expect(request.headers.get('x-access-version')).toBe('23');
        markStarted?.();
        await delay('infinite');
        return HttpResponse.json(reconciliationPage());
      })
    );
    const controller = new AbortController();
    const pending = readFinanceReconciliations(context('enterprise', 'enterprise:1', 23), filter(), controller.signal);
    await started;
    controller.abort(new Error('SCOPE_CHANGED'));
    await expect(pending).rejects.toThrow();
  });

  it.each([
    ['partial page preview', () => ({ ...reconciliationPage(), preview: { source: 'local-preview', total: 7 } })],
    ['malformed item preview', malformedItemPreview],
  ])('rejects a %s payload instead of silently dropping it', async (_name, payload) => {
    server.use(http.get('*/api/v1/finance/reconciliations', () => HttpResponse.json(payload())));
    await expect(readFinanceReconciliations(context('platform', 'platform:preview', 7), filter(), new AbortController().signal)).rejects.toThrow();
  });

  it('rejects a page whose count does not match its item payload', async () => {
    server.use(http.get('*/api/v1/finance/reconciliations', () => HttpResponse.json({ ...reconciliationPage(), count: 2 })));
    await expect(readFinanceReconciliations(context('platform', 'platform:preview', 7), filter(), new AbortController().signal)).rejects.toThrow('FINANCE_PAGE_COUNT_MISMATCH');
  });
});

const previewFilters = Object.freeze({
  q: 'PAY-20260824-0119',
  period: '2026-08-24',
  channel: 'wechat',
  mall: 'mall:1',
  status: 'difference',
  difference: 'journal-missing',
});

function filter(overrides: Partial<FinanceReconciliationQuery> = {}): FinanceReconciliationQuery {
<<<<<<< HEAD
  return { ...previewFilters, kind: 'payment', limit: 50, ...overrides };
=======
  return { ...previewFilters, limit: 50, ...overrides };
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
}

function context(kind: ScopeKind, id: string, accessVersion: number): ConsoleContext {
  const scope = { kind, id };
  return {
    session: { actor: 'actor:finance', membership: 'membership:finance', accessVersion, permissions: [], capabilities: [], target: 'console', scope, scopes: [scope], assurance: { level: 3 }, syncedAt: '2026-08-26T00:00:00Z' },
    profile: { display_name: '测试财务', employee_no: null },
    scope,
    scopes: [scope],
  };
}

function reconciliationPage() {
  return {
    count: 1,
    nextCursor: 'cursor:3',
    preview: {
      source: 'local-preview',
      total: 7,
      page: 1,
      asOf: '2026-08-24T21:31:00+08:00',
      accountingDate: '2026-08-24',
      lastReconciledAt: '2026-08-24T21:26:00+08:00',
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
    items: [
      {
        id: 'reconciliation:1',
        scope_id: 'mall:1',
        provider: 'wechat',
        partner_id: 'partner:1',
        period: '2026-08-24/2026-08-24',
        statement_ref: 'statement:1',
        statement_hash: 'a'.repeat(64),
        debit_minor: '31500',
        credit_minor: '43400',
        difference_minor: '-11900',
        state: 'difference',
        evidence: { statement: 'channel:statement:1' },
        approved_by: null,
        updated_at: '2026-08-24T21:26:00+08:00',
        version: '7',
        item_counts: { matched: '2', difference: '1' },
        preview: {
          source: 'local-preview',
          batchId: 'RCN-20260824-WECHAT-001',
          accountingDate: '2026-08-24',
          channelLabel: '微信支付',
          dataSourceLabel: '渠道账单',
          scopeLabel: '鸿泰惠民通',
          expectedCount: 3,
          matchedCount: 2,
          differenceCount: 1,
          paymentChannel: 'wechat',
          mall: 'mall:1',
          differenceType: 'journal-missing',
          completedAt: '2026-08-24T21:26:00+08:00',
        },
        items: [
          {
            id: 'difference:1',
<<<<<<< HEAD
            version: '7',
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
            externalMinor: '31500',
            internalMinor: '43400',
            differenceMinor: '-11900',
            state: 'difference',
            reasonCode: 'JOURNAL_MISSING',
            evidence: { reference: 'PAY-20260824-0119' },
            resolution: null,
            resolvedBy: null,
            approvedBy: null,
            preview: repairPreview(),
          },
        ],
      },
    ],
  };
}

function repairPreview() {
  return {
    source: 'local-preview',
    status: 'service-preview',
    expiresAt: '2026-08-24T21:46:00+08:00',
    plan: { title: '重放记账事件', description: '恢复缺失的账本分录', operation: 'finance.reconciliations.manage', relatedPayment: 'PAY-20260824-0119', accountingDate: '2026-08-24', scope: 'mall:1' },
    entries: [
      { side: 'debit', account: 'cash', amountMinor: '11900', currency: 'CNY' },
      { side: 'credit', account: 'commerce.clearing', amountMinor: '11900', currency: 'CNY' },
    ],
    result: { ledgerBeforeMinor: '19600', ledgerAfterMinor: '31500', differenceBeforeMinor: '-11900', differenceAfterMinor: '0', settlementImpact: '重新计算当前结算基础' },
    checks: [{ label: '财务处理权限', state: 'passed', detail: 'AAL3' }],
    reason: 'payment.succeeded 记账事件未消费',
    evidence: [{ label: '渠道账单', value: 'SHA-256' }],
    previewHash: 'preview:sha256:1',
    idempotencyKey: 'FIN-20260824-0001',
    sourceHash: 'source:sha256:1',
    itemVersion: '7',
    previewVersion: '1',
  };
}

function malformedItemPreview() {
  const page = reconciliationPage();
  const row = page.items[0]!;
  const item = row.items[0]!;
  return { ...page, items: [{ ...row, items: [{ ...item, preview: { ...item.preview, source: 'server-preview' } }] }] };
}

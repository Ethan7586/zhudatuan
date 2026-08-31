// @vitest-environment node
import type { ScopeKind } from '@shop/authz';
import { HttpResponse, delay, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { financeAuditKey, financePoliciesKey, readFinanceAudit, readFinancePolicies } from './FinanceAuthorityQuery';

interface RequestFact {
  readonly accessVersion: string | null;
  readonly scope: string | null;
  readonly url: URL;
}

const requests: RequestFact[] = [];
const server = setupServer(
  http.get('*/api/v1/finance/policies', ({ request }) => {
    capture(request);
    return HttpResponse.json(policyPage());
  }),
  http.get('*/api/v1/finance/audits', ({ request }) => {
    capture(request);
    return HttpResponse.json(auditPage());
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  requests.length = 0;
  server.resetHandlers();
});
afterAll(() => server.close());

describe('Finance authority read queries', () => {
  it('uses the generated SDK with scope, access version, cursor, and limit in each authoritative read', async () => {
    const selected = context('mall', 'mall:huimin', 17);
    const input = { cursor: 'opaque:cursor:2', limit: 20 } as const;

    const [policies, audits] = await Promise.all([readFinancePolicies(selected, input, new AbortController().signal), readFinanceAudit(selected, input, new AbortController().signal)]);

    expect(policies.items[0]).toMatchObject({ id: 'finance.policy.reconciliation.wechat', version: 3, rule: { matchMode: 'one-to-one' } });
    expect(audits.items[0]).toMatchObject({ id: 'audit:finance:1', action: 'finance.reconciliations.approve', actor_id: 'actor:reviewer' });
    expect(audits.items[0]?.previous_hash).toBe('3'.repeat(64));
    expect(audits.items[0]?.record_hash).toBe('4'.repeat(64));
    expect(requests).toHaveLength(2);
    for (const request of requests) {
      expect(request).toMatchObject({ scope: 'mall:huimin', accessVersion: '17' });
      expect(request.url.searchParams.get('limit')).toBe('20');
      expect(request.url.searchParams.get('cursor')).toBe('opaque:cursor:2');
    }
  });

  it('keys every cache by operation, scope, access version, cursor, and limit', () => {
    const first = context('enterprise', 'enterprise:1', 7);
    const nextAccess = context('enterprise', 'enterprise:1', 8);
    expect(financePoliciesKey(first, { limit: 50 })).not.toEqual(financePoliciesKey(nextAccess, { limit: 50 }));
    expect(financePoliciesKey(first, { limit: 50 })).not.toEqual(financePoliciesKey(first, { cursor: 'next', limit: 50 }));
    expect(financePoliciesKey(first, { limit: 50 })).not.toEqual(financeAuditKey(first, { limit: 50 }));
  });

  it.each([
    ['page count mismatch', () => ({ ...policyPage(), count: 2 })],
    ['invalid audit chain hash', () => ({ ...auditPage(), items: [{ ...auditPage().items[0]!, record_hash: 'not-a-hash' }] })],
    ['untrusted preview source', () => ({ ...policyPage(), preview: { source: 'production-fixture', total: 1, page: 1 } })],
  ])('rejects %s instead of rendering unvalidated data', async (name, payload) => {
    const selected = context('enterprise', 'enterprise:1', 9);
    if (name === 'invalid audit chain hash') {
      server.use(http.get('*/api/v1/finance/audits', () => HttpResponse.json(payload())));
      await expect(readFinanceAudit(selected, { limit: 50 }, new AbortController().signal)).rejects.toThrow();
      return;
    }
    server.use(http.get('*/api/v1/finance/policies', () => HttpResponse.json(payload())));
    await expect(readFinancePolicies(selected, { limit: 50 }, new AbortController().signal)).rejects.toThrow();
  });

  it('propagates AbortSignal through an authority read', async () => {
    let markStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    server.use(
      http.get('*/api/v1/finance/audits', async ({ request }) => {
        capture(request);
        markStarted?.();
        await delay('infinite');
        return HttpResponse.json(auditPage());
      })
    );
    const controller = new AbortController();
    const pending = readFinanceAudit(context('platform', 'platform:preview', 23), { limit: 50 }, controller.signal);
    await started;
    controller.abort(new Error('SCOPE_CHANGED'));
    await expect(pending).rejects.toThrow();
  });
});

function capture(request: Request): void {
  requests.push({ accessVersion: request.headers.get('x-access-version'), scope: request.headers.get('x-scope-hint'), url: new URL(request.url) });
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

function policyPage() {
  return {
    items: [
      {
        id: 'finance.policy.reconciliation.wechat',
        scope_id: 'mall:huimin',
        kind: 'reconciliation',
        rule: { provider: 'wechat_pay', matchMode: 'one-to-one', toleranceMinor: 0 },
        state: 'active',
        version: '3',
      },
    ],
    count: 1,
    nextCursor: 'policy:cursor:3',
  };
}

function auditPage() {
  return {
    items: [
      {
        id: 'audit:finance:1',
        scope_id: 'mall:huimin',
        actor_id: 'actor:reviewer',
        actor_type: 'member',
        action: 'finance.reconciliations.approve',
        resource_type: 'finance',
        resource_id: 'reconciliation:1',
        before_hash: '1'.repeat(64),
        after_hash: '2'.repeat(64),
        evidence: { fourEyes: true, effectId: 'effect:1' },
        trace_id: 'trace:finance:1',
        previous_hash: '3'.repeat(64),
        record_hash: '4'.repeat(64),
        recorded_at: '2026-08-24T13:29:00.000Z',
      },
    ],
    count: 1,
    nextCursor: 'audit:cursor:2',
  };
}

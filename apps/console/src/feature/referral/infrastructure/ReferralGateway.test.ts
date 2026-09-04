// @vitest-environment node
import { HttpResponse, delay, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { createReferralCommand } from '../model/ReferralOperation';
import { referralQueryKey } from '../viewmodel/ReferralQueryKey';
import { ReferralGateway } from './ReferralGateway';

const gateway = new ReferralGateway('http://localhost');
const requests: URL[] = [];
let command: Readonly<{ body: unknown; headers: Headers }> | undefined;

const server = setupServer(
  http.get('*/api/v1/referral/commissions', ({ request }) => {
    requests.push(new URL(request.url));
    return HttpResponse.json(commissionPage());
  }),
  http.put('*/api/v1/referral/settings/:id', async ({ request }) => {
    command = { body: await request.json(), headers: request.headers };
    return HttpResponse.json(setting());
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  requests.length = 0;
  command = undefined;
  server.resetHandlers();
});
afterAll(() => server.close());

describe('Referral gateway', () => {
  it('maps and deeply freezes the authoritative promotion page', async () => {
    const result = await gateway.read(context(), 'promotion', 'cursor:2', new AbortController().signal);
    expect(result).toMatchObject({ section: 'promotion', count: 1, nextCursor: 'cursor:3' });
    expect(result.items[0]).toMatchObject({ amountMinor: 1288, status: 'available', settlementJournalId: 'journal:commission:1' });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.items[0])).toBe(true);
    expect(Object.fromEntries(requests[0]?.searchParams ?? [])).toEqual({ limit: '50', cursor: 'cursor:2' });
  });

  it('isolates query keys by section, cursor, scope and access version', () => {
    expect(referralQueryKey(context(), 'promotion', 'cursor:1')).not.toEqual(referralQueryKey(context(), 'promotion', 'cursor:2'));
    expect(referralQueryKey(context(), 'promotion')).not.toEqual(referralQueryKey(context(), 'withdrawal'));
  });

  it('propagates cancellation and rejects inconsistent page counts', async () => {
    server.use(
      http.get('*/api/v1/referral/commissions', async () => {
        await delay('infinite');
        return HttpResponse.json(commissionPage());
      })
    );
    const controller = new AbortController();
    const pending = gateway.read(context(), 'promotion', undefined, controller.signal);
    controller.abort(new Error('SCOPE_CHANGED'));
    await expect(pending).rejects.toThrow();

    server.use(http.get('*/api/v1/referral/commissions', () => HttpResponse.json({ ...commissionPage(), count: 2 })));
    await expect(gateway.read(context(), 'promotion')).rejects.toThrow('REFERRAL_PAGE_COUNT_MISMATCH');
  });

  it('binds a write to scope, version, stable identity, CSRF and one-time proof', async () => {
    const item = setting();
    const action = { kind: 'setting' as const, item, label: '编辑分销设定' };
    const values = { action, reason: '年度分销政策调整', enabled: false, recruitEnabled: true, reviewRequired: false, rewardEnabled: true, bindingMode: 'days' as const, firstTouchDays: 30, freezeDays: 14, settlementTrigger: 'paid' as const, rateBasisPoints: 800, rewardBasisPoints: 0, minimumWithdrawalMinor: 5000, monthlyWithdrawalLimit: 3, currency: 'CNY' };
    await gateway.execute(context(), createReferralCommand(values), 'a'.repeat(43), 'command:referral:1');
    expect(command?.body).toEqual({ enabled: false, recruitEnabled: true, reviewRequired: false, rewardEnabled: true, bindingMode: 'days', firstTouchDays: 30, freezeDays: 14, settlementTrigger: 'paid', rateBasisPoints: 800, minimumWithdrawalMinor: 5000, monthlyWithdrawalLimit: 3, currency: 'CNY', expectedVersion: 7, reason: '年度分销政策调整' });
    expect(command?.headers.get('x-scope-hint')).toBe('mall:1');
    expect(command?.headers.get('if-match')).toBe('"7"');
    expect(command?.headers.get('idempotency-key')).toBe('command:referral:1');
    expect(command?.headers.get('x-action-proof')).toBe('a'.repeat(43));
    expect(command?.headers.get('x-csrf-token')).toBe('csrf:referral:1234');
  });
});

function context(): ConsoleContext {
  const scope = { kind: 'mall' as const, id: 'mall:1' };
  return {
    session: {
      actor: 'actor:referral',
      membership: 'membership:referral',
      accessVersion: 7,
      permissions: [],
      capabilities: [],
      target: 'console',
      scope,
      scopes: [scope],
      assurance: { level: 3 },
      security: { hasLocalCredential: true, phoneMasked: '138****0000', passwordChangedAt: null },
      syncedAt: '2026-08-26T00:00:00Z',
      csrf: 'csrf:referral:1234',
    },
    profile: { display_name: '测试分销', employee_no: null },
    scope,
    scopes: [scope],
  };
}

function setting() {
  return { id: 'referralsetting:1', scopeId: 'scope:1', enabled: true, recruitEnabled: true, reviewRequired: true, rewardEnabled: true, bindingMode: 'days' as const, firstTouchDays: 7, freezeDays: 7, settlementTrigger: 'received' as const, rateBasisPoints: 500, minimumWithdrawalMinor: 1000, monthlyWithdrawalLimit: 3, currency: 'CNY', version: 7, updatedAt: '2026-08-26T00:00:00Z' };
}
function commissionPage() {
  return {
    items: [
      {
        id: 'referralcommission:1',
        orderId: 'order:1',
        orderLineId: 'orderline:1',
        ruleId: 'referralproduct:1',
        ruleVersion: 2,
        attributionId: 'referralbinding:1',
        promoterId: 'referralmember:1',
        kind: 'reward',
        status: 'available',
        amountMinor: 1288,
        baseMinor: 12880,
        refundedBaseMinor: 0,
        reversedMinor: 0,
        rateBasisPoints: 1000,
        currency: 'CNY',
        availableAt: '2026-08-26T00:00:00Z',
        settlementJournalId: 'journal:commission:1',
        version: 3,
      },
    ],
    count: 1,
    nextCursor: 'cursor:3',
  };
}

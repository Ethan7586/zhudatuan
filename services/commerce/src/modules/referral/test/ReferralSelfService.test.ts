import { describe, expect, it, vi } from 'vitest';
import type { HandlerContext } from '../../../pipeline/HandlerContext';
import type { ReadTransactionContext } from '../../../platform/database/TransactionContext';
import { EarningsReadHandler } from '../application/handler/EarningsReadHandler';
import { LinksReadHandler } from '../application/handler/LinksReadHandler';
import type { Clock } from '../application/port/Clock';
import type { CommissionRepository } from '../application/port/CommissionRepository';
import type { ReferralRepository } from '../application/port/ReferralRepository';
import type { ReferralToken } from '../domain/value/ReferralToken';

const transaction = {} as ReadTransactionContext;
const eligible = Object.freeze({ scopeId: 'mall:one', memberId: 'member:one' });

describe('referral self service', () => {
  it('returns a bounded earnings page beside the server-calculated summary', async () => {
    const referrals = { eligible: vi.fn().mockResolvedValue(eligible) } as unknown as ReferralRepository;
    const commissions = {
      earnings: vi.fn().mockResolvedValue({ availableMinor: 300, pendingMinor: 200, settledMinor: 100, reversedMinor: 0, currency: 'CNY', version: 4 }),
      read: vi.fn().mockResolvedValue([{ id: 'referralcommission:one' }, { id: 'referralcommission:two' }, { id: 'referralcommission:three' }]),
    } as unknown as CommissionRepository;
    const result = await new EarningsReadHandler(referrals, commissions).execute({ query: { limit: 2 } }, context('referral.earnings.read'));
    expect(result.body).toMatchObject({ availableMinor: 300, count: 2, items: [{ id: 'referralcommission:one' }, { id: 'referralcommission:two' }] });
    expect(result.body.nextCursor).toBeTypeOf('string');
    expect(commissions.read).toHaveBeenCalledWith(transaction, 'mall:one', 'member:one', expect.objectContaining({ limit: 2, fetch: 3 }));
  });

  it('issues a query-style link that every storefront route can consume', async () => {
    const token = `${'a'.repeat(32)}.${'b'.repeat(43)}`;
    const referrals = {
      eligible: vi.fn().mockResolvedValue(eligible),
      link: vi.fn().mockResolvedValue({ promoterId: 'referralmember:one', firstTouchDays: 7, settingVersion: 2 }),
    } as unknown as ReferralRepository;
    const tokens = { issue: vi.fn().mockReturnValue(token) } as unknown as ReferralToken;
    const clock = { now: () => new Date('2026-09-07T00:00:00.000Z') } as Clock;
    const result = await new LinksReadHandler(referrals, tokens, clock).execute({ query: { productId: 'product:one' } }, context('referral.links.read'));
    expect(result.body.url).toBe(`?referral=${encodeURIComponent(token)}&product=product%3Aone`);
    expect(result.body.productId).toBe('product:one');
  });
});

function context<T extends 'referral.earnings.read' | 'referral.links.read'>(operation: T): HandlerContext<T> {
  return {
    requestId: 'request:one',
    traceId: 'trace:one',
    deadline: Date.now() + 1_000,
    signal: new AbortController().signal,
    operation,
    headers: {},
    rawBody: '',
    transaction,
    security: {
      kind: 'session',
      access: {
        actor: { id: 'principal:one', session: 'session:one', membership: 'membership:one', credentialVersion: 1, accessVersion: 1, target: 'storefront', assurance: { level: 2 } },
        membership: { id: 'membership:one', active: true, accessVersion: 1, permissions: { allows: new Set(), denies: new Set() }, scopes: [] },
        organization: 'mall:one',
        scope: { id: 'mall:one', kind: 'mall', path: [] },
        accessVersion: 1,
        roles: [],
        capabilities: new Set([operation]),
        capabilityVersion: 1,
        assurance: { level: 2 },
        trace: 'trace:one',
      },
    },
  } as HandlerContext<T>;
}

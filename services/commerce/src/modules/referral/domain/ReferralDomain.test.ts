import { describe, expect, it } from 'vitest';
import { Commission } from './model/Commission';
import { ReferralBinding, type ReferralBindingState } from './model/ReferralBinding';
import { AttributionPolicy } from './policy/AttributionPolicy';
import { CommissionPolicy } from './policy/CommissionPolicy';
import { SettlementPolicy } from './policy/SettlementPolicy';
import { WithdrawalPolicy } from './policy/WithdrawalPolicy';

const now = new Date('2026-09-05T08:00:00.000Z');

describe('Referral domain', () => {
  it('keeps an unexpired first-touch attribution and permits replacement only after expiry', () => {
    const policy = new AttributionPolicy();
    const existing = binding({ id: 'referralbinding:first', expiresAt: '2026-09-06T08:00:00.000Z' });
    const candidate = binding({ id: 'referralbinding:next', promoterId: 'referralmember:next', promoterMemberId: 'member:next' });
    expect(policy.choose(existing, candidate, ['member:next', 'member:root'], now)).toBe(existing);
    expect(policy.choose(binding({ expiresAt: null }), candidate, ['member:next'], now).id).not.toBe(candidate.id);
    expect(policy.choose(binding({ expiresAt: '2026-09-04T08:00:00.000Z' }), candidate, ['member:next'], now)).toBe(candidate);
  });

  it('allows a bounded multi-level chain but rejects self and circular recommendations', () => {
    const policy = new AttributionPolicy();
    const candidate = binding();
    expect(policy.choose(undefined, candidate, ['member:promoter', 'member:parent'], now)).toBe(candidate);
    expect(() => policy.choose(undefined, binding({ promoterMemberId: 'member:customer' }), ['member:customer'], now)).toThrow('REFERRAL_SELF_REFERRAL_FORBIDDEN');
    expect(() => policy.choose(undefined, candidate, ['member:promoter', 'member:customer'], now)).toThrow('REFERRAL_CIRCULAR_REFERRAL_FORBIDDEN');
    expect(() => policy.choose(undefined, candidate, ['member:promoter', 'member:promoter'], now)).toThrow('REFERRAL_RELATION_PATH_INVALID');
  });

  it('uses original rate evidence for cumulative refund reversal without rounding drift', () => {
    const policy = new AttributionPolicy();
    expect(policy.refundReversal(101n, 34n, 3333)).toBe(11n);
    expect(policy.refundReversal(101n, 101n, 3333)).toBe(33n);
    expect(() => policy.refundReversal(100n, 101n, 500)).toThrow('REFERRAL_REFUND_AMOUNT_INVALID');
  });

  it('allocates deterministic integer commission remainders and retains immutable rule evidence', () => {
    const policy = new CommissionPolicy();
    const allocation = policy.allocate(
      [
        { id: 'line:b', amountMinor: 1n },
        { id: 'line:a', amountMinor: 1n },
        { id: 'line:c', amountMinor: 1n },
      ],
      3n,
      5000
    );
    expect([...allocation]).toEqual([
      ['line:a', 1n],
      ['line:b', 0n],
      ['line:c', 0n],
    ]);
    expect([...policy.bases([{ id: 'line:a', amountMinor: 101n }, { id: 'line:b', amountMinor: 99n }], 51n)]).toEqual([
      ['line:a', 75n],
      ['line:b', 74n],
    ]);
    expect(
      [...policy.refundDeltas([
        { id: 'commission:a', lineId: 'line:a', baseMinor: 100n, refundedBaseMinor: 0n },
        { id: 'reward:a', lineId: 'line:a', baseMinor: 100n, refundedBaseMinor: 0n },
        { id: 'commission:b', lineId: 'line:b', baseMinor: 100n, refundedBaseMinor: 0n },
      ], 50n)]
    ).toEqual([
      ['commission:a', 25n],
      ['reward:a', 25n],
      ['commission:b', 25n],
    ]);
    expect(commission()).toMatchObject({ orderLineId: 'orderline:one', ruleId: 'referralproduct:one', ruleVersion: 3, attributionId: 'referralbinding:one', kind: 'commission', baseMinor: 10_000n, rateBasisPoints: 500 });
    expect(
      policy.recipients({ customerId: 'member:buyer', directMemberId: 'member:direct', inviterMemberId: 'member:inviter', rewardEnabled: true, commissionBasisPoints: 800, rewardBasisPoints: 200 })
    ).toEqual([
      { beneficiaryId: 'member:direct', kind: 'commission', rateBasisPoints: 800 },
      { beneficiaryId: 'member:inviter', kind: 'reward', rateBasisPoints: 200 },
    ]);
    expect(policy.recipients({ customerId: 'member:buyer', directMemberId: 'member:direct', inviterMemberId: null, rewardEnabled: true, commissionBasisPoints: 800, rewardBasisPoints: 200 })).toHaveLength(1);
    expect(policy.recipients({ customerId: 'member:buyer', directMemberId: 'member:direct', inviterMemberId: 'member:third', rewardEnabled: false, commissionBasisPoints: 800, rewardBasisPoints: 200 })).toHaveLength(1);
    expect(() => policy.recipients({ customerId: 'member:buyer', directMemberId: 'member:direct', inviterMemberId: 'member:third', rewardEnabled: true, commissionBasisPoints: 9900, rewardBasisPoints: 200 })).toThrow('REFERRAL_RATE_TOTAL_INVALID');
  });

  it('separates freeze eligibility, approval and withdrawal balance decisions', () => {
    const settlement = new SettlementPolicy();
    expect(settlement.releaseAt(now.toISOString(), 7)).toBe('2026-09-12T08:00:00.000Z');
    expect(settlement.eligible('available', '2026-09-12T08:00:00.000Z', new Date('2026-09-12T08:00:00.000Z'))).toBe(true);
    const withdrawal = new WithdrawalPolicy();
    expect(() => withdrawal.assertApproval({ requesterId: 'membership:maker', checkerId: 'membership:maker', subjectId: 'withdrawal:one', withdrawalId: 'withdrawal:one', action: 'referral.withdrawal.pay' })).toThrow();
    expect(() => withdrawal.assertApproval({ requesterId: 'membership:maker', checkerId: 'membership:checker', subjectId: 'withdrawal:other', withdrawalId: 'withdrawal:one', action: 'referral.withdrawal.pay' })).toThrow();
    expect(withdrawal.assertApproval({ requesterId: 'membership:maker', checkerId: 'membership:checker', subjectId: 'withdrawal:one', withdrawalId: 'withdrawal:one', action: 'referral.withdrawal.pay' })).toBeUndefined();
    expect(() => withdrawal.assertRequest({ amountMinor: 1_000n, currency: 'CNY' } as never, { amountMinor: 2_000n, currency: 'CNY' } as never, 100n, false, 3, 3)).toThrow('REFERRAL_WITHDRAWAL_CONFLICT');
  });
});

function binding(overrides: Partial<{ id: string; promoterId: string; promoterMemberId: string; expiresAt: string | null; state: ReferralBindingState }> = {}) {
  return new ReferralBinding(
    overrides.id ?? 'referralbinding:one',
    'mall:one',
    'member:customer',
    overrides.promoterId ?? 'referralmember:one',
    overrides.promoterMemberId ?? 'member:promoter',
    'a'.repeat(64),
    'storefront',
    '2026-09-01T08:00:00.000Z',
    overrides.expiresAt === undefined ? '2026-09-30T08:00:00.000Z' : overrides.expiresAt,
    overrides.state ?? 'active',
    1
  );
}

function commission() {
  return new Commission('referralcommission:one', 'commission:one', 'mall:one', 'order:one', 'orderline:one', 'referralproduct:one', 3, 'referralbinding:one', 'member:promoter', 'commission', 10_000n, 0n, 500, 500n, 'CNY', 'pending', 0n, 1);
}

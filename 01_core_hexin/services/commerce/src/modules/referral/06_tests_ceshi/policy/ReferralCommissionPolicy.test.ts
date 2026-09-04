import { describe, expect, it } from 'vitest';
import {
  commissionAmount,
  commissionableBases,
  commissionRecipients,
  cumulativeRefundBases,
  cumulativeReversalAmount,
  entersSettling,
  stateAfterReversal,
} from '../../02_domain_yewu/policy/ReferralCommissionPolicy';

describe('ReferralCommissionPolicy', () => {
  it('produces no commission without an active direct binding', () => {
    expect(
      commissionRecipients({ directMemberId: null, inviterMemberId: 'member:unused', rewardEnabled: true, commissionBps: 500, rewardBps: 100 })
    ).toEqual([]);
  });

  it('pays the direct member and one immediate inviter without following another ancestor', () => {
    const input = {
      directMemberId: 'member:direct',
      inviterMemberId: 'member:inviter',
      inviterOfInviterMemberId: 'member:third',
      rewardEnabled: true,
      commissionBps: 500,
      rewardBps: 100,
    };
    expect(commissionRecipients(input)).toEqual([
      { beneficiaryMemberId: 'member:direct', kind: 'commission', rateBps: 500 },
      { beneficiaryMemberId: 'member:inviter', kind: 'reward', rateBps: 100 },
    ]);
  });

  it('excludes the benefit-funded share and floors line bases and bps in minor units', () => {
    const bases = commissionableBases(
      [
        { id: 'line:a', amountMinor: 700n },
        { id: 'line:b', amountMinor: 300n },
      ],
      333n
    );
    expect(bases).toEqual([
      { id: 'line:a', amountMinor: 466n },
      { id: 'line:b', amountMinor: 200n },
    ]);
    expect(commissionAmount(bases[0]!.amountMinor, 500)).toBe(23n);
  });

  it('honours the configured settlement trigger', () => {
    expect(entersSettling('on_paid', 'paid')).toBe(true);
    expect(entersSettling('on_paid', 'received')).toBe(false);
    expect(entersSettling('on_received', 'paid')).toBe(false);
    expect(entersSettling('on_received', 'received')).toBe(true);
  });

  it('calculates cumulative partial and full reversals without rounding drift', () => {
    expect(cumulativeReversalAmount(999n, 333, 100n)).toBe(4n);
    expect(cumulativeReversalAmount(999n, 333, 999n)).toBe(33n);
    expect(stateAfterReversal('pending', 33n, 4n)).toBe('pending');
    expect(stateAfterReversal('settled', 33n, 33n)).toBe('reversed');
  });

  it('applies line-specific refunds first and splits order-wide refunds exactly', () => {
    const result = cumulativeRefundBases(
      [
        { id: 'line:a', amountMinor: 600n },
        { id: 'line:b', amountMinor: 400n },
      ],
      [
        { lineId: 'line:a', amountMinor: 100n },
        { lineId: null, amountMinor: 101n },
      ]
    );
    expect(result).toEqual(new Map([['line:a', 156n], ['line:b', 45n]]));
  });
});

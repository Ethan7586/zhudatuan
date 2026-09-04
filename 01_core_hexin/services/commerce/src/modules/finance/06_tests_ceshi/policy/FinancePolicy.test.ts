import { describe, expect, it } from 'vitest';
import { Money } from '@shop/kernel';
import { PostingPolicy } from '../../02_domain_yewu/policy/PostingPolicy';
import { SettlementPolicy } from '../../02_domain_yewu/policy/SettlementPolicy';

describe('finance policies', () => {
  it('accepts a balanced journal and rejects a difference', () => {
    const policy = new PostingPolicy();
    expect(() => policy.assertBalanced([
      { side: 'debit', amount: Money.of(100) }, { side: 'credit', amount: Money.of(100) },
    ])).not.toThrow();
    expect(() => policy.assertBalanced([
      { side: 'debit', amount: Money.of(100) }, { side: 'credit', amount: Money.of(99) },
    ])).toThrow('FINANCE_JOURNAL_UNBALANCED');
  });

  it('enforces four eyes and a positive settlement amount', () => {
    const policy = new SettlementPolicy();
    expect(() => policy.assertDecision('requester', 'approver', 1)).not.toThrow();
    expect(() => policy.assertDecision('same', 'same', 1)).toThrow('FINANCE_SETTLEMENT_SEPARATION_REQUIRED');
    expect(() => policy.assertDecision('requester', 'approver', 0)).toThrow('FINANCE_SETTLEMENT_AMOUNT_INVALID');
  });

  it('freezes a deterministic partner and platform split', () => {
    const policy = new SettlementPolicy();
    expect(policy.split(10_001, { basisPoints: 350, invoiceBasis: 'net' })).toEqual({
      grossMinor: 10_001, feeMinor: 350, netMinor: 9_651, invoiceBasis: 'net', basisPoints: 350,
    });
    expect(() => policy.split(100, { basisPoints: 5_001 })).toThrow('FINANCE_SETTLEMENT_FEE_INVALID');
    expect(() => policy.split(100, { invoiceBasis: 'other' })).toThrow('FINANCE_SETTLEMENT_INVOICE_BASIS_INVALID');
  });
});

import { describe, expect, it } from 'vitest';
import { AfterSaleRefundPolicy } from './AfterSaleRefundPolicy';

describe('AfterSaleRefundPolicy', () => {
  const policy = new AfterSaleRefundPolicy();

  it('prorates in integer minor units without over-refunding', () => {
    expect(policy.prorate(10_001, 3, 1)).toBe(3_333);
    expect(policy.prorate(10_001, 3, 3)).toBe(10_001);
  });

  it('rejects invalid quantities and unsafe numbers', () => {
    expect(() => policy.prorate(1_000, 2, 3)).toThrow('ORDER_AFTERSALE_NOT_ALLOWED');
    expect(() => policy.prorate(Number.MAX_SAFE_INTEGER + 1, 2, 1)).toThrow('VALIDATION_FAILED');
  });

  it('previews the same deterministic reverse-tender refund order as Payment', () => {
    expect(
      policy.plan(7_000, {
        tenders: [
          { kind: 'benefit', reference: 'account:one', amountMinor: 8_000 },
          { kind: 'wechat', reference: null, amountMinor: 4_000 },
        ],
      })
    ).toEqual([
      { kind: 'wechat', reference: null, amountMinor: 4_000 },
      { kind: 'benefit', reference: 'account:one', amountMinor: 3_000 },
    ]);
  });

  it('subtracts prior non-rejected after-sale tender claims', () => {
    const evidence = {
      tenders: [
        { kind: 'benefit', reference: 'account:one', amountMinor: 8_000 },
        { kind: 'wechat', reference: null, amountMinor: 4_000 },
      ],
    };
    expect(policy.plan(5_000, evidence, [{ tenders: [{ kind: 'wechat', reference: null, amountMinor: 3_000 }] }])).toEqual([
      { kind: 'wechat', reference: null, amountMinor: 1_000 },
      { kind: 'benefit', reference: 'account:one', amountMinor: 4_000 },
    ]);
  });
});

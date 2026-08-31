import { describe, expect, it } from 'vitest';
import { mapBenefitCenter } from './infrastructure/BenefitMapper';
describe('benefit mapping', () => {
  it('keeps ledger signs and minor units', () => {
    const value = mapBenefitCenter(
      [],
      [{ id: 'entry:1', account: 'account:1', kind: 'consume', currency: 'CNY', amountMinor: -1200, referenceType: 'order', referenceId: 'order:1', description: '订单消费', occurredAt: '2026-08-31T00:00:00Z' }]
    );
    expect(value.ledger[0]?.amountMinor).toBe(-1200);
  });
});

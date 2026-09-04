import { describe, expect, it } from 'vitest';
import { mapActivity, mapVoucher } from './infrastructure/VoucherMapper';

describe('voucher mapping', () => {
  it('keeps integer minor units and the authoritative product name', () => {
    const value = mapVoucher({ id: 'voucher:1', numberMasked: 'VC****01', scopeId: 'mall:1', product: 'product:1', productName: '电影券', credential: 'credential:1', holder: 'member:1', initialMinor: 5000, remainingMinor: 3000, currency: 'CNY', state: 'active', validity: { startsAt: '2026-01-01T00:00:00Z', expiresAt: '2026-12-31T00:00:00Z' }, version: 1, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' });
    expect(value.remainingMinor).toBe(3000);
    expect(value.productName).toBe('电影券');
  });

  it('maps a lifecycle item without exposing the actor', () => {
    const value = mapActivity({ sequence: 2, previous: 'bound', next: 'active', reason: 'activation', actor: 'account:1', occurredAt: '2026-01-02T00:00:00Z', redemption: null });
    expect(value).toEqual({ sequence: 2, previous: 'bound', next: 'active', reason: 'activation', occurredAt: '2026-01-02T00:00:00Z', redemption: null });
  });
});

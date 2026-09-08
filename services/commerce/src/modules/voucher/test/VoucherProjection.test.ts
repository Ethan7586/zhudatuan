import { describe, expect, it } from 'vitest';
import { normalize, page } from '../infrastructure/persistence/VoucherSupport';

describe('voucher query projections', () => {
  it('uses timeline sequence as a stable cursor instead of a missing id', () => {
    expect(page<'voucher.vouchers.timeline'>([{ sequence: 2 }, { sequence: 5 }, { sequence: 6 }], 2, 'sequence').body).toEqual({ items: [{ sequence: 2 }, { sequence: 5 }], count: 2, nextCursor: '5' });
    expect(page<'voucher.vouchers.timeline'>([{ sequence: 2 }], 2, 'sequence').body).toEqual({ items: [{ sequence: 2 }], count: 1 });
  });

  it('normalizes PostgreSQL JSON timestamp offsets to contract UTC without altering free text', () => {
    expect(normalize({ validity: { startsAt: '2026-09-05T08:00:00+08:00', expiresAt: '2026-09-06T00:00:00+00:00' }, redemption: { redeemedAt: '2026-09-05T00:30:00.123456+00:00' }, reason: '2026-09-05T08:00:00+08:00' })).toEqual({
      validity: { startsAt: '2026-09-05T00:00:00.000Z', expiresAt: '2026-09-06T00:00:00.000Z' },
      redemption: { redeemedAt: '2026-09-05T00:30:00.123Z' },
      reason: '2026-09-05T08:00:00+08:00',
    });
  });
});

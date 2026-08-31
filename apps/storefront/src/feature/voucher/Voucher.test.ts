import { describe, expect, it } from 'vitest';
import { mapVoucherCenter } from './infrastructure/VoucherMapper';
describe('voucher mapping', () => {
  it('keeps integer minor units', () => {
    const value = mapVoucherCenter([{ id: 'voucher:1', program_id: 'program:1', name: '电影券', initial_minor: 5000, remaining_minor: 3000, state: 'active', expires_at: '2026-12-31T00:00:00Z', version: 1 }], []);
    expect(value.vouchers[0]?.remainingMinor).toBe(3000);
  });
});

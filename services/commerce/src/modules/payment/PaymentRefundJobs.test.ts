import { describe, expect, it } from 'vitest';
import { afterSaleRefundRunnable } from './PaymentRefundJobs';

describe('Payment aftersale refund gate', () => {
  it('starts only after the Order aggregate reaches refunding', () => {
    expect(afterSaleRefundRunnable('refunding')).toBe(true);
    for (const state of ['applied', 'reviewing', 'approved', 'returning', 'received', 'resolved', 'rejected']) {
      expect(afterSaleRefundRunnable(state)).toBe(false);
    }
  });
});

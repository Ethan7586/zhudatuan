import { describe, expect, it } from 'vitest';
import { productionError } from '../failure/Failure';

describe('productionError', () => {
  it('translates a client-side checkout rejection into plain Chinese', () => {
    const error = productionError(new Error('CHECKOUT_REJECTED'));

    expect(error.code).toBe('CHECKOUT_REJECTED');
    expect(error.message).toBe('部分商品暂不满足结算条件，请返回购物车重新选择');
  });

  it('does not expose diagnostic suffixes from a known failure code', () => {
    const error = productionError(new Error('CHECKOUT_REJECTED:listing:test:LISTING_VERSION_CHANGED'));

    expect(error.code).toBe('CHECKOUT_REJECTED');
    expect(error.message).not.toContain('LISTING_VERSION_CHANGED');
  });
});

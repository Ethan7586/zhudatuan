import { describe, expect, it } from 'vitest';
import { purchaseAvailabilityMessage } from './purchaseAvailabilityMessage';

describe('purchaseAvailabilityMessage', () => {
  it('does not mislabel an inventory gap as a city restriction', () => {
    expect(purchaseAvailabilityMessage('OUT_OF_STOCK')).toBe('该商品暂时缺货，补货后可加入购物车');
  });

  it('keeps specific reasons specific', () => {
    expect(purchaseAvailabilityMessage('PRICE_UNAVAILABLE')).toBe('该商品暂未配置可用价格');
    expect(purchaseAvailabilityMessage('LISTING_UNAVAILABLE')).toBe('该商品当前未上架');
    expect(purchaseAvailabilityMessage('PURCHASE_LIMIT_EXCEEDED')).toBe('已达到该商品的限购上限');
  });

  it('uses a neutral fallback for unknown server reasons', () => {
    expect(purchaseAvailabilityMessage('CITY_NOT_ELIGIBLE')).toBe('该商品暂不可购买，请稍后重试');
  });
});

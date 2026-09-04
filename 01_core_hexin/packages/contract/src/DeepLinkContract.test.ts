import { describe, expect, it } from 'vitest';
import { miniappDeepLink, parseDeepLink } from './DeepLinkContract';

describe('DeepLinkContract', () => {
  it('round-trips allowlisted product and order targets', () => {
    expect(parseDeepLink('/page/productdetail/index?id=product%3A1')).toEqual({ route: 'productdetail', id: 'product%3A1' });
    expect(miniappDeepLink({ route: 'orderdetail', id: 'order%3A1' })).toBe('/page/orderdetail/index?id=order%3A1');
  });

  it('rejects pages and query keys outside the contract', () => {
    expect(() => parseDeepLink('/page/profile/index?id=owner:1')).toThrow('DEEPLINK_INVALID');
    expect(() => parseDeepLink('/page/productdetail/index?id=a&admin=1')).toThrow('DEEPLINK_INVALID');
  });
});

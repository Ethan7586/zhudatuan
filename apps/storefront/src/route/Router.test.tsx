import { describe, expect, it } from 'vitest';
import { RouteRegistry } from '../app/RouteRegistry';
import { resolveRoutePath, routePath, ROUTES } from '../generated/RouteBinding';

describe('storefront router', () => {
  it('registers every generated route exactly once through feature manifests', () => {
    const ids = RouteRegistry.routes().map(({ routeid }) => routeid);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(Object.keys(ROUTES).sort());
  });

  it('encodes valid route parameters and rejects missing values', () => {
    expect(routePath('storeproduct', { productId: 'listing:one' })).toBe('/products/listing%3Aone');
    expect(routePath('storeorder', { orderId: 'order:one' })).toBe('/orders/order%3Aone');
    expect(() => resolveRoutePath('storeproduct', {})).toThrow('ROUTE_PARAMETER_INVALID');
    expect(() => resolveRoutePath('storeproduct', { productId: 'one', unexpected: 'value' })).toThrow('ROUTE_PARAMETER_UNKNOWN');
  });
});

import { describe, expect, it } from 'vitest';
import { NAVIGATION_ROUTE_IDS } from '../generated/NavigationBinding';
import { matchRoutePath, resolveRoutePath, ROUTES } from '../generated/RouteBinding';
import { STORE_ROUTES } from './RouteRegistry';

describe('store route registry', () => {
  it('binds every generated route to a real feature reader', () => {
    expect(Object.keys(STORE_ROUTES).sort()).toEqual(Object.keys(ROUTES).sort());
    expect(Object.values(STORE_ROUTES).every((route) => typeof route.load === 'function')).toBe(true);
    expect(NAVIGATION_ROUTE_IDS.every((id) => id in STORE_ROUTES)).toBe(true);
    expect(Object.values(STORE_ROUTES).every((route) => route.scope === 'store' && route.capability === route.operation && route.breadcrumbs.length > 0)).toBe(true);
    expect(STORE_ROUTES.storefulfillment.operation).toBe('order.orders.read');
  });

  it('matches encoded scoped routes without accepting malformed paths', () => {
    const path = resolveRoutePath('storeorderswork', { scopeKind: 'store', scopeId: 'store:west/1' });
    expect(matchRoutePath(path)).toEqual({ id: 'storeorderswork', parameters: { scopeKind: 'store', scopeId: 'store:west/1' } });
    expect(matchRoutePath('/scopes/store/%E0%A4%A/orders')).toBeUndefined();
  });
});

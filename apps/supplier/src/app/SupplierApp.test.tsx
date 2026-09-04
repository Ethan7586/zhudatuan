import { describe, expect, it } from 'vitest';
import { NAVIGATION_ROUTE_IDS } from '../generated/NavigationBinding';
import { matchRoutePath, resolveRoutePath, ROUTES } from '../generated/RouteBinding';
import { SUPPLIER_ROUTES } from './RouteRegistry';

describe('supplier route registry', () => {
  it('binds every generated route to a real feature reader', () => {
    expect(Object.keys(SUPPLIER_ROUTES).sort()).toEqual(Object.keys(ROUTES).sort());
    expect(Object.values(SUPPLIER_ROUTES).every((route) => typeof route.load === 'function')).toBe(true);
    expect(NAVIGATION_ROUTE_IDS.every((id) => id in SUPPLIER_ROUTES)).toBe(true);
    expect(Object.values(SUPPLIER_ROUTES).every((route) => route.scope === 'supplier' && route.capability === route.operation && route.breadcrumbs.length > 0)).toBe(true);
  });

  it('matches encoded scoped routes without accepting malformed encoding', () => {
    const path = resolveRoutePath('suppliercatalog', { scopeKind: 'supplier', scopeId: 'supplier:north/1' });
    expect(matchRoutePath(path)).toEqual({ id: 'suppliercatalog', parameters: { scopeKind: 'supplier', scopeId: 'supplier:north/1' } });
    expect(matchRoutePath('/scopes/supplier/%E0%A4%A/catalog')).toBeUndefined();
  });
});

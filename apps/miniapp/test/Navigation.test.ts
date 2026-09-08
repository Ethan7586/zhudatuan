import { describe, expect, it } from 'vitest';
import { AccountManifest } from '../miniprogram/feature/account/Manifest';
import { OrderManifest } from '../miniprogram/feature/order/Manifest';
import { MINIAPP_MAIN_PAGES, MINIAPP_PAGE_BY_ROUTE, MINIAPP_PAGES, MINIAPP_SUBPACKAGES, miniappPagePath, readMiniappRoute } from '../miniprogram/generated/PageBinding';
import { ROUTES } from '../miniprogram/generated/RouteBinding';
import { miniappDeepLink, routeFromOptions } from '../miniprogram/runtime/DeepLink';
import { miniappNavigation } from '../miniprogram/runtime/Navigation';

describe('miniapp generated navigation', () => {
  it('binds every configured route to a real feature reader and page', () => {
    expect(Object.keys(MINIAPP_PAGE_BY_ROUTE).sort()).toEqual(Object.keys(ROUTES).sort());
    expect(MINIAPP_PAGES[0]).toBe('/feature/home/page');
    expect(MINIAPP_MAIN_PAGES).toEqual(['/feature/home/page']);
    expect(MINIAPP_SUBPACKAGES.map(({ root }) => root)).toContain('feature/checkout');
    expect(MINIAPP_PAGE_BY_ROUTE.miniappsecurity).toBe('/feature/account/page');
    expect(AccountManifest.routes.map(({ routeid }) => routeid)).toEqual(['miniappprofile', 'miniappsecurity']);
    expect(OrderManifest.routes.every((route) => route.scope === 'mall' && route.capability === route.operation && route.breadcrumbs.length > 0)).toBe(true);
  });

  it('encodes route parameters and rejects malformed page options', () => {
    const path = miniappPagePath('miniapporder', { orderId: 'order:一号' });
    expect(path).toContain('orderId=order%3A%E4%B8%80%E5%8F%B7');
    expect(readMiniappRoute({ route: 'miniapporder', orderId: 'order:one' })).toEqual({ id: 'miniapporder', parameters: { orderId: 'order:one' } });
    expect(() => readMiniappRoute({ route: 'miniapporder' })).toThrow('MINIAPP_ROUTE_PARAMETER_INVALID');
    expect(() => miniappPagePath('miniapporder', { orderId: '' })).toThrow('MINIAPP_ROUTE_PARAMETER_INVALID');
  });

  it('converts validated web deep links without trusting conflicting route options', () => {
    expect(miniappDeepLink('/orders/order%3Aone')).toBe('/feature/order/page?route=miniapporder&orderId=order%3Aone');
    expect(routeFromOptions({ path: '/products/product%3Aone' }, { id: 'miniapphome', parameters: {} })).toEqual({ id: 'miniappproduct', parameters: { productId: 'product:one' } });
    expect(() => routeFromOptions({ route: 'miniapphome', path: '/products' }, { id: 'miniapphome', parameters: {} })).toThrow('MINIAPP_DEEP_LINK_INVALID');
  });

  it('renders the server-projected primary navigation without a client visibility list', () => {
    const nodes = [
      node('miniappcatalog', '选购福利', 'miniappcatalog', 20, 'primary', false),
      node('miniapphome', '首页', 'miniapphome', 10, 'primary', false),
      node('miniappcart', '购物车', 'miniappcart', 30, 'secondary', false),
      node('miniapporders', '我的订单', 'miniapporders', 40, 'primary', true),
    ];
    expect(miniappNavigation('miniapphome', nodes as never).map(({ route, title, active }) => ({ route, title, active }))).toEqual([
      { route: 'miniapphome', title: '首页', active: true },
      { route: 'miniappcatalog', title: '选购福利', active: false },
    ]);
  });
});

function node(key: string, title: string, routeKey: string, order: number, placement: 'primary' | 'secondary', disabled: boolean) {
  return {
    key,
    title,
    parent: null,
    order,
    operation: 'storefront.bootstrap.read',
    experience: { icon: 'home', routeKey, route: '/', component: 'home', placement, disabled, disabledReason: disabled ? '当前范围暂无可用功能' : null, breadcrumbs: [{ key, title }] },
    children: [],
  };
}

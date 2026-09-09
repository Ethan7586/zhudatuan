import { describe, expect, it } from 'vitest';
import type { ExperienceDocument } from '@shop/contract';
import type { SessionState } from '../entity/session/viewmodel/SessionContext';
import { shellNavigation, shellPathActive } from './ShellNavigation';

type Node = SessionState['navigation'][number];

describe('shellNavigation', () => {
  it('composes primary, published and quick navigation from available configuration', () => {
    const result = shellNavigation(
      [
        node('home', '首页', '/', 'primary', 30),
        node('catalog', '企业福利专区', '/products', 'primary', 20, false, [node('product', '商品详情', '/products/:productId', 'contextual', 1)]),
        node('support', '客服中心', '/support', 'primary', 40),
        node('cart', '购物车', '/cart', 'secondary', 50),
        node('notification', '消息通知', '/notifications', 'secondary', 60),
        node('account', '我的', '/profile', 'primary', 70),
        node('membercode', '会员码', '/member-code', 'primary', 80),
        node('orders', '我的订单', '/orders', 'primary', 90),
        node('disabled', '不可用入口', '/disabled', 'primary', 80, true),
      ],
      experience()
    );

    expect(result.primary.map(({ label }) => label)).toEqual(['企业福利专区', '首页', '会员码', '我的订单']);
    expect(result.published).toEqual([{ id: 'nav:festival', label: '员工关怀', path: '/pages/festival' }]);
    expect(result.quick.map(({ kind }) => kind)).toEqual(['support', 'notification', 'cart', 'account']);
    expect(result.mobile.map(({ kind, label }) => ({ kind, label }))).toEqual([
      { kind: 'home', label: '首页' },
      { kind: 'catalog', label: '分类' },
      { kind: 'membercode', label: '会员码' },
      { kind: 'orders', label: '订单' },
      { kind: 'account', label: '我的' },
    ]);
    expect(result.search).toBe(true);
    expect(result.quickView).toBe(true);
  });

  it('hides disabled, unsafe, duplicate and unconfigured capabilities', () => {
    const result = shellNavigation([node('unsafe', '外部跳转', '//external.example', 'primary', 1), node('cart', '购物车', '/cart', 'secondary', 2, true)], experience());

    expect(result.primary).toEqual([]);
    expect(result.published.map(({ path }) => path)).toEqual(['/', '/pages/festival']);
    expect(result.quick).toEqual([]);
    expect(result.mobile).toEqual([]);
    expect(result.search).toBe(false);
    expect(result.quickView).toBe(false);
  });

  it('keeps the owning destination selected on nested routes without selecting home globally', () => {
    expect(shellPathActive('/orders/order-one', '/orders')).toBe(true);
    expect(shellPathActive('/products/product-one', '/products')).toBe(true);
    expect(shellPathActive('/products', '/')).toBe(false);
  });
});

function node(key: string, title: string, route: string, placement: Node['experience']['placement'], order: number, disabled = false, children: readonly Node[] = []): Node {
  return {
    key,
    title,
    parent: null,
    order,
    operation: 'storefront.bootstrap.read',
    experience: { icon: key, routeKey: key, route, component: key, placement, disabled, disabledReason: disabled ? '当前范围未启用此能力' : null, breadcrumbs: [] },
    children,
  };
}

function experience(): ExperienceDocument {
  return {
    version: 2,
    application: 'application:one',
    theme: { preset: 'shop', primaryColor: '#2457C5', accentColor: '#E67E22', logoObjectRef: null, faviconObjectRef: null },
    navigation: [
      { id: 'nav:home', label: '装修首页', page: 'page:home' },
      { id: 'nav:festival', label: '员工关怀', page: 'page:festival' },
      { id: 'nav:festival:duplicate', label: '重复专场', page: 'page:festival' },
      { id: 'nav:missing', label: '失效页面', page: 'page:missing' },
    ],
    assets: [],
    pages: [
      { id: 'page:home', path: 'home', blocks: [] },
      { id: 'page:festival', path: 'pages/festival', blocks: [] },
    ],
  };
}

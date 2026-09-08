import { describe, expect, it } from 'vitest';
import type { NavigationNodeValue } from '../domain/model/NavigationNode';
import { NavigationTree } from '../domain/model/NavigationTree';

describe('NavigationTree', () => {
  it('accepts a deep link only when its complete Chinese breadcrumb can be reversed', () => {
    const child = node('child', '订单详情', 'root', '/orders/:orderId', [
      { key: 'root', title: '订单中心' },
      { key: 'child', title: '订单详情' },
    ]);
    const root = node('root', '订单中心', null, '/orders', [{ key: 'root', title: '订单中心' }], [child]);
    const tree = navigationTree([root], 'child', '/orders/:orderId');
    expect(tree.nodes[0]?.children[0]?.experience.breadcrumbs.map(({ title }) => title)).toEqual(['订单中心', '订单详情']);
  });

  it('rejects duplicate keys, orphan parents, cycles and broken breadcrumbs', () => {
    const root = node('root', '订单中心', null, '/orders', [{ key: 'root', title: '订单中心' }]);
    expect(() => navigationTree([root, { ...root, experience: { ...root.experience, route: '/other' } }], 'root', '/orders')).toThrow('NAVIGATION_NODE_DUPLICATE');
    expect(() => navigationTree([{ ...root, parent: 'absent' }], 'root', '/orders')).toThrow('NAVIGATION_PARENT_INVALID');
    expect(() => navigationTree([{ ...root, experience: { ...root.experience, breadcrumbs: [{ key: 'other', title: '其他页面' }] } }], 'root', '/orders')).toThrow('NAVIGATION_BREADCRUMB_PATH_INVALID');
    const cyclic = { ...root, children: [] as NavigationNodeValue[] };
    cyclic.children.push(cyclic);
    expect(() => navigationTree([cyclic], 'root', '/orders')).toThrow('NAVIGATION_CYCLE');
  });
});

function navigationTree(nodes: readonly NavigationNodeValue[], defaultKey: string, defaultRoute: string): NavigationTree {
  return new NavigationTree({
    scope: { id: 'enterprise:one', kind: 'enterprise' },
    target: 'console',
    version: 'version:one',
    etag: '"version:one"',
    generatedAt: '2026-09-04T00:00:00.000Z',
    catalogVersion: 'catalog:one',
    defaultKey,
    defaultRoute,
    nodes,
  });
}

function node(key: string, title: string, parent: string | null, route: string, breadcrumbs: NavigationNodeValue['experience']['breadcrumbs'], children: readonly NavigationNodeValue[] = []): NavigationNodeValue {
  return {
    key,
    title,
    parent,
    order: 10,
    operation: 'order.orders.read',
    experience: { icon: 'order', routeKey: `${key}route`, route, component: 'order', placement: parent === null ? 'primary' : 'contextual', disabled: false, disabledReason: null, breadcrumbs },
    children,
  };
}

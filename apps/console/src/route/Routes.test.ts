// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { RouteRegistry } from '../app/RouteRegistry';
import { COMPONENT_KEYS, NAVIGATION_IDS } from '../generated/NavigationBinding';
import { relativeRoute } from '../generated/RouteBinding';
import { SessionSchema, uniqueScopes } from '../entity/session/ConsoleSession';
import { pageCursor } from '../shared/query/QueryState';
import { scopeLandingPath, scopeRoutePath } from '../shared/url/ScopePath';

describe('Console Route Registry', () => {
  it('binds every generated navigation component and id exactly once with generated policy metadata', () => {
    const manifests = RouteRegistry.all();
    expect(manifests.map(({ component }) => component).sort()).toEqual([...COMPONENT_KEYS].sort());
    expect(manifests.flatMap(({ navigationids }) => navigationids).sort()).toEqual([...NAVIGATION_IDS].sort());
    expect(new Set(RouteRegistry.routes().map(({ route }) => route.routeid)).size).toBe(RouteRegistry.routes().length);
    for (const manifest of manifests) {
      expect(Object.keys(manifest).sort()).toEqual(['component', 'load', 'navigationids', 'routes']);
      for (const route of manifest.routes) {
        expect(route.bindings.length).toBeGreaterThan(0);
        expect(route.bindings.every((binding) => binding.capability === binding.operation)).toBe(true);
        expect(route.bindings.every((binding) => binding.title.length > 0 && binding.breadcrumbs.length > 0)).toBe(true);
      }
    }
    expect(RouteRegistry.match('/scopes/enterprise/group%3A1/finance/settlements')?.component).toBe('finance');
    expect(RouteRegistry.match('/scopes/mall/mall%3A1/imports/voucher/job%3A1')?.component).toBe('task');
    expect(RouteRegistry.match('/scopes/mall/mall%3A1/products/product%3A1')?.component).toBe('product');
    expect(RouteRegistry.resolve('/scopes/mall/mall%3A1/products/product%3A1')).toEqual({ routeid: 'consoleproductdetail', parameters: { scopeKind: 'mall', scopeId: 'mall:1', productId: 'product:1' } });
    expect(RouteRegistry.resolve('/scopes/enterprise/group%3A1/orders/order%3A1')).toEqual({ routeid: 'consoleorderdetail', parameters: { scopeKind: 'enterprise', scopeId: 'group:1', orderId: 'order:1' } });
    expect(relativeRoute('consoleproductdetail')).toBe('products/:productId');
    expect(relativeRoute('consoleorderdetail')).toBe('orders/:orderId');
  });

  it('puts kind and id in a deep-linkable scope URL', () => {
    expect(scopeRoutePath({ kind: 'enterprise', id: 'group/鸿泰' }, 'consoleproducts')).toBe('/scopes/enterprise/group%2F%E9%B8%BF%E6%B3%B0/products');
    expect(scopeLandingPath({ kind: 'mall', id: 'mall/福利' })).toBe('/scopes/mall/mall%2F%E7%A6%8F%E5%88%A9');
  });

  it('deduplicates scopes and normalizes access versions', () => {
    const scopes = uniqueScopes([
      { kind: 'mall', id: 'mall:2' },
      { kind: 'enterprise', id: 'group:1', name: '鸿泰集团' },
      { kind: 'mall', id: 'mall:2', name: '喜悦会', parent_id: 'group:1' },
    ]);
    expect(scopes.map(({ id }) => id)).toEqual(['group:1', 'mall:2']);
    expect(scopes[1]).toMatchObject({ name: '喜悦会', parent_id: 'group:1' });
    const session = SessionSchema.parse({
      actor: 'actor:1',
      membership: 'membership:1',
      accessVersion: '7',
      permissions: [],
      capabilities: [],
      target: 'console',
      scope: { kind: 'enterprise', id: 'group:1' },
      scopes: [{ kind: 'enterprise', id: 'group:1' }],
      assurance: { level: 1 },
      security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null },
      csrf: 'csrf-token-from-api-session',
      syncedAt: '2026-08-26T00:00:00Z',
    });
    expect(session.accessVersion).toBe(7);
  });

  it('preserves filters when advancing a keyset cursor', () => {
    expect(pageCursor(new URLSearchParams('q=milk'), 'cursor:2').toString()).toBe('q=milk&cursor=cursor%3A2');
  });
});

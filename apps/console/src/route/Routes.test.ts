// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { RouteRegistry } from '../app/RouteRegistry';
import { COMPONENT_KEYS, NAVIGATION_IDS } from '../generated/NavigationBinding';
import { SessionSchema, uniqueScopes } from '../entity/session/ConsoleSession';
import { pageCursor } from '../shared/url/PageCursor';
import { scopePath } from '../shared/url/ScopePath';

describe('Console Route Registry', () => {
  it('binds every generated navigation component and id exactly once without policy metadata', () => {
    const manifests = RouteRegistry.all();
    expect(manifests.map(({ component }) => component).sort()).toEqual([...COMPONENT_KEYS].sort());
    expect(manifests.flatMap(({ navigationids }) => navigationids).sort()).toEqual([...NAVIGATION_IDS].sort());
    expect(new Set(RouteRegistry.routes().map(({ route }) => route.route)).size).toBe(RouteRegistry.routes().length);
    for (const manifest of manifests) {
      expect(Object.keys(manifest).sort()).toEqual(['component', 'load', 'navigationids', 'routes']);
    }
    expect(RouteRegistry.match('/scopes/enterprise/group%3A1/finance/settlements')?.component).toBe('finance');
    expect(RouteRegistry.match('/scopes/mall/mall%3A1/imports/voucher/job%3A1')?.component).toBe('product');
    expect(RouteRegistry.match('/scopes/mall/mall%3A1/products/product%3A1')?.component).toBe('product');
  });

  it('puts kind and id in a deep-linkable scope URL', () => {
    expect(scopePath({ kind: 'enterprise', id: 'group/鸿泰' }, 'products')).toBe('/scopes/enterprise/group%2F%E9%B8%BF%E6%B3%B0/products');
  });

  it('deduplicates scopes and normalizes access versions', () => {
    const scopes = uniqueScopes([
      { kind: 'mall', id: 'mall:2', name: '喜悦会' },
      { kind: 'enterprise', id: 'group:1', name: '鸿泰集团' },
      { kind: 'mall', id: 'mall:2', name: '喜悦会' },
    ]);
    expect(scopes.map(({ id }) => id)).toEqual(['group:1', 'mall:2']);
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
      csrf: 'csrf-token-from-api-session',
      syncedAt: '2026-08-26T00:00:00Z',
    });
    expect(session.accessVersion).toBe(7);
  });

  it('preserves filters when advancing a keyset cursor', () => {
    expect(pageCursor(new URLSearchParams('q=milk'), 'cursor:2').toString()).toBe('q=milk&cursor=cursor%3A2');
  });
});

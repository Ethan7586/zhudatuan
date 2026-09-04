import { describe, expect, it } from 'vitest';
import type { StorefrontBootstrap } from '../entity/session';
import {
  deriveStorefrontSession,
  isSessionScopeQuery,
  refreshSessionScope,
  sessionFingerprint,
  storefrontQueryIdentity,
  shouldRefreshSessionScope,
  shouldRefreshAfterRestore,
  visibleNavigation,
} from '../entity/session/viewmodel/SessionViewModel';
import { StorefrontQuery } from '../shared/api/Query';

describe('storefront session runtime', () => {
  it('derives a scoped member session from the trusted bootstrap', () => {
    const view = bootstrap({ state: 'member', membership: 'membership:one', csrf: 'csrf:one' });
    expect(deriveStorefrontSession(view)).toEqual({
      membership: 'membership:one',
      scope: { kind: 'mall', id: 'mall:one' },
      accessVersion: 7,
      csrfToken: 'csrf:one',
    });
  });

  it('keeps anonymous access but rejects malformed authenticated identity', () => {
    expect(deriveStorefrontSession(bootstrap({ state: 'anonymous', membership: null }))).toBeNull();
    expect(() => deriveStorefrontSession(bootstrap({ state: 'member', membership: null, csrf: 'csrf' }))).toThrow('AUTHENTICATED_SESSION_BINDING_INVALID');
  });

  it('only exposes generated navigation ids', () => {
    const view = bootstrap({ state: 'anonymous', membership: null });
    expect(visibleNavigation(view).some(({ id }) => id === 'untrusted')).toBe(false);
  });

  it('refreshes bootstrap only when Chrome restores the page from history cache', () => {
    expect(shouldRefreshAfterRestore({ persisted: true })).toBe(true);
    expect(shouldRefreshAfterRestore({ persisted: false })).toBe(false);
  });

  it('partitions session-dependent cache by membership and access version', () => {
    const view = bootstrap({ state: 'member', membership: 'membership:one', csrf: 'csrf' });
    const session = deriveStorefrontSession(view);
    const identity = storefrontQueryIdentity(view, 'mall-one', session);
    expect(sessionFingerprint(null)).toBe('guest');
    expect(sessionFingerprint(session)).toBe('mall:mall:one:membership:one:7');
    expect(StorefrontQuery.cart(identity.scoped)).toEqual(['storefront', 'mall', 'mall:one', 7, '7:3:5', 'cart', {}]);
    expect(StorefrontQuery.catalog(identity.public, { query: '关怀' })).toEqual(['storefront', 'public', 'mall-one', 'mall:one', '7', 'pool:one:7', 'catalog', { query: '关怀' }]);
    expect(isSessionScopeQuery(StorefrontQuery.cart(identity.scoped), identity.scoped)).toBe(true);
    expect(isSessionScopeQuery(['storefront', 'mall', 'mall:two', 7, '7:3:5', 'cart', {}], identity.scoped)).toBe(false);
    expect(isSessionScopeQuery(['console', 'mall', 'mall:one', 7], identity.scoped)).toBe(false);
  });

  it('cancels and removes only the previous scoped partition after identity changes', async () => {
    const identity = storefrontQueryIdentity(bootstrap({ state: 'member', membership: 'membership:one', csrf: 'csrf' }), 'mall-one', {
      membership: 'membership:one',
      scope: { kind: 'mall', id: 'mall:one' },
      accessVersion: 7,
      csrfToken: 'csrf',
    }).scoped;
    const calls: string[] = [];
    const client = {
      cancelQueries: (filters: { predicate?: (query: { queryKey: readonly unknown[] }) => boolean }) => {
        expect(filters.predicate?.({ queryKey: StorefrontQuery.cart(identity) })).toBe(true);
        expect(filters.predicate?.({ queryKey: ['storefront', 'mall', 'mall:two', 7, '7:3:5', 'cart', {}] })).toBe(false);
        calls.push('cancel');
        return Promise.resolve();
      },
      removeQueries: () => {
        calls.push('remove');
      },
      invalidateQueries: (filters: { queryKey?: readonly unknown[]; exact?: boolean }) => {
        expect(filters).toEqual({ queryKey: ['storefront', 'bootstrap', 'mall-one'], exact: true });
        calls.push('bootstrap');
        return Promise.resolve();
      },
    };
    await refreshSessionScope(client as never, identity, 'mall-one');
    expect(calls).toEqual(['cancel', 'remove', 'bootstrap']);
  });

  it('does not race newly enabled member queries during the first guest sign-in', () => {
    expect(shouldRefreshSessionScope('guest', 'mall:mall:one:membership:one:7')).toBe(false);
    expect(shouldRefreshSessionScope('mall:mall:one:membership:one:7', 'mall:mall:one:membership:one:8')).toBe(true);
    expect(shouldRefreshSessionScope('mall:mall:one:membership:one:7', 'mall:mall:two:membership:one:7')).toBe(true);
    expect(shouldRefreshSessionScope('mall:mall:one:membership:one:7', 'mall:mall:one:membership:two:1')).toBe(true);
    expect(shouldRefreshSessionScope('mall:mall:one:membership:one:7', 'guest')).toBe(true);
  });
});

function bootstrap(identity: StorefrontBootstrap['identity']['data']): StorefrontBootstrap {
  return {
    entry: { handle: 'mall-one', url: 'https://fufu.wang/s/mall-one' },
    binding: { application: 'app:one', mall: 'mall:one', pool: 'pool:one', release: 'release:one', version: '7', tenant: 'tenant:one' },
    identity: { state: 'complete', version: '7', asOf: '2026-01-01T00:00:00.000Z', data: identity },
    navigation: { state: 'complete', version: '7', asOf: '2026-01-01T00:00:00.000Z', data: [{ id: 'untrusted', title: '伪入口', icon: 'x', route: '/unsafe', order: 99 }] },
    benefit: { state: 'complete', version: '3', asOf: '2026-01-01T00:00:00.000Z', data: { version: 3 } },
    orders: { state: 'complete', version: '5', asOf: '2026-01-01T00:00:00.000Z', data: { version: 5 } },
    experience: { state: 'complete', version: '7', asOf: '2026-01-01T00:00:00.000Z', data: null },
  };
}

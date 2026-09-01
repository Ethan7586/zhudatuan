import { describe, expect, it } from 'vitest';
import { deriveStorefrontSession, isSessionScopeQuery, sessionFingerprint, shouldRefreshAfterRestore, visibleNavigation, type BootstrapView } from './SessionRuntime';

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
    expect(sessionFingerprint(null)).toBe('guest');
    expect(sessionFingerprint(deriveStorefrontSession(bootstrap({ state: 'member', membership: 'membership:one', csrf: 'csrf' })))).toBe('membership:one:7');
    expect(isSessionScopeQuery(['storefront', 'mall:one', 'catalog', {}], 'mall:one')).toBe(true);
    expect(isSessionScopeQuery(['storefront', 'mall:two', 'catalog', {}], 'mall:one')).toBe(false);
    expect(isSessionScopeQuery(['console', 'mall:one', 'catalog'], 'mall:one')).toBe(false);
  });
});

function bootstrap(identity: BootstrapView['identity']['data']): BootstrapView {
  return {
    entry: { handle: 'mall-one', url: 'https://fufu.wang/s/mall-one' },
    binding: { mall: 'mall:one' },
    identity: { version: '7', data: identity },
    navigation: { data: [{ id: 'untrusted', title: '伪入口', icon: 'x', route: '/unsafe', order: 99 }] },
  };
}

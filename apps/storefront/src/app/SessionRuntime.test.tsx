import { describe, expect, it } from 'vitest';
import { deriveStorefrontSession, visibleNavigation, type BootstrapView } from './SessionRuntime';

describe('storefront session runtime', () => {
  it('derives a scoped member session from the trusted bootstrap', () => {
    const view = bootstrap({ state: 'member', membership: 'membership:one' });
    expect(deriveStorefrontSession(view, 'csrf:one')).toEqual({
      membership: 'membership:one',
      scope: { kind: 'mall', id: 'mall:one' },
      accessVersion: 7,
      csrfToken: 'csrf:one',
    });
  });

  it('keeps anonymous access but rejects malformed authenticated identity', () => {
    expect(deriveStorefrontSession(bootstrap({ state: 'anonymous', membership: null }), '')).toBeNull();
    expect(() => deriveStorefrontSession(bootstrap({ state: 'member', membership: null }), 'csrf')).toThrow('AUTHENTICATED_SESSION_BINDING_INVALID');
  });

  it('only exposes generated navigation ids', () => {
    const view = bootstrap({ state: 'anonymous', membership: null });
    expect(visibleNavigation(view).some(({ id }) => id === 'untrusted')).toBe(false);
  });
});

function bootstrap(identity: BootstrapView['identity']['data']): BootstrapView {
  return {
    binding: { mall: 'mall:one' },
    identity: { version: '7', data: identity },
    navigation: { data: [{ id: 'untrusted', title: '伪入口', icon: 'x', route: '/unsafe', order: 99 }] },
  };
}

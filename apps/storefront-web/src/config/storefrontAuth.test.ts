import { describe, expect, it } from 'vitest';
import { CANONICAL_STOREFRONT_AUTH_ORIGIN, LOCAL_STOREFRONT_AUTH_ORIGIN, resolveStorefrontAuthOrigin } from './storefrontAuth';

describe('storefront auth origin boundary', () => {
  it('always uses the canonical account center in production', () => {
    expect(resolveStorefrontAuthOrigin(undefined, 'production')).toBe(CANONICAL_STOREFRONT_AUTH_ORIGIN);
    expect(resolveStorefrontAuthOrigin(LOCAL_STOREFRONT_AUTH_ORIGIN, 'production')).toBe(CANONICAL_STOREFRONT_AUTH_ORIGIN);
    expect(resolveStorefrontAuthOrigin('https://attacker.example', 'production')).toBe(CANONICAL_STOREFRONT_AUTH_ORIGIN);
  });

  it('allows only the approved local account center during development', () => {
    expect(resolveStorefrontAuthOrigin(undefined, 'development')).toBe(LOCAL_STOREFRONT_AUTH_ORIGIN);
    expect(resolveStorefrontAuthOrigin('http://localhost:3002', 'development')).toBe('http://localhost:3002');
    expect(resolveStorefrontAuthOrigin('https://attacker.example', 'development')).toBe(LOCAL_STOREFRONT_AUTH_ORIGIN);
  });
});

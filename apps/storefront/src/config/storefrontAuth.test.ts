import { describe, expect, it } from 'vitest';
import { CANONICAL_AUTH_ORIGIN, LOCAL_AUTH_ORIGIN, resolveStorefrontAuthOrigin } from '@shop/config/client';

describe('storefront auth origin boundary', () => {
  it('always uses the canonical account center in production', () => {
    expect(resolveStorefrontAuthOrigin(undefined, 'production')).toBe(CANONICAL_AUTH_ORIGIN);
    expect(() => resolveStorefrontAuthOrigin(LOCAL_AUTH_ORIGIN, 'production')).toThrow('STOREFRONT_AUTH_ORIGIN_INVALID');
    expect(() => resolveStorefrontAuthOrigin('https://attacker.example', 'production')).toThrow('STOREFRONT_AUTH_ORIGIN_INVALID');
  });

  it('allows only the approved local account center during development', () => {
    expect(resolveStorefrontAuthOrigin(undefined, 'development')).toBe(LOCAL_AUTH_ORIGIN);
    expect(resolveStorefrontAuthOrigin('http://localhost:3002', 'development')).toBe('http://localhost:3002');
    expect(() => resolveStorefrontAuthOrigin('https://attacker.example', 'development')).toThrow('STOREFRONT_AUTH_ORIGIN_INVALID');
  });
});

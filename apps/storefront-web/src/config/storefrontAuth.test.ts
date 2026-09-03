import { describe, expect, it } from 'vitest';
import { CANONICAL_STOREFRONT_AUTH_ORIGIN, LOCAL_STOREFRONT_AUTH_ORIGIN, resolveStorefrontAuthOrigin, storefrontAuthHref } from './storefrontAuth';

describe('storefront auth origin boundary', () => {
  it('always uses the canonical account center in production', () => {
    expect(resolveStorefrontAuthOrigin(undefined, 'production')).toBe(CANONICAL_STOREFRONT_AUTH_ORIGIN);
    expect(resolveStorefrontAuthOrigin('https://accounts.zhudatuan.com', 'production')).toBe('https://accounts.zhudatuan.com');
    expect(resolveStorefrontAuthOrigin('https://accounts.hbbtzn.com', 'production')).toBe(CANONICAL_STOREFRONT_AUTH_ORIGIN);
    expect(resolveStorefrontAuthOrigin(LOCAL_STOREFRONT_AUTH_ORIGIN, 'production')).toBe(CANONICAL_STOREFRONT_AUTH_ORIGIN);
    expect(resolveStorefrontAuthOrigin('https://attacker.example', 'production')).toBe(CANONICAL_STOREFRONT_AUTH_ORIGIN);
  });

  it('allows only the approved local account center during development', () => {
    expect(resolveStorefrontAuthOrigin(undefined, 'development')).toBe(LOCAL_STOREFRONT_AUTH_ORIGIN);
    expect(resolveStorefrontAuthOrigin('http://localhost:3002', 'development')).toBe('http://localhost:3002');
    expect(resolveStorefrontAuthOrigin('https://attacker.example', 'development')).toBe(LOCAL_STOREFRONT_AUTH_ORIGIN);
  });

  it('opens the account center in consumer mode', () => {
    const web = new URL(storefrontAuthHref('web'));
    const h5 = new URL(storefrontAuthHref('h5'));

    expect(Object.fromEntries(web.searchParams)).toEqual({ target: 'storefront', surface: 'web' });
    expect(Object.fromEntries(h5.searchParams)).toEqual({ target: 'storefront', surface: 'h5' });
  });
});

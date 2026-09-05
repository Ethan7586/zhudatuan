import { describe, expect, it } from 'vitest';
import { CANONICAL_STOREFRONT_AUTH_ORIGIN, LOCAL_STOREFRONT_AUTH_ORIGIN, resolveStorefrontAuthOrigin, storefrontAuthHref } from './storefrontAuth';
import { HONGTAI_STOREFRONT_APPLICATION, resolveStorefrontApplication, ZHUDATUAN_STOREFRONT_APPLICATION } from './storefrontIdentity';

describe('storefront auth origin boundary', () => {
  it('always uses the canonical account center in production', () => {
    expect(resolveStorefrontAuthOrigin(undefined, 'production')).toBe(CANONICAL_STOREFRONT_AUTH_ORIGIN);
    expect(resolveStorefrontAuthOrigin('https://accounts.zhudatuan.com', 'production')).toBe('https://accounts.zhudatuan.com');
    expect(resolveStorefrontAuthOrigin(LOCAL_STOREFRONT_AUTH_ORIGIN, 'production')).toBe(CANONICAL_STOREFRONT_AUTH_ORIGIN);
    expect(resolveStorefrontAuthOrigin('https://attacker.example', 'production')).toBe(CANONICAL_STOREFRONT_AUTH_ORIGIN);
  });

  it('allows only the approved local account center during development', () => {
    expect(resolveStorefrontAuthOrigin(undefined, 'development')).toBe(LOCAL_STOREFRONT_AUTH_ORIGIN);
    expect(resolveStorefrontAuthOrigin('http://localhost:3002', 'development')).toBe('http://localhost:3002');
    expect(resolveStorefrontAuthOrigin('https://attacker.example', 'development')).toBe(LOCAL_STOREFRONT_AUTH_ORIGIN);
  });

  it('opens the account center in consumer mode', () => {
    const target = new URL(storefrontAuthHref('internal.zhudatuan.com'));
    expect(target.searchParams.get('target')).toBe('storefront');
    expect(target.searchParams.get('surface')).toBe('web');
    expect(target.searchParams.get('application')).toBe(ZHUDATUAN_STOREFRONT_APPLICATION);
  });

  it('keeps zhudatuan and hongtai storefront identities separate', () => {
    expect(resolveStorefrontApplication('zhudatuan.com')).toBe(ZHUDATUAN_STOREFRONT_APPLICATION);
    expect(resolveStorefrontApplication('internal.zhudatuan.com')).toBe(ZHUDATUAN_STOREFRONT_APPLICATION);
    expect(resolveStorefrontApplication('beta.zhudatuan.com')).toBe(ZHUDATUAN_STOREFRONT_APPLICATION);
    expect(resolveStorefrontApplication('mall.hbbtzn.com')).toBe(HONGTAI_STOREFRONT_APPLICATION);
  });
});

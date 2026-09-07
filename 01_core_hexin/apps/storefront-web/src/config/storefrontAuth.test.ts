import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseIdentityNodeRegistry } from '@shop/sdk/identity-node';
import { resolveStorefrontAuthOrigin, storefrontAuthHref } from './storefrontAuth';
import { resolveStorefrontApplication, resolveStorefrontNode, resolveStorefrontPresentationIdentity } from './storefrontIdentity';

describe('storefront auth origin boundary', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('uses only the account origin owned by the selected production node', () => {
    const l1 = resolveStorefrontNode('hbbtzn.com');
    expect(resolveStorefrontAuthOrigin(undefined, 'production', l1)).toBe('https://accounts.hbbtzn.com');
    expect(resolveStorefrontAuthOrigin('https://accounts.hbbtzn.com', 'production', l1)).toBe('https://accounts.hbbtzn.com');
    expect(resolveStorefrontAuthOrigin('http://127.0.0.1:3002', 'production', l1)).toBe('https://accounts.hbbtzn.com');
    expect(resolveStorefrontAuthOrigin('https://accounts.zhudatuan.com', 'production', l1)).toBe('https://accounts.hbbtzn.com');
  });

  it('allows only the configured local account center during development', () => {
    const local = resolveStorefrontNode('localhost');
    expect(resolveStorefrontAuthOrigin(undefined, 'development', local)).toBe('http://localhost:3002');
    expect(resolveStorefrontAuthOrigin('http://localhost:3002', 'development', local)).toBe('http://localhost:3002');
    expect(resolveStorefrontAuthOrigin('https://attacker.example', 'development', local)).toBe('http://localhost:3002');
  });

  it('opens the configured account center in consumer mode', () => {
    const target = new URL(storefrontAuthHref('internal.zhudatuan.com'));
    expect(target.searchParams.get('target')).toBe('storefront');
    expect(target.searchParams.get('surface')).toBe('web');
    expect(target.searchParams.get('application')).toBe('zhudatuan-storefront');
  });

  it('keeps existing L0 and L1 storefront identities separate through registry rows', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_AUTH_ORIGIN', 'https://accounts.zhudatuan.com');
    expect(resolveStorefrontApplication('zhudatuan.com')).toBe('zhudatuan-storefront');
    expect(resolveStorefrontApplication('internal.zhudatuan.com')).toBe('zhudatuan-storefront');
    expect(resolveStorefrontApplication('beta.zhudatuan.com')).toBe('zhudatuan-storefront');
    expect(resolveStorefrontApplication('mall.hbbtzn.com')).toBe('zdt-l1-verify');
    const zhudatuan = new URL(storefrontAuthHref('zhudatuan.com'));
    const hongtai = new URL(storefrontAuthHref('hbbtzn.com'));
    expect(zhudatuan.origin).toBe('https://accounts.zhudatuan.com');
    expect(zhudatuan.searchParams.get('target')).toBe('storefront');
    expect(hongtai.origin).toBe('https://accounts.hbbtzn.com');
    expect(hongtai.searchParams.get('target')).toBe('storefront-hbbtzn');
    expect(resolveStorefrontPresentationIdentity('hbbtzn.com')).toEqual({ mallName: '宏泰甄选', brandName: '宏泰甄选' });
    expect(resolveStorefrontPresentationIdentity('zhudatuan.com')).toEqual({ mallName: '筑大团商城', brandName: '筑大团' });
  });

  it('opens an L11 identity entry added only through registry data', () => {
    const registry = parseIdentityNodeRegistry(JSON.stringify({
      version: 1,
      defaultNodeId: 'l11',
      nodes: [{
        nodeId: 'l11', displayName: 'L11', accountsOrigin: 'https://accounts.l11.example.com',
        apiOrigin: 'https://api.l11.example.com', consumerApiOrigin: 'https://l11.example.com',
        adminOrigin: 'https://console.l11.example.com', storefrontOrigin: 'https://l11.example.com',
        adminTarget: 'console', consumerTarget: 'storefront', consumerApplication: 'l11-storefront',
      }],
    }));
    const target = new URL(storefrontAuthHref('l11.example.com', registry));
    expect(target.origin).toBe('https://accounts.l11.example.com');
    expect(Object.fromEntries(target.searchParams)).toEqual({
      target: 'storefront', surface: 'web', application: 'l11-storefront',
    });
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseIdentityNodeRegistry } from '@shop/sdk/identity-node';
import { resolveStorefrontAuthOrigin, storefrontAuthHref } from './storefrontAuth';
import { resolveStorefrontApplication, resolveStorefrontNode, resolveStorefrontPresentationIdentity } from './storefrontIdentity';

describe('storefront auth origin boundary', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('uses only the account origin owned by the selected production node', () => {
    const l1 = resolveStorefrontNode('fufuwang.com.cn');
    expect(resolveStorefrontAuthOrigin(undefined, 'production', l1)).toBe('https://accounts.fufuwang.com.cn');
    expect(resolveStorefrontAuthOrigin('https://accounts.fufuwang.com.cn', 'production', l1)).toBe('https://accounts.fufuwang.com.cn');
    expect(resolveStorefrontAuthOrigin('http://127.0.0.1:3002', 'production', l1)).toBe('https://accounts.fufuwang.com.cn');
    expect(resolveStorefrontAuthOrigin('https://accounts.fufu.wang', 'production', l1)).toBe('https://accounts.fufuwang.com.cn');
  });

  it('allows only the configured local account center during development', () => {
    const local = resolveStorefrontNode('localhost');
    expect(resolveStorefrontAuthOrigin(undefined, 'development', local)).toBe('http://localhost:3002');
    expect(resolveStorefrontAuthOrigin('http://localhost:3002', 'development', local)).toBe('http://localhost:3002');
    expect(resolveStorefrontAuthOrigin('https://attacker.example', 'development', local)).toBe('http://localhost:3002');
  });

  it('opens the configured account center in consumer mode', () => {
    const target = new URL(storefrontAuthHref('internal.fufu.wang'));
    expect(target.searchParams.get('target')).toBe('storefront');
    expect(target.searchParams.get('surface')).toBe('web');
    expect(target.searchParams.get('application')).toBe('zhudatuan-storefront');
  });

  it('keeps existing L0 and L1 storefront identities separate through registry rows', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_AUTH_ORIGIN', 'https://accounts.fufu.wang');
    expect(resolveStorefrontApplication('fufu.wang')).toBe('zhudatuan-storefront');
    expect(resolveStorefrontApplication('internal.fufu.wang')).toBe('zhudatuan-storefront');
    expect(resolveStorefrontApplication('beta.fufu.wang')).toBe('zhudatuan-storefront');
    expect(resolveStorefrontApplication('mall.fufuwang.com.cn')).toBe('zdt-l1-verify');
    expect(resolveStorefrontApplication('h5.fufuwang.com.cn')).toBe('zdt-l1-verify');
    expect(resolveStorefrontApplication('h6.fufuwang.com.cn')).toBe('h6');
    expect(resolveStorefrontApplication('h27.fufuwang.com.cn')).toBe('h27');
    const zhudatuan = new URL(storefrontAuthHref('fufu.wang'));
    const hongtai = new URL(storefrontAuthHref('fufuwang.com.cn'));
    expect(zhudatuan.origin).toBe('https://accounts.fufu.wang');
    expect(zhudatuan.searchParams.get('target')).toBe('storefront');
    expect(hongtai.origin).toBe('https://accounts.fufuwang.com.cn');
    expect(hongtai.searchParams.get('target')).toBe('storefront');
    expect(resolveStorefrontPresentationIdentity('fufuwang.com.cn')).toEqual({ mallName: '福福网', brandName: '福福网' });
    expect(resolveStorefrontPresentationIdentity('fufu.wang')).toEqual({ mallName: '筑大团商城', brandName: '筑大团' });
  });

  it('opens an L11 identity entry added only through registry data', () => {
    const registry = parseIdentityNodeRegistry(JSON.stringify({
      version: 2,
      nodes: [{
        nodeId: 'node:example:l5', nodeProfile: 'operating_mall', mallId: 'mall:l5', displayName: 'L5 商城',
        accountsOrigin: 'https://accounts.l5.example.com', apiOrigin: 'https://api.l5.example.com',
        consumerApiOrigin: 'https://l5.example.com', adminOrigin: 'https://console.l5.example.com',
        storefrontOrigin: 'https://l5.example.com', adminTarget: 'console',
        consumerTarget: 'storefront', consumerApplication: 'l5-storefront',
      }, {
        nodeId: 'node:example:l11', nodeProfile: 'consumer', hostNodeId: 'node:example:l5', displayName: 'L11 消费者',
        accountsOrigin: 'https://accounts.l11.example.com',
        apiOrigin: 'https://api.l11.example.com', consumerApiOrigin: 'https://l11.example.com',
        storefrontOrigin: 'https://l11.example.com', consumerTarget: 'storefront',
        consumerApplication: 'l11-storefront',
      }],
    }));
    expect(resolveStorefrontNode('l11.example.com', registry)).toMatchObject({
      nodeProfile: 'consumer', mallId: null, adminOrigin: null, adminTarget: null,
    });
    const target = new URL(storefrontAuthHref('l11.example.com', registry));
    expect(target.origin).toBe('https://accounts.l11.example.com');
    expect(Object.fromEntries(target.searchParams)).toEqual({
      target: 'storefront', surface: 'web', application: 'l11-storefront',
    });
  });

  it('reads a generated node registry injected by the runtime server instead of the build', () => {
    vi.stubGlobal('window', {
      location: { hostname: 'store.generated.invalid' },
      __SFL_STOREFRONT_IDENTITY_NODE_REGISTRY__: {
        version: 2,
        nodes: [{
          nodeId: 'node:generated:l1',
          nodeProfile: 'operating_mall',
          mallId: 'mall:generated',
          displayName: '生成商城',
          accountsOrigin: 'https://accounts.generated.invalid',
          apiOrigin: 'https://api.generated.invalid',
          consumerApiOrigin: 'https://api.generated.invalid',
          adminOrigin: 'https://console.generated.invalid',
          storefrontOrigin: 'https://store.generated.invalid',
          adminTarget: 'console',
          consumerTarget: 'storefront',
          consumerApplication: 'generated-storefront',
        }],
      },
    });
    expect(resolveStorefrontNode()).toMatchObject({ nodeId: 'node:generated:l1', mallId: 'mall:generated' });
    expect(resolveStorefrontApplication()).toBe('generated-storefront');
  });
});

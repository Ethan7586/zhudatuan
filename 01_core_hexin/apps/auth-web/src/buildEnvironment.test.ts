import { describe, expect, it } from 'vitest';
import { validateAuthBuildEnvironment } from './buildEnvironment';

const production = Object.freeze({
  VITE_IDENTITY_NODE_REGISTRY: JSON.stringify({
    version: 1,
    defaultNodeId: 'l0',
    nodes: [{
      nodeId: 'l0', displayName: '主打团平台', accountsOrigin: 'https://accounts.zhudatuan.com',
      apiOrigin: 'https://api.zhudatuan.com', consumerApiOrigin: 'https://api.zhudatuan.com',
      adminOrigin: 'https://console.zhudatuan.com', storefrontOrigin: 'https://zhudatuan.com',
      adminTarget: 'console', consumerTarget: 'storefront', consumerApplication: 'zhudatuan-storefront',
    }],
  }),
  VITE_CLIENT_VERSION: '1.0.0',
});

describe('auth production build environment', () => {
  it('requires every browser runtime value at build time', () => {
    expect(validateAuthBuildEnvironment(production)).toEqual({
      identityNodes: expect.objectContaining({ version: 1, defaultNodeId: 'l0' }),
      clientVersion: '1.0.0',
    });
    for (const key of Object.keys(production)) {
      expect(() => validateAuthBuildEnvironment({ ...production, [key]: undefined })).toThrow(/_MISSING$/);
    }
  });

  it('rejects a client version that the runtime contract cannot send', () => {
    expect(() => validateAuthBuildEnvironment({ ...production, VITE_CLIENT_VERSION: 'ca046ae' }))
      .toThrow('AUTH_CLIENT_VERSION_INVALID');
  });

  it('rejects local origins in a production build registry', () => {
    const registry = JSON.parse(production.VITE_IDENTITY_NODE_REGISTRY);
    registry.nodes[0].apiOrigin = 'http://127.0.0.1:3001';
    expect(() => validateAuthBuildEnvironment({
      ...production, VITE_IDENTITY_NODE_REGISTRY: JSON.stringify(registry),
    })).toThrow('AUTH_CLIENT_IDENTITY_NODE_ORIGIN_INVALID');
  });
});

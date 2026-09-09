import { describe, expect, it } from 'vitest';
import {
  PRODUCTION_IDENTITY_NODE_REGISTRY,
  identityNodeForAccountsHost,
  identityNodeForStorefrontHost,
  parseIdentityNodeRegistry,
} from './IdentityNodeRegistry';

describe('identity node registry', () => {
  it('projects the production L0 and L1 registry from the canonical manifest', () => {
    expect(PRODUCTION_IDENTITY_NODE_REGISTRY.nodes.map((node) => ({
      nodeId: node.nodeId,
      nodeProfile: node.nodeProfile,
      accountsHost: node.accountsHost,
      adminTarget: node.adminTarget,
      consumerTarget: node.consumerTarget,
    }))).toEqual([
      {
        nodeId: 'node:zhudatuan:l0', nodeProfile: 'operating_mall', accountsHost: 'accounts.fufu.wang',
        adminTarget: 'console', consumerTarget: 'storefront',
      },
      {
        nodeId: 'node:hbbtzn:l1', nodeProfile: 'operating_mall', accountsHost: 'accounts.hbbtzn.com',
        adminTarget: 'console', consumerTarget: 'storefront',
      },
    ]);
  });

  it('keeps L0-L5 operating malls and L6-L11 consumer-only without node-specific code branches', () => {
    const registry = parseIdentityNodeRegistry(JSON.stringify({
      version: 2,
      nodes: Array.from({ length: 12 }, (_, level) => ({
        nodeId: `node:example:l${level}`,
        ...(level <= 5
          ? {
              nodeProfile: 'operating_mall', mallId: `mall:l${level}`,
              adminOrigin: `https://console.l${level}.example.com`, adminTarget: 'console',
            }
          : { nodeProfile: 'consumer', hostNodeId: 'node:example:l5' }),
        displayName: `节点 L${level}`,
        accountsOrigin: `https://accounts.l${level}.example.com`,
        apiOrigin: `https://api.l${level}.example.com`,
        consumerApiOrigin: `https://l${level}.example.com`,
        storefrontOrigin: `https://l${level}.example.com`,
        storefrontHosts: [`www.l${level}.example.com`],
        consumerTarget: 'storefront',
        consumerApplication: `l${level}-storefront`,
      })),
    }));

    expect(registry.nodes).toHaveLength(12);
    for (let level = 0; level < 12; level += 1) {
      expect(identityNodeForAccountsHost(registry, `ACCOUNTS.L${level}.EXAMPLE.COM.`)?.nodeId).toBe(`node:example:l${level}`);
      expect(identityNodeForStorefrontHost(registry, `www.l${level}.example.com`)?.consumerApplication)
        .toBe(`l${level}-storefront`);
    }
    expect(identityNodeForAccountsHost(registry, 'accounts.l12.example.com')).toBeNull();
    expect(registry.nodes[5]).toMatchObject({ nodeProfile: 'operating_mall', mallId: 'mall:l5', adminTarget: 'console' });
    expect(registry.nodes[6]).toMatchObject({
      nodeProfile: 'consumer', hostNodeId: 'node:example:l5', mallId: null, adminOrigin: null, adminTarget: null,
    });
    expect(registry.nodes[11]).toMatchObject({
      nodeProfile: 'consumer', hostNodeId: 'node:example:l5', mallId: null, adminOrigin: null, adminTarget: null,
    });
  });

  it('rejects duplicate host ownership', () => {
    const node = {
      nodeId: 'node:example:l0', nodeProfile: 'operating_mall', mallId: 'mall:l0',
      displayName: 'L0', accountsOrigin: 'https://accounts.example.com',
      apiOrigin: 'https://api.example.com', consumerApiOrigin: 'https://example.com',
      adminOrigin: 'https://console.example.com', storefrontOrigin: 'https://example.com',
      adminTarget: 'console', consumerTarget: 'storefront', consumerApplication: 'example-storefront',
    };
    expect(() => parseIdentityNodeRegistry(JSON.stringify({
      version: 2, nodes: [node, { ...node, nodeId: 'node:example:l1' }],
    }))).toThrow('IDENTITY_NODE_ACCOUNTS_HOST_DUPLICATE');
  });

  it('rejects every console or mall field on a consumer node', () => {
    const operating = {
      nodeId: 'node:example:l5', nodeProfile: 'operating_mall', mallId: 'mall:l5', displayName: 'L5',
      accountsOrigin: 'https://accounts.l5.example.com', apiOrigin: 'https://api.l5.example.com',
      consumerApiOrigin: 'https://l5.example.com', adminOrigin: 'https://console.l5.example.com',
      storefrontOrigin: 'https://l5.example.com', adminTarget: 'console',
      consumerTarget: 'storefront', consumerApplication: 'l5-storefront',
    };
    const consumer = {
      nodeId: 'node:example:l6', nodeProfile: 'consumer', hostNodeId: 'node:example:l5', displayName: 'L6',
      accountsOrigin: 'https://accounts.l6.example.com', apiOrigin: 'https://api.l6.example.com',
      consumerApiOrigin: 'https://l6.example.com', storefrontOrigin: 'https://l6.example.com',
      consumerTarget: 'storefront', consumerApplication: 'l6-storefront',
    };
    const parse = (node: Readonly<Record<string, unknown>>) => parseIdentityNodeRegistry(JSON.stringify({
      version: 2, nodes: [operating, node],
    }));
    expect(() => parse({ ...consumer, adminOrigin: 'https://console.l6.example.com' }))
      .toThrow('IDENTITY_CONSUMER_ADMIN_FORBIDDEN');
    expect(() => parse({ ...consumer, adminTarget: 'console' })).toThrow('IDENTITY_CONSUMER_ADMIN_FORBIDDEN');
    expect(() => parse({ ...consumer, mallId: 'mall:l6' })).toThrow('IDENTITY_CONSUMER_MALL_FORBIDDEN');
    expect(() => parse({ ...consumer, hostNodeId: 'missing' })).toThrow('IDENTITY_CONSUMER_HOST_NODE_INVALID');
  });
});

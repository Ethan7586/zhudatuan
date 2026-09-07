import { describe, expect, it } from 'vitest';
import {
  defaultIdentityNode,
  identityNodeForAccountsHost,
  identityNodeForStorefrontHost,
  parseIdentityNodeRegistry,
} from './IdentityNodeRegistry';

describe('identity node registry', () => {
  it('resolves L0 through L11 without a compiled node or target enumeration', () => {
    const registry = parseIdentityNodeRegistry(JSON.stringify({
      version: 1,
      defaultNodeId: 'l0',
      nodes: Array.from({ length: 12 }, (_, level) => ({
        nodeId: `l${level}`,
        displayName: `节点 L${level}`,
        accountsOrigin: `https://accounts.l${level}.example.com`,
        apiOrigin: `https://api.l${level}.example.com`,
        consumerApiOrigin: `https://l${level}.example.com`,
        adminOrigin: `https://console.l${level}.example.com`,
        storefrontOrigin: `https://l${level}.example.com`,
        storefrontHosts: [`www.l${level}.example.com`],
        adminTarget: 'console',
        consumerTarget: 'storefront',
        consumerApplication: `l${level}-storefront`,
      })),
    }));

    expect(registry.nodes).toHaveLength(12);
    expect(defaultIdentityNode(registry).nodeId).toBe('l0');
    for (let level = 0; level < 12; level += 1) {
      expect(identityNodeForAccountsHost(registry, `ACCOUNTS.L${level}.EXAMPLE.COM.`)?.nodeId).toBe(`l${level}`);
      expect(identityNodeForStorefrontHost(registry, `www.l${level}.example.com`)?.consumerApplication)
        .toBe(`l${level}-storefront`);
    }
    expect(identityNodeForAccountsHost(registry, 'accounts.l12.example.com')).toBeNull();
  });

  it('rejects duplicate host ownership', () => {
    const node = {
      nodeId: 'l0', displayName: 'L0', accountsOrigin: 'https://accounts.example.com',
      apiOrigin: 'https://api.example.com', consumerApiOrigin: 'https://example.com',
      adminOrigin: 'https://console.example.com', storefrontOrigin: 'https://example.com',
      adminTarget: 'console', consumerTarget: 'storefront', consumerApplication: 'example-storefront',
    };
    expect(() => parseIdentityNodeRegistry(JSON.stringify({
      version: 1, defaultNodeId: 'l0', nodes: [node, { ...node, nodeId: 'l1' }],
    }))).toThrow('IDENTITY_NODE_ACCOUNTS_HOST_DUPLICATE');
  });
});

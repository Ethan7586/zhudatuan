import { defineConfig } from 'vitest/config';
import { PRODUCTION_IDENTITY_NODE_REGISTRY } from '@shop/sdk/identity-node';

const identityNodeRegistry = JSON.stringify({
  version: PRODUCTION_IDENTITY_NODE_REGISTRY.version,
  defaultNodeId: 'local',
  nodes: [
    {
      nodeId: 'local', nodeProfile: 'operating_mall', mallId: 'mall-local',
      displayName: '本地身份节点', accountsOrigin: 'http://localhost:3002',
      apiOrigin: 'http://127.0.0.1:3001', consumerApiOrigin: 'http://127.0.0.1:3001',
      adminOrigin: 'http://127.0.0.1:4173', storefrontOrigin: 'http://127.0.0.1:3000',
      storefrontHosts: ['localhost'], adminTarget: 'console', consumerTarget: 'storefront',
      consumerApplication: 'zhudatuan-storefront',
    },
    ...PRODUCTION_IDENTITY_NODE_REGISTRY.nodes,
  ],
});

export default defineConfig({
  define: {
    'import.meta.env.VITE_IDENTITY_NODE_REGISTRY': JSON.stringify(identityNodeRegistry),
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});

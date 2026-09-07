import { PRODUCTION_IDENTITY_NODE_REGISTRY } from '@shop/sdk/identity-node';

process.env.NEXT_PUBLIC_IDENTITY_NODE_REGISTRY ??= JSON.stringify({
  version: PRODUCTION_IDENTITY_NODE_REGISTRY.version,
  defaultNodeId: 'l1',
  nodes: [
    {
      nodeId: 'local', nodeProfile: 'operating_mall', mallId: 'mall-local',
      displayName: '本地身份节点', mallName: '本地商城', brandName: '本地商城', accountsOrigin: 'http://localhost:3002',
      apiOrigin: 'http://127.0.0.1:3001', consumerApiOrigin: 'http://127.0.0.1:3001',
      adminOrigin: 'http://127.0.0.1:4173', storefrontOrigin: 'http://localhost:3000',
      storefrontHosts: ['127.0.0.1'], adminTarget: 'console', consumerTarget: 'storefront',
      consumerApplication: 'local-storefront',
    },
    ...PRODUCTION_IDENTITY_NODE_REGISTRY.nodes,
  ],
});

process.env.NEXT_PUBLIC_STOREFRONT_HOSTNAME ??= 'hbbtzn.com';

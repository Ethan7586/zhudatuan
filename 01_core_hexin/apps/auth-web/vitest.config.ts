import { defineConfig } from 'vitest/config';

const identityNodeRegistry = JSON.stringify({
  version: 2,
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
    {
      nodeId: 'l0', nodeProfile: 'operating_mall', mallId: 'mall-zhudatuan',
      displayName: '主打团平台', accountsOrigin: 'https://accounts.zhudatuan.com',
      apiOrigin: 'https://api.zhudatuan.com', consumerApiOrigin: 'https://api.zhudatuan.com',
      adminOrigin: 'https://console.zhudatuan.com', storefrontOrigin: 'https://zhudatuan.com',
      adminTarget: 'console', consumerTarget: 'storefront', consumerApplication: 'zhudatuan-storefront',
    },
    {
      nodeId: 'l1', nodeProfile: 'operating_mall', mallId: 'mall:d1708f04df2dd8a61736852c4900fb43',
      displayName: '宏泰甄选运营后台', accountsOrigin: 'https://accounts.hbbtzn.com',
      apiOrigin: 'https://api.hbbtzn.com', consumerApiOrigin: 'https://hbbtzn.com',
      adminOrigin: 'https://console.hbbtzn.com', storefrontOrigin: 'https://hbbtzn.com',
      adminTarget: 'console-hbbtzn', consumerTarget: 'storefront-hbbtzn', consumerApplication: 'zdt-l1-verify',
    },
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

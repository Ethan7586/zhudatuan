process.env.NEXT_PUBLIC_IDENTITY_NODE_REGISTRY ??= JSON.stringify({
  version: 1,
  defaultNodeId: 'l1',
  nodes: [
    {
      nodeId: 'local', displayName: '本地身份节点', mallName: '本地商城', brandName: '本地商城', accountsOrigin: 'http://localhost:3002',
      apiOrigin: 'http://127.0.0.1:3001', consumerApiOrigin: 'http://127.0.0.1:3001',
      adminOrigin: 'http://127.0.0.1:4173', storefrontOrigin: 'http://localhost:3000',
      storefrontHosts: ['127.0.0.1'], adminTarget: 'console', consumerTarget: 'storefront',
      consumerApplication: 'local-storefront',
    },
    {
      nodeId: 'l0', displayName: '主打团平台', mallName: '筑大团商城', brandName: '筑大团', accountsOrigin: 'https://accounts.zhudatuan.com',
      apiOrigin: 'https://api.zhudatuan.com', consumerApiOrigin: 'https://api.zhudatuan.com',
      adminOrigin: 'https://console.zhudatuan.com', storefrontOrigin: 'https://zhudatuan.com',
      storefrontHosts: ['www.zhudatuan.com', 'internal.zhudatuan.com', 'beta.zhudatuan.com'],
      adminTarget: 'console', consumerTarget: 'storefront', consumerApplication: 'zhudatuan-storefront',
    },
    {
      nodeId: 'l1', displayName: '宏泰甄选运营后台', mallName: '宏泰甄选', brandName: '宏泰甄选', accountsOrigin: 'https://accounts.hbbtzn.com',
      apiOrigin: 'https://api.hbbtzn.com', consumerApiOrigin: 'https://hbbtzn.com',
      adminOrigin: 'https://console.hbbtzn.com', storefrontOrigin: 'https://hbbtzn.com',
      storefrontHosts: ['mall.hbbtzn.com'], adminTarget: 'console-hbbtzn', consumerTarget: 'storefront-hbbtzn',
      consumerApplication: 'zdt-l1-verify',
    },
  ],
});

process.env.NEXT_PUBLIC_STOREFRONT_HOSTNAME ??= 'hbbtzn.com';

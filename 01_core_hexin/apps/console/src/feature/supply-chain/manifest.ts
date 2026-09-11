import type { ConsoleModuleManifest } from '../../entity/navigation/ConsoleModuleManifest';

export const supplyChainModule = {
  id: 'supply-chain',
  status: 'enabled',
  navigation: {
    placement: 'main',
    group: 'commerce',
    order: 45,
    label: '供应链管理',
    icon: 'supply',
    scopeKinds: ['platform', 'tenant', 'distributor', 'enterprise', 'mall'],
  },
  routes: [
    {
      id: 'supply-chain.index',
      path: 'supply-chain',
      kind: 'entry',
      lazy: () => import('./SupplyChainRoute'),
      operations: ['catalog.listings.read'],
      presentation: { title: '供应链管理', summary: '供货伙伴、供应商品与合作关系' },
    },
  ],
} as const satisfies ConsoleModuleManifest<'supply-chain'>;

import { defineProviderCatalog } from '@shop/providercore';

export const CakeCatalog = defineProviderCatalog({
  id: 'cake',
  name: '蛋糕',
  business: '蛋糕预约配送',
  clients: ['console', 'storefront', 'miniapp', 'store', 'supplier'],
  settings: ['品牌连接', '规格与门店', '配送范围', '预约时段', '核销与账单'],
  help: '管理蛋糕规格、门店范围、预约、祝福语、配送和核销。',
});

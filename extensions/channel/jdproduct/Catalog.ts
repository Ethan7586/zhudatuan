import { defineProviderCatalog } from '@shop/providercore';

export const JdproductCatalog = defineProviderCatalog({
  id: 'jdproduct',
  name: '京东',
  business: '综合实物商品',
  clients: ['console', 'storefront', 'miniapp', 'supplier'],
  settings: ['连接认证', '商品同步', '库存与价格', '订单履约', '账单与回调'],
  help: '连接京东商品、库存、订单、售后、物流和账单能力。',
});

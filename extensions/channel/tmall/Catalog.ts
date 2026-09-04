import { defineProviderCatalog } from '@shop/providercore';

export const TmallCatalog = defineProviderCatalog({
  id: 'tmall',
  name: '天猫超市',
  business: '综合实物商品',
  clients: ['console', 'storefront', 'miniapp', 'supplier'],
  settings: ['连接认证', '商品同步', '库存与价格', '订单售后', '账单与回调'],
  help: '连接天猫商品、库存、订单、退款、物流和账单能力。',
});

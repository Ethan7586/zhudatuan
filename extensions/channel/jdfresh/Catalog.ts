import { defineProviderCatalog } from '@shop/providercore';

export const JdfreshCatalog = defineProviderCatalog({
  id: 'jdfresh',
  name: '京东生鲜',
  business: '生鲜配送',
  clients: ['console', 'storefront', 'miniapp', 'supplier'],
  settings: ['连接认证', '区域可售', '温层与重量', '配送时段', '缺货替代'],
  help: '管理京东生鲜区域库存、配送时段、缺货替代与履约。',
});

import { defineProviderCatalog } from '@shop/providercore';

export const ChargeCatalog = defineProviderCatalog({
  id: 'charge',
  name: '虚拟卡券与直充',
  business: '手机与油卡直充',
  clients: ['console', 'storefront', 'miniapp', 'supplier'],
  settings: ['连接认证', '充值品类', '号码规则', '结果查询', '回调与对账'],
  help: '管理手机、油卡等直充商品、号码校验和未知结果恢复。',
});

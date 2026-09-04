import { defineProviderCatalog } from '@shop/providercore';

export const FoodvoucherCatalog = defineProviderCatalog({
  id: 'foodvoucher',
  name: '食品提货券',
  business: '餐饮电子提货券',
  clients: ['console', 'storefront', 'miniapp', 'store', 'supplier'],
  settings: ['品牌连接', '券商品', '适用门店', '发码与核销', '退款与账单'],
  help: '管理餐饮券商品、适用门店、电子码发放、核销和退款。',
});

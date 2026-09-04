import { defineProviderCatalog } from '@shop/providercore';

export const MealCatalog = defineProviderCatalog({
  id: 'meal',
  name: '在线点餐',
  business: '连锁餐饮点餐',
  clients: ['console', 'storefront', 'miniapp', 'store', 'supplier'],
  settings: ['品牌连接', '套餐与门店', '预约时段', '电子凭证', '核销与退款'],
  help: '管理套餐组成、门店、预约、电子凭证、核销和退款。',
});

import { defineProviderCatalog } from '@shop/providercore';

export const FlowerCatalog = defineProviderCatalog({
  id: 'flower',
  name: '鲜花',
  business: '鲜花预约配送',
  clients: ['console', 'storefront', 'miniapp', 'store', 'supplier'],
  settings: ['品牌连接', '花材规格', '城市与日期', '节日容量', '替代与账单'],
  help: '管理鲜花规格、配送城市、日期、卡片和缺货替代。',
});

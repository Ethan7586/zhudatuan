import { defineProviderCatalog } from '@shop/providercore';

export const SupplierCatalog = defineProviderCatalog({
  id: 'supplier',
  name: '自有供应商',
  business: '标准供应商',
  clients: ['console', 'storefront', 'miniapp', 'supplier'],
  settings: ['商品目录', '库存报价', '订单履约', '退货退款', '供应商账单'],
  help: '通过平台受控接口管理自有供应商商品、库存、订单和账单。',
});

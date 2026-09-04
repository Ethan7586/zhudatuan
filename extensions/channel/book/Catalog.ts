import { defineProviderCatalog } from '@shop/providercore';

export const BookCatalog = defineProviderCatalog({
  id: 'book',
  name: '图书',
  business: '图书零售',
  clients: ['console', 'storefront', 'miniapp', 'supplier'],
  settings: ['连接认证', 'ISBN 与出版社', '库存与价格', '订单物流', '账单与回调'],
  help: '管理图书 ISBN、出版社、套装、预售、库存和履约。',
});
